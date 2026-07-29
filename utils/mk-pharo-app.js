// Build a Pharo *application* image out of pharo/app-build.st.
//
//   node utils/mk-pharo-app.js <zip-url-with-image+changes+sources+startup.st> <ImageName.image> <outDir>
//
// Why a browser and not Node: Pharo's file layer needs our FileAttributesPlugin, which is
// backed by the browser's virtual FS (Squeak.dirList). Under Node that FS does not exist, so
// every stat fails and Pharo cannot even reach its snapshot code. In the worker it all works.
//
// The build boots the image with app-build.st as startup.st (which hides the IDE chrome,
// opens the app and calls Smalltalk snapshotPrimitive), waits for the marker file it leaves
// behind, then pulls the saved image out of IndexedDB through a browser download.
//
// Ship the resulting .image with its .changes and NO startup.st — the application state is
// baked in. The .sources file is only needed to browse code, so a deployment can drop it
// (that alone is ~39 MB).
(async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  const fs = await import("fs");
  const [zipUrl, imageName, outDir] = process.argv.slice(2);
  const browser = await puppeteer.launch({ headless:"new",
    executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args:["--no-sandbox","--use-gl=swiftshader"] });
  const p = await browser.newPage(); await p.setViewport({width:1024,height:768});
  const client = await p.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior:"allow", downloadPath: outDir });
  p.on("console",m=>{const t=m.text(); if(/snapshot|Full GC|error/i.test(t)) console.log("   [page] "+t.slice(0,110));});
  await p.goto("http://localhost:8091/run/index.html#zip="+encodeURIComponent(zipUrl),{waitUntil:"domcontentloaded"});
  // esperar el marcador que deja el script
  let done=null;
  for (let i=0;i<40;i++) {
    await new Promise(r=>setTimeout(r,5000));
    done = await p.evaluate(()=>new Promise(res=>{
      Squeak.fileGet("/appbuild.done", b=>res(new TextDecoder().decode(b)), ()=>res(null));
    })).catch(()=>null);
    if (done) break;
  }
  console.log("  marcador: "+(done||"NO APARECIÓ"));
  if (!done || !done.includes("snapshot=")) { await browser.close(); process.exit(1); }
  // bajar la imagen guardada desde la FS virtual
  await p.evaluate((name)=>new Promise((res,rej)=>{
    Squeak.fileGet(name, buf=>{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([buf],{type:"application/octet-stream"}));
      a.download=name.replace(/^\//,""); document.body.appendChild(a); a.click(); res();
    }, e=>rej(new Error("no se pudo leer "+name+": "+e)));
  }), "/"+imageName);
  // esperar que el archivo termine de bajar
  const target = outDir+"/"+imageName;
  for (let i=0;i<60;i++) {
    await new Promise(r=>setTimeout(r,2000));
    if (fs.existsSync(target) && !fs.existsSync(target+".crdownload")) {
      const sz=fs.statSync(target).size;
      if (sz>1e6) { console.log("  imagen extraída: "+sz+" bytes"); break; }
    }
  }
  await browser.close();
})();
