// A/B intercalado de las PRIMITIVAS DIRECTAS (DIRECTOPRIM) sobre la forma directa.
//
//   node medir-prim.js <imagen.image> [repeticiones]     (default 5)
//   GUION=<archivo.st>   guion a correr (default: tinyBenchmarks)
//   PRIMLISTA=238,239    restringir el brazo B a esas primitivas
//
// Por que intercalado: en esta maquina el ruido del host es 20-44% y Spotlight o
// cualquier cosa de fondo mueve una corrida entera. Alternar A,B,A,B,... y reportar
// MEDIANA y MEJOR reparte el ruido entre los dos brazos en vez de regalarselo a uno.
// Verifica ademas el invariante semantico en cada corrida: si cambia, la comparacion
// no vale nada porque los dos brazos ya no hacen lo mismo.
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");

const imagen = path.resolve(process.argv[2] || "Cuis7.8.image");
const N = +(process.argv[3] || 5);
const HARNESS = path.join(__dirname, "correr-cuis.js");
const dir = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "prim-")));
for (const ext of [".image", ".changes", ".sources"]) {
    const src = imagen.replace(/\.image$/, ext);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, path.basename(src)));
}
const guion = process.env.GUION
    ? fs.readFileSync(path.resolve(process.env.GUION), "utf8")
    : `| out s |
out := StdIOWriteStream stdout.
s := 0 tinyBenchmarks.
out nextPutAll: '##TINY ', s; newLine; flush.
out nextPutAll: '##CHK ', 28 benchFib printString, ' ', 3 benchmark printString; newLine; flush.
Smalltalk quitPrimitive.
`;
fs.writeFileSync(path.join(dir, "g.st"), guion);

function corrida(prim) {
    fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
    const t0 = Date.now();
    const out = execFileSync("node", [HARNESS, path.join(dir, path.basename(imagen)), "-e", "-s", "g.st"],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TOPE_MS: "180000", DIRECTO: "3",
                 DIRECTOPRIM: prim ? (process.env.PRIMLISTA || "1") : "0" } });
    const wall = Date.now() - t0;
    const t = out.match(/##TINY ([\d.]+) megaBytecodes\/second; ([\d.]+) megaSends\/second/);
    const c = out.match(/##CHK (\d+) (\d+)/);
    const ms = out.match(/##MS (\d+)/);
    if (c && (c[1] !== "1028457" || c[2] !== "1028"))
        throw new Error(`INVARIANTE ROTO con DIRECTOPRIM=${prim}: benchFib=${c[1]} benchmark=${c[2]}`);
    return { bc: t ? +t[1] : null, se: t ? +t[2] : null, ms: ms ? +ms[1] : null, wall: wall };
}

const med = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

const A = [], B = [];
console.log(`imagen: ${path.basename(imagen)} | N=${N} intercalado | carga: ${os.loadavg().map(x => x.toFixed(1)).join(" ")}`);
for (let i = 0; i < N; i++) {
    const a = corrida(false), b = corrida(true);    // intercalado A,B,A,B,...
    A.push(a); B.push(b);
    const f = r => r.bc !== null ? `${r.bc.toFixed(1)} Mbc/s ${r.se.toFixed(1)} Msend/s`
                                 : (r.ms !== null ? `${r.ms} ms` : `${r.wall} ms wall`);
    console.log(`  ${i + 1}: sin prim ${f(a)}  |  con prim ${f(b)}`);
}
function reporta(nombre, sel, mayorEsMejor) {
    const a = A.map(sel).filter(x => x !== null), b = B.map(sel).filter(x => x !== null);
    if (!a.length) return;
    const ma = med(a), mb = med(b);
    const mejorA = mayorEsMejor ? Math.max(...a) : Math.min(...a);
    const mejorB = mayorEsMejor ? Math.max(...b) : Math.min(...b);
    const r = mayorEsMejor ? mb / ma : ma / mb;
    console.log(`${nombre.padEnd(12)} mediana ${ma.toFixed(1)} -> ${mb.toFixed(1)}   ` +
                `mejor ${mejorA.toFixed(1)} -> ${mejorB.toFixed(1)}   ` +
                `${r >= 1 ? "+" : ""}${((r - 1) * 100).toFixed(1)}%`);
}
console.log("");
reporta("bytecodes", r => r.bc, true);
reporta("sends", r => r.se, true);
reporta("ms imagen", r => r.ms, false);
reporta("wall", r => r.wall, false);
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
