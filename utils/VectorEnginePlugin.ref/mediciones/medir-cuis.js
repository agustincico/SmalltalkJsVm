// Baseline "sentido" de Cuis 7.8 bajo SqueakJS (motor Smalltalk, sin plugin):
//   1) latencia de abrir el menú del World (click -> menú visible), 5 veces
//   2) FPS efectivo arrastrando una ventana grande durante ~4 s
//
// El muestreador vive DENTRO de la página (MessageChannel, ~1ms): compara un
// downscale del canvas y cuenta cambios visuales; los eventos de mouse son
// reales (page.mouse de Chrome).
//
//   node medir-cuis.js <url>
"use strict";
const args = process.argv.slice(2);
const URL_ = args.find(a => a.startsWith("http"));
const W = 1200, H = 850;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x,y)=>x-y);
    return Math.round(b[Math.min(b.length-1, Math.floor(p*(b.length-1)+0.5))]*10)/10; };

const CARGANDO = `(function(){var s=document.getElementById("sqSpinner");
    return !s ? "sin cartel" : (s.style.display === "none" ? null : "cargando");})()`;

// muestreador de cambios visuales sobre una región, corriendo en la página
const INSTALar = function () {
    var c = document.querySelector("canvas");
    var L = window.__M = { marcas: [], corriendo: false, region: null, cambios: [] };
    var t = document.createElement("canvas"), g = null, prev = null;
    L.mirar = function (x, y, w, h) {
        L.region = { x: x, y: y, w: w, h: h };
        t.width = Math.ceil(w / 4); t.height = Math.ceil(h / 4);
        g = t.getContext("2d", { willReadFrequently: true });
        prev = null; L.cambios = []; L.corriendo = true;
    };
    L.parar = function () { L.corriendo = false; var r = L.cambios; L.cambios = []; return r; };
    function paso() {
        if (L.corriendo && g) {
            var r = L.region;
            g.drawImage(c, r.x, r.y, r.w, r.h, 0, 0, t.width, t.height);
            var d = g.getImageData(0, 0, t.width, t.height).data;
            if (prev) {
                var dif = 0;
                for (var i = 0; i < d.length; i += 8)
                    if (Math.abs(d[i] - prev[i]) > 10) dif++;
                if (dif > 6) L.cambios.push(performance.now());
            }
            prev = d.slice();
        }
        ch.port2.postMessage(0);
    }
    var ch = new MessageChannel();
    ch.port1.onmessage = paso;
    ch.port2.postMessage(0);
};

(async () => {
    const puppeteer = (await import("puppeteer-core")).default;
    const br = await puppeteer.launch({ headless: "new", protocolTimeout: 900000,
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: ["--no-sandbox", "--disable-gpu", `--window-size=${W},${H}`, "--use-gl=swiftshader"] });
    const p = await br.newPage(); await p.setViewport({ width: W, height: H });
    const t0 = Date.now();
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    let ok = false;
    while (Date.now() - t0 < 300000) { await sleep(1500);
        if ((await p.evaluate(CARGANDO).catch(() => "?")) === null) { ok = true; break; } }
    if (!ok) { console.log("NO ARRANCÓ"); await br.close(); return; }
    console.log("# arranque:", Date.now() - t0, "ms");
    await sleep(8000);
    await p.evaluate("(" + INSTALar + ")()");

    // ---- 1) latencia de abrir el menú del World (5 veces) ----
    const lat = [];
    for (let i = 0; i < 5; i++) {
        // mirar la región donde va a aparecer el menú
        await p.evaluate("window.__M.mirar(850, 380, 330, 420)");
        const t1 = await p.evaluate("performance.now()");
        await p.mouse.click(900, 700);
        await sleep(2500);
        const cambios = await p.evaluate("window.__M.parar()");
        if (cambios.length) lat.push(cambios[0] - t1);
        // cerrar el menú con Escape
        await p.keyboard.press("Escape"); await sleep(800);
    }
    console.log("# abrir el menú del World: " + lat.map(x => Math.round(x)).join(", ") +
        " ms  (p50 " + pct(lat, .5) + ")");

    // ---- abrir un Browser para tener una ventana grande con texto ----
    await p.mouse.click(900, 700); await sleep(2000);
    await p.mouse.move(890, 495, { steps: 6 }); await sleep(400);
    await p.mouse.move(950, 495, { steps: 8 }); await sleep(2000);   // Open >
    await p.mouse.click(750, 550); await sleep(5000);                // Browser
    await p.screenshot({ path: "/tmp/medir-browser.png" });

    // ---- 2) FPS arrastrando el Browser por la barra de título ----
    // la ventana nueva aparece más o menos centrada; agarrar por el título
    for (const [nombre, tx, ty] of [["titulo", 600, 90]]) {
        await p.evaluate("window.__M.mirar(0, 0, " + W + ", " + H + ")");
        await p.mouse.move(tx, ty); await p.mouse.down();
        const pasos = 240, dur = 4000;   // 60 eventos/s durante 4 s
        const t2 = Date.now();
        for (let i = 0; i < pasos; i++) {
            const ang = i / pasos * 2 * Math.PI;
            await p.mouse.move(tx + Math.round(Math.sin(ang * 2) * 180),
                               ty + Math.round(Math.sin(ang) * 120) + 120, { steps: 1 });
            const resto = t2 + (i + 1) * (dur / pasos) - Date.now();
            if (resto > 0) await sleep(resto);
        }
        await p.mouse.up();
        const cambios = await p.evaluate("window.__M.parar()");
        // fps = cambios visuales por segundo durante el arrastre
        const dts = []; for (let i = 1; i < cambios.length; i++) dts.push(cambios[i] - cambios[i-1]);
        console.log("# arrastre (" + nombre + "): " + cambios.length + " cuadros en " +
            (dur/1000) + " s = " + Math.round(cambios.length / (dur/1000)) + " fps  " +
            "(dt p50 " + pct(dts,.5) + " ms, p90 " + pct(dts,.9) + " ms)");
    }
    await p.screenshot({ path: "/tmp/medir-final.png" });
    await br.close();
})();
