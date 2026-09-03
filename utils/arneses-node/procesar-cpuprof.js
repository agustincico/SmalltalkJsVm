// Procesa un .cpuprofile de node --cpu-prof: self-time agrupado por funcion y por archivo.
//   node procesar-cpuprof.js <archivo.cpuprofile> [topN]
// El jit bautiza las funciones generadas como Clase_selector, asi que el perfil
// habla Smalltalk. Agrupa: (jiteado) = codigo generado, vm.*.js = interprete,
// (v8) = GC/compilador/idle de V8.
"use strict";
const fs = require("fs");
const prof = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const topN = +(process.argv[3] || 25);
// 4to argumento: descartar el arranque — fraccion inicial del tiempo a ignorar (ej 0.4)
const saltar = +(process.argv[4] || 0);
const nodes = new Map(prof.nodes.map(n => [n.id, n]));
const self = new Map();   // id -> microsegundos de self time
let total = 0;
const deltas = prof.timeDeltas, samples = prof.samples;
let tAcum = 0, tTotal = 0;
for (let i = 0; i < samples.length; i++) tTotal += deltas[i] > 0 ? deltas[i] : 0;
for (let i = 0; i < samples.length; i++) {
    const d = deltas[i] > 0 ? deltas[i] : 0;
    tAcum += d;
    if (tAcum < tTotal * saltar) continue;   // ventana: solo el final
    self.set(samples[i], (self.get(samples[i]) || 0) + d);
    total += d;
}
function nombre(n) {
    const f = n.callFrame;
    let fn = f.functionName || "(anonima)";
    let src = (f.url || "").replace(/^.*\//, "");
    if (!src && /^(\(garbage collector\)|\(idle\)|\(program\))$/.test(fn)) src = "(v8)";
    if (src === "" && fn !== "(root)") src = "(eval-jit)";
    return { fn, src };
}
const porFn = new Map(), porSrc = new Map();
for (const [id, us] of self) {
    const n = nodes.get(id); if (!n) continue;
    const { fn, src } = nombre(n);
    const k = fn + "  [" + src + "]";
    porFn.set(k, (porFn.get(k) || 0) + us);
    const grupo = src === "(eval-jit)" ? "(codigo jiteado)" : src;
    porSrc.set(grupo, (porSrc.get(grupo) || 0) + us);
}
console.log("total muestreado: " + (total/1000).toFixed(0) + " ms\n");
console.log("== self-time por grupo ==");
[...porSrc.entries()].sort((a,b) => b[1]-a[1]).forEach(([k,us]) => {
    if (us/total > 0.002) console.log("  " + (us/total*100).toFixed(1).padStart(5) + "%  " + k);
});
console.log("\n== top " + topN + " funciones por self-time ==");
[...porFn.entries()].sort((a,b) => b[1]-a[1]).slice(0, topN).forEach(([k,us]) => {
    console.log("  " + (us/total*100).toFixed(1).padStart(5) + "%  " + k);
});
