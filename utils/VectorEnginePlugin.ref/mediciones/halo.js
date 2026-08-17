// ¿Aparecen los handles de escala/rotación del halo con el plugin?
// Abre Cuis, click con botón del medio sobre la ventana del Transcript (halo),
// y captura. Corre con y sin &vectorPlugin para comparar.
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
    p.on("console", m => { if (/VectorEnginePlugin/.test(m.text())) console.log("[worker]", m.text().slice(0,80)); });
    const t0=Date.now(); await p.goto(URL_,{waitUntil:"domcontentloaded"});
    let ok=false;
    while(Date.now()-t0<300000){ await sleep(1500); if((await p.evaluate(CARGANDO).catch(()=>"?"))===null){ok=true;break;} }
    if(!ok){ console.log("NO ARRANCÓ"); await br.close(); return; }
    console.log("# arranque:", Date.now()-t0, "ms");
    await sleep(8000);
    // halo: click con botón del medio sobre el título del Transcript (abajo a la izquierda)
    await p.mouse.click(200, 470, { button: "middle" });
    await sleep(3000);
    await p.screenshot({ path: "/tmp/halo-" + LABEL + ".png" });
    console.log("# captura: /tmp/halo-" + LABEL + ".png");
    await br.close();
})();
