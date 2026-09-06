// Mide N configuraciones del VM INTERCALADAS, sobre el mismo trabajo.
//
//   node medir-brazos.js <imagen.image> <reps> <nombre:VAR=val,VAR=val> ...
//   GUION=<archivo.st>    default: utils/arneses-node/scripts/tiny.st
//
// Por que intercaladas y no una tras otra: el ruido del host en esta maquina llega al
// 20-44%, asi que dos corridas seguidas de la misma config pueden diferir mas que dos
// configs distintas. Rota A,B,C,A,B,C,... y reporta MEDIANA y MEJOR; el MEJOR es el mas
// robusto (es la corrida que menos interferencia comio).
//
// Verifica los invariantes semanticos en cada corrida: si un brazo cambia el resultado,
// no esta midiendo lo mismo y la comparacion no vale.
//
// RECETA OBLIGATORIA (ver medir-tiny.js): directorio temporal propio con el par
// imagen/.changes AUTENTICO. Si el .changes falta o es inconsistente, Cuis descarrila en
// el arranque, el guion NUNCA corre, y el arnes igual reporta un tiempo plausible que es
// puro boot. El sintoma: faltan las marcas ## y el wall es sospechosamente corto.
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");

const imagen = path.resolve(process.argv[2]);
const N = +(process.argv[3] || 3);
const BRAZOS = process.argv.slice(4).map(spec => {
    const i = spec.indexOf(":");
    const nombre = spec.slice(0, i);
    const env = {};
    for (const kv of spec.slice(i + 1).split(",")) {
        if (!kv) continue;
        const j = kv.indexOf("=");
        env[kv.slice(0, j)] = kv.slice(j + 1);
    }
    return { nombre, env };
});
if (!BRAZOS.length) { console.error("hacen falta brazos: nombre:VAR=val,..."); process.exit(2); }

const HARNESS = path.join(__dirname, "correr-cuis.js");
const dir = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "brazos-")));
let faltaChanges = true;
for (const ext of [".image", ".changes", ".sources"]) {
    const src = imagen.replace(/\.image$/, ext);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dir, path.basename(src))); if (ext === ".changes") faltaChanges = false; }
}
if (faltaChanges) { console.error("FALTA el .changes al lado de la imagen: la medicion seria basura"); process.exit(2); }
fs.writeFileSync(path.join(dir, "g.st"),
    fs.readFileSync(path.resolve(process.env.GUION || path.join(__dirname, "scripts/tiny.st")), "utf8"));

function corrida(env) {
    fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
    const t0 = Date.now();
    const out = execFileSync("node", [HARNESS, path.join(dir, path.basename(imagen)), "-e", "-s", "g.st"],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TOPE_MS: "180000", ...env } });
    const wall = Date.now() - t0;
    const t = out.match(/##TINY ([\d.]+) megaBytecodes\/second; ([\d.]+) megaSends\/second/);
    const c = out.match(/##CHK (\d+) (\d+)/);
    const ms = out.match(/##MS (\d+)/);
    if (!t && !ms) throw new Error("corrida SIN MARCAS (el guion no corrio):\n" + out.slice(-400));
    if (c && (c[1] !== "1028457" || c[2] !== "1028"))
        throw new Error(`INVARIANTE ROTO con ${JSON.stringify(env)}: benchFib=${c[1]} benchmark=${c[2]}`);
    return { bc: t ? +t[1] : null, se: t ? +t[2] : null, ms: ms ? +ms[1] : null, wall };
}

const med = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

const datos = BRAZOS.map(() => []);
console.log(`imagen: ${path.basename(imagen)} | ${BRAZOS.length} brazos x ${N} | carga: ${os.loadavg().map(x => x.toFixed(1)).join(" ")}`);
for (let i = 0; i < N; i++) {
    for (let b = 0; b < BRAZOS.length; b++) {
        const r = corrida(BRAZOS[b].env);
        datos[b].push(r);
        const f = r.bc !== null ? `${r.bc.toFixed(1)} Mbc/s ${r.se.toFixed(1)} Msend/s`
                                : `${r.ms} ms`;
        console.log(`  ${i + 1} ${BRAZOS[b].nombre.padEnd(14)} ${f}   (wall ${r.wall})`);
    }
}
function tabla(titulo, sel, mayorEsMejor) {
    const vals = datos.map(d => d.map(sel).filter(x => x !== null));
    if (!vals[0].length) return;
    const ref = mayorEsMejor ? Math.max(...vals[0]) : Math.min(...vals[0]);
    console.log(`\n=== ${titulo} (contra "${BRAZOS[0].nombre}") ===`);
    BRAZOS.forEach((b, i) => {
        const mejor = mayorEsMejor ? Math.max(...vals[i]) : Math.min(...vals[i]);
        const r = mayorEsMejor ? mejor / ref : ref / mejor;
        console.log(`  ${b.nombre.padEnd(14)} mediana ${med(vals[i]).toFixed(1).padStart(8)}   ` +
                    `mejor ${mejor.toFixed(1).padStart(8)}   ` +
                    `${i === 0 ? "(referencia)" : (r >= 1 ? "+" : "") + ((r - 1) * 100).toFixed(1) + "%"}`);
    });
}
tabla("bytecodes M/s", r => r.bc, true);
tabla("sends M/s", r => r.se, true);
tabla("ms dentro de la imagen", r => r.ms, false);
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
