// CENSO del invariante de la forma "labeled blocks" del codegen directo:
// sobre los metodos ELEGIBLES (sin primitiva/closure/newArray/thisContext/raro),
// verificar que (a) no hay saltos condicionales hacia atras, (b) los extents de
// loops [D..E) son disjuntos o anidados, (c) ningun salto aterriza estrictamente
// adentro de un loop desde afuera. Si eso da 0 violaciones, la emision con
// labeled break/continue cubre el 100% de los elegibles y el for(;;)switch queda
// solo de fallback teorico.
// Uso: node censo-blk.js <imagen.image>
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);

Object.assign(global, {
    self: new Proxy({}, {
        get: (o, p) => global[p],
        set: (o, p, v) => { global[p] = v; return true; },
    }),
});
Object.assign(self, {
    localStorage: {},
    WebSocket: typeof WebSocket === "undefined" ? require(REPO + "/lib_node/WebSocket") : WebSocket,
    sha1: require(REPO + "/lib/sha1"),
    btoa: s => Buffer.from(s, "ascii").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("ascii"),
});
require(REPO + "/globals.js");
require(REPO + "/vm.js");
require(REPO + "/vm.object.js");
require(REPO + "/vm.object.spur.js");
require(REPO + "/vm.image.js");
require(REPO + "/vm.interpreter.js");
require(REPO + "/vm.interpreter.proxy.js");
require(REPO + "/vm.instruction.stream.js");
require(REPO + "/vm.instruction.stream.sista.js");
require(REPO + "/vm.instruction.printer.js");
require(REPO + "/vm.primitives.js");
require(REPO + "/jit.js");
require(REPO + "/vm.display.js");
require(REPO + "/vm.display.headless.js");
require(REPO + "/vm.input.js");
require(REPO + "/vm.input.headless.js");
require(REPO + "/vm.plugins.js");
require(REPO + "/vm.plugins.file.node");
Object.extend(Squeak, {
    vmPath: process.cwd() + path.sep,
    platformSubtype: "Node.js",
    osVersion: process.version + " " + os.platform() + " " + os.release() + " " + os.arch(),
    windowSystem: "none",
});

const { escanearMetodo, motivos } = require("/private/tmp/claude-501/-Users-agustin-SqueakJS/6765a590-7fe2-4fcb-9c3f-190369322e92/scratchpad/censo/censo-lib.js");

// decode SISTA minimo que junta los saltos: [{src (pc post-instr), dest, cond}]
// misma semantica de fin que censo-lib/jit (return con pc > endPC).
function saltosDe(m) {
    var bytes = m.bytes, pc = 0, endPC = 0, extA = 0, extB = 0, done = false;
    var saltos = [];
    var n = 0;
    while (!done) {
        if (pc >= bytes.length) return null; // no deberia pasar en elegibles
        if (n++ > 200000) return null;
        var b = bytes[pc++];
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = extB * 256 + (v < 128 ? v : v - 256); continue; }
        var eB = extB, b2, dist;
        extA = 0; extB = 0;
        if (b <= 0x57) { /* pushes, dup, etc (0x52/0x54-57 no llegan: elegibles) */ }
        else if (b >= 0x58 && b <= 0x5E) { done = pc > endPC; }
        else if (b === 0x5F) { }
        else if (b <= 0xAF) { }                                  // sends
        else if (b <= 0xB7) { dist = (b & 7) + 1; saltos.push({ src: pc, dest: pc + dist, cond: false }); if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; saltos.push({ src: pc, dest: pc + dist, cond: true }); if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xD8) { }
        else if (b === 0xE2 || b === 0xE3 || b === 0xE4 || b === 0xE5) { pc++; }
        else if (b === 0xE7) { pc++; }
        else if (b === 0xE8 || b === 0xE9) { pc++; }
        else if (b === 0xEA) { pc++; }
        else if (b === 0xEB) { pc++; }
        else if (b === 0xED) { b2 = bytes[pc++]; dist = b2 + eB * 256; saltos.push({ src: pc, dest: pc + dist, cond: false }); if (pc + dist > endPC) endPC = pc + dist; }
        else if (b === 0xEE || b === 0xEF) { b2 = bytes[pc++]; dist = b2 + eB * 256; saltos.push({ src: pc, dest: pc + dist, cond: true }); if (pc + dist > endPC) endPC = pc + dist; }
        else if (b >= 0xF0 && b <= 0xF5) { pc++; }
        else if (b === 0xF8 || b === 0xF9) { pc += 2; }
        else if (b === 0xFA) { pc += 2; }
        else if (b >= 0xFB && b <= 0xFD) { pc += 2; }
        else return null;
    }
    return saltos;
}

fs.readFile(fullName, function (error, data) {
    if (error) { console.error("No pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function () {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;

        var vistos = new Set();
        var tot = 0, eleg = 0, conLoop = 0, ok = 0;
        var vBackCond = 0, vSolapados = 0, vSaltoAdentro = 0, sinDecodificar = 0;
        var ejemplos = [];
        vm.allMethodsDo(function (classObj, m, selObj) {
            if (vistos.has(m)) return; vistos.add(m);
            if (!m.methodSignFlag || !m.methodSignFlag() || !m.bytes) return;
            tot++;
            var r = escanearMetodo(m);
            if (motivos(r).length > 0 || r.superSend || r.superDirected) return; // solo elegibles R1
            eleg++;
            var saltos = saltosDe(m);
            if (saltos === null) { sinDecodificar++; return; }
            // loops: back-jump dest D, fin E = pc post ultimo back-jump a D
            var loops = {};
            var malo = null;
            for (var i = 0; i < saltos.length; i++) {
                var s = saltos[i];
                if (s.dest <= s.src) { // hacia atras (dist<=0)
                    if (s.cond) { malo = "backCond"; break; }
                    var D = s.dest;
                    if (!loops[D] || loops[D] < s.src) loops[D] = s.src; // E
                }
            }
            var lista = Object.keys(loops).map(function (k) { return { D: +k, E: loops[k] }; })
                .sort(function (a, b) { return a.D - b.D; });
            if (!malo) {
                for (var a = 0; a < lista.length && !malo; a++)
                    for (var b = a + 1; b < lista.length; b++) {
                        // D_a < D_b: exijo anidado (E_b <= E_a) o disjunto (D_b >= E_a)
                        if (!(lista[b].E <= lista[a].E || lista[b].D >= lista[a].E)) { malo = "solapados"; break; }
                    }
            }
            if (!malo) {
                for (var j = 0; j < saltos.length && !malo; j++) {
                    var f = saltos[j];
                    if (f.dest <= f.src) continue; // back ya tratado
                    for (var k = 0; k < lista.length; k++) {
                        var L = lista[k];
                        var srcAdentro = f.src > L.D && f.src <= L.E;
                        var destAdentro = f.dest > L.D && f.dest < L.E;
                        if (destAdentro && !srcAdentro) { malo = "saltoAdentro"; break; }
                    }
                }
            }
            if (lista.length > 0) conLoop++;
            if (malo === "backCond") vBackCond++;
            else if (malo === "solapados") vSolapados++;
            else if (malo === "saltoAdentro") vSaltoAdentro++;
            else ok++;
            if (malo && ejemplos.length < 20)
                ejemplos.push(classObj.className() + ">>" + (selObj ? selObj.bytesAsString() : "?") + " [" + malo + "]");
        });
        console.log("metodos sista con bytes:        " + tot);
        console.log("elegibles R1 (sin super):       " + eleg);
        console.log("  con al menos un loop:         " + conLoop);
        console.log("  BLK-ok (labeled blocks):      " + ok + " (" + (100 * ok / eleg).toFixed(2) + "%)");
        console.log("  violaciones backCond:         " + vBackCond);
        console.log("  violaciones loops solapados:  " + vSolapados);
        console.log("  violaciones salto-adentro:    " + vSaltoAdentro);
        console.log("  sin decodificar:              " + sinDecodificar);
        if (ejemplos.length) console.log("ejemplos:\n  " + ejemplos.join("\n  "));
        process.exit(0);
    });
});
