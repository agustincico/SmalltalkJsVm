// Mide tinyBenchmarks bajo SqueakJS de forma repetible.
//
//   node medir-tiny.js <imagen.image> [repeticiones]   (default 5)
//   REPO=<otro-arbol> node medir-tiny.js ...           medir otra version del VM
//   NOJIT=1 node medir-tiny.js ...                     sin jit
//
// Receta que hace falta y por que (aprendida a los golpes, ago-2026):
// - El .changes tiene que ser el PAR REAL de la imagen (el de 138 bytes que
//   distribuye Cuis esta bien: es el autentico). Con un stub inconsistente, el
//   chequeo de arranque de Cuis descarrila la cola de deferredUIMessages.
// - El doit va por -e -s (el -e hace visibles las excepciones del script).
// - La salida del script va por StdIOWriteStream (el Transcript con el
//   arranque sano va a la ventana del mundo, no a stdout).
// - El script termina con quitPrimitive; NADA de IGNOREQUIT (ya no hace falta
//   con el nombre de imagen arreglado, y dejaba la imagen viva hasta el tope).
// - correr-cuis.js bombea eventos sinteticos (ver BOMBA DE EVENTOS ahi).
// - tinyBenchmarks se autocalibra (>=1s por parte), asi que corre caliente;
//   una pasada en frio mide el compilador del jit, no el VM.
// Reporta MINIMO y MEDIANA de N corridas (el ruido del host aca es 20-44%:
// una corrida suelta no distingue nada), y verifica el invariante semantico
// (28 benchFib = 1028457, 3 benchmark = 1028) en cada corrida.
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");

const imagen = path.resolve(process.argv[2] || "Cuis7.8.image");
const N = +(process.argv[3] || 5);
const HARNESS = path.join(__dirname, "correr-cuis.js");
// realpath: en macOS os.tmpdir() es symlink (/var -> /private/var) y Cuis no
// puede crear sus UserFiles a traves del symlink
const dir = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "tiny-")));

for (const ext of [".image", ".changes", ".sources"]) {
    const src = imagen.replace(/\.image$/, ext);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, path.basename(src)));
}
fs.writeFileSync(path.join(dir, "tiny.st"), `| out s |
out := StdIOWriteStream stdout.
s := 0 tinyBenchmarks.
out nextPutAll: '##TINY ', s; newLine; flush.
out nextPutAll: '##CHK ', 28 benchFib printString, ' ', 3 benchmark printString; newLine; flush.
Smalltalk quitPrimitive.
`);

const bc = [], se = [];
console.log(`imagen: ${path.basename(imagen)} | jit: ${process.env.NOJIT ? "NO" : "si"} | VM: ${process.env.REPO || "(repo)"} | N=${N} | carga: ${os.loadavg().map(x => x.toFixed(1)).join(" ")}`);
for (let i = 0; i < N; i++) {
    fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
    const out = execFileSync("node", [HARNESS, path.join(dir, path.basename(imagen)), "-e", "-s", "tiny.st"],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TOPE_MS: "180000" } });
    const t = out.match(/##TINY ([\d.]+) megaBytecodes\/second; ([\d.]+) megaSends\/second/);
    const c = out.match(/##CHK (\d+) (\d+)/);
    if (!t || !c) throw new Error("corrida sin marcas:\n" + out.slice(-500));
    if (c[1] !== "1028457" || c[2] !== "1028")
        throw new Error(`INVARIANTE ROTO: benchFib=${c[1]} (espera 1028457), benchmark=${c[2]} (espera 1028)`);
    bc.push(+t[1]); se.push(+t[2]);
    console.log(`  corrida ${i + 1}: ${t[1]} Mbc/s  ${t[2]} Msends/s  (invariantes ok)`);
}
const med = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
console.log(`\nbytecodes: mejor ${Math.max(...bc).toFixed(2)}M  mediana ${med(bc).toFixed(2)}M`);
console.log(`sends:     mejor ${Math.max(...se).toFixed(2)}M  mediana ${med(se).toFixed(2)}M`);
console.log(`Dorados: ${Math.max(...bc).toFixed(0)}  (Juan: 100 = Morphic comodo, 1000 = VectorGraphics Morphic 3 comodo)`);
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir + "-UserFiles", { recursive: true, force: true });
