// ¿El debugger sigue viendo bien la pila con la FORMA DIRECTA encendida?
//
//   node probar-debugger.js <imagen.image> <guion.st>
//   MODOS=0,3 node probar-debugger.js ...        (default 0,3)
//
// La pregunta de fondo: la forma directa (jit.directo.js) compila métodos a
// funciones JS cuyo receptor, argumentos, temporales y pila de operandos viven
// en LOCALES DE JAVASCRIPT — no hay MethodContext. El debugger de Smalltalk, en
// cambio, trabaja recorriendo la cadena de contextos. Si la materialización de
// esos contextos (la "deopt") tuviera algún error, se vería acá: un frame que
// falta, un pc corrido, un temporal en nil, o una reanudación que no vuelve.
//
// El método: correr el MISMO guión con la forma directa apagada (DIRECTO=0) y
// encendida (DIRECTO=3) y exigir que las marcas salgan IDÉNTICAS línea por
// línea. El modo clásico es el oráculo.
//
// Convención del guión .st:
//   ##LOQUESEA ...   línea que SE COMPARA entre modos (tiene que ser idéntica)
//   ##~LOQUESEA ...  línea informativa que NO se compara (resultado no
//                    determinista, p.ej. dónde cayó una preempción)
// El guión termina con `Smalltalk quitPrimitive`.
//
// RECETA (heredada de medir-tiny.js, aprendida a los golpes):
//  - directorio temporal propio con el par imagen/.changes AUTÉNTICO (con un
//    .changes inconsistente, el chequeo de arranque de Cuis descarrila);
//  - el guión va AL LADO de la imagen y se invoca con `-e -s` (el -e hace
//    visibles las excepciones del guión);
//  - la salida va por StdIOWriteStream, no por Transcript;
//  - OJO: escribir a ese stream DESDE ADENTRO de un bloque de ensure:/
//    ifCurtailed: pierde la salida (pasa igual en los dos modos, es la
//    reentrada sobre el buffer del stream). Usar una colección y leerla después.
//
// Para que la prueba no sea vacía hay que confirmar que los métodos que
// aparecen en la cadena estaban DE VERDAD en forma directa:
//   DIRECTOQUIEN='Magnitude>>between:and:' node probar-debugger.js ...
// (y DIRECTOTOP=25 lista los métodos directos más llamados).
"use strict";
const { spawnSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");

const imagen = path.resolve(process.argv[2] || "Cuis7.8.image");
const guionPath = path.resolve(process.argv[3]);
const HARNESS = path.join(__dirname, "correr-cuis.js");
const MODOS = (process.env.MODOS || "0,3").split(",");

if (!fs.existsSync(imagen)) { console.error("no existe la imagen: " + imagen); process.exit(2); }
if (!fs.existsSync(guionPath)) { console.error("no existe el guión: " + guionPath); process.exit(2); }

// realpath: en macOS os.tmpdir() es symlink y Cuis no puede crear sus UserFiles a través de él
const dir = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "dbg-")));
for (const ext of [".image", ".changes", ".sources"]) {
    const src = imagen.replace(/\.image$/, ext);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, path.basename(src)));
}
fs.writeFileSync(path.join(dir, "g.st"), fs.readFileSync(guionPath, "utf8"));

const salidas = {};
for (const modo of MODOS) {
    fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
    const r = spawnSync("node", [HARNESS, path.join(dir, path.basename(imagen)), "-e", "-s", "g.st"],
        { cwd: dir, encoding: "utf8", env: { ...process.env, TOPE_MS: process.env.TOPE_MS || "180000", DIRECTO: modo } });
    const out = (r.stdout || "") + (r.stderr || "");
    salidas[modo] = out;
    const lineas = out.split("\n");
    const comparables = lineas.filter(l => l.startsWith("##") && !l.startsWith("##~"));
    const info = lineas.filter(l => l.startsWith("##~") || /^===|^\[directo\]|^ {2,}(DIRECTO|clasico|\d)/.test(l));
    console.log(`======== DIRECTO=${modo} ======== (${comparables.length} marcas comparables)`);
    if (info.length) console.log(info.join("\n"));
    if (!comparables.length) {
        console.log("(SIN MARCAS — el guión no llegó a correr)\n" + out.slice(-900));
    }
    if (!out.includes("##FIN")) console.log("*** AVISO: no apareció ##FIN, el guión se cortó antes ***");
}
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });

if (MODOS.length < 2) process.exit(0);
const marcas = m => salidas[m].split("\n").filter(l => l.startsWith("##") && !l.startsWith("##~"));
const base = marcas(MODOS[0]);
let fallas = 0;
for (const modo of MODOS.slice(1)) {
    const otro = marcas(modo);
    const dif = [];
    for (let i = 0; i < Math.max(base.length, otro.length); i++) {
        const a = base[i] === undefined ? "<falta>" : base[i];
        const b = otro[i] === undefined ? "<falta>" : otro[i];
        if (a !== b) dif.push(`  línea ${i}:\n    DIRECTO=${MODOS[0]}: ${a}\n    DIRECTO=${modo}: ${b}`);
    }
    console.log(`\n=== DIRECTO=${MODOS[0]} contra DIRECTO=${modo}: ${base.length} vs ${otro.length} marcas ===`);
    if (!dif.length && base.length) console.log("*** IDÉNTICAS, línea por línea ***");
    else { fallas += dif.length || 1; console.log(dif.slice(0, 20).join("\n\n") || "  (una de las dos corridas no dio marcas)"); }
}
if (fallas) console.log(`\n*** ${fallas} DIFERENCIA(S) — el debugger NO ve lo mismo en los dos modos ***`);
process.exit(fallas ? 1 : 0);
