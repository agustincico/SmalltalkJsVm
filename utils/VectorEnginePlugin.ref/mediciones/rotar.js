// Prueba de rotación real: halo sobre el Transcript, agarrar el handle de
// rotación (abajo-izquierda) y arrastrarlo. Captura antes y después.
"use strict";
const args = process.argv.slice(2);
const URL_ = args.find(a => a.startsWith("http"));
const LABEL = args[args.indexOf("--label")+1] || "x";
const W = 1200, H = 850;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CARGANDO = `(function(){var s=document.getElementById("sqSpinner");
    return !s ? "sin cartel" : (s.style.display === "none" ? null : "cargando");})()`;
(async () => {
    const pup = (await import("puppeteer-core")).default;
    const br = await pup.launch({ headless:"new", protocolTimeout:900000,
        executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args:["--no-sandbox","--disable-gpu",`--window-size=${W},${H}`,"--use-gl=swiftshader"] });
    const p = await br.newPage(); await p.setViewport({width:W,height:H});
    const errores = [];
    p.on("console", m => {
        if (/VectorEnginePlugin/.test(m.text())) console.log("[consola]", m.text().slice(0,90));
        if (m.type() === "error") errores.push(m.text().slice(0,200));
    });
    p.on("dialog", d => d.dismiss());
    const t0=Date.now(); await p.goto(URL_,{waitUntil:"domcontentloaded"});
    let ok=false;
    while(Date.now()-t0<300000){ await sleep(1500); if((await p.evaluate(CARGANDO).catch(()=>"?"))===null){ok=true;break;} }
    if(!ok){ console.log("NO ARRANCÓ"); await br.close(); process.exit(1); }
    console.log("# arranque:", Date.now()-t0, "ms");
    await sleep(8000);
    // halo sobre el Transcript
    await p.mouse.click(200, 470, { button: "middle" });
    await sleep(3000);
    await p.screenshot({ path: "/tmp/rotar-" + LABEL + "-antes.png" });
    // handle de rotación: abajo a la izquierda del halo (~27,773 en las capturas)
    await p.mouse.move(27, 773); await sleep(300);
    await p.mouse.down(); await sleep(300);
    // arrastre en arco hacia abajo-derecha para rotar unos ~25 grados
    for (const [x,y] of [[60,790],[110,810],[170,820],[230,825]]) {
        await p.mouse.move(x, y, {steps: 8}); await sleep(250);
    }
    await sleep(500); await p.mouse.up();
    await sleep(3000);
    await p.screenshot({ path: "/tmp/rotar-" + LABEL + "-despues.png" });
    console.log("# capturas: /tmp/rotar-" + LABEL + "-{antes,despues}.png");
    console.log("# errores de consola:", errores.length ? errores : "ninguno");
    await br.close();
})();
