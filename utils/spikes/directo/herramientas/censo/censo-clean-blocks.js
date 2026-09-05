// ¿Cuántos métodos crean SOLO "clean blocks"?
//
// Un clean block (pushFullClosure 0xF9 con el bit limpio del 2do byte) NO captura
// el contexto: vm.interpreter.js:983 pone outerContext = nil y el comentario de la
// línea 991 dice que "creating one cannot make any context reachable". Si un método
// solo crea bloques de esos, el bloque no lo obliga a tener MethodContext — o sea
// que el rechazo por "BLOQUE" del gate podría ser más fino de lo que es hoy.
//
// El escaneo es el de utils/spikes/directo/herramientas/censo/censo-lib.js (probado),
// con la distinción limpio/sucio agregada. CLAVE: terminar en el return del método
// (done = pc > endPC), NO en bytes.length — después del código viene el trailer y
// decodificarlo produce bloques fantasma.
//
// Uso: node censo-limpios.js <imagen.image>
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);

Object.assign(global, {
    self: new Proxy({}, { get: (o, p) => global[p], set: (o, p, v) => { global[p] = v; return true; } }),
});
Object.assign(self, {
    localStorage: {},
    WebSocket: typeof WebSocket === "undefined" ? require(REPO + "/lib_node/WebSocket") : WebSocket,
    sha1: require(REPO + "/lib/sha1"),
    btoa: s => Buffer.from(s, "ascii").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("ascii"),
});
for (const f of ["globals.js", "vm.js", "vm.object.js", "vm.object.spur.js", "vm.image.js",
                 "vm.interpreter.js", "vm.interpreter.proxy.js", "vm.instruction.stream.js",
                 "vm.instruction.stream.sista.js", "vm.instruction.printer.js", "vm.primitives.js",
                 "jit.js", "vm.display.js", "vm.display.headless.js", "vm.input.js",
                 "vm.input.headless.js", "vm.plugins.js", "vm.plugins.file.node"]) require(REPO + "/" + f);
Object.extend(Squeak, { vmPath: process.cwd() + path.sep, platformSubtype: "Node.js",
    osVersion: process.version, windowSystem: "none" });

function clasificar(m) {
    var bytes = m.bytes;
    var prim = m.methodPrimitiveIndex();
    var r = { limpios: 0, fullSucios: 0, embebidos: 0, remotos: 0, blockReturn: 0,
              thisContext: 0, raro: null };
    var pc = 0, endPC = 0, extA = 0, extB = 0, done = false;
    if (prim > 0) {
        if (bytes.length < 3 || bytes[0] !== 0xF8) { r.raro = "prim-sin-callPrimitive"; return r; }
        pc = 3;
        if (prim >= 256 && prim < 520) return r;         // quick prim: sin cuerpo
    }
    var n = 0;
    while (!done) {
        if (pc >= bytes.length) { if (!r.raro) r.raro = "fin-sin-return"; break; }
        if (n++ > 200000) { r.raro = "metodo-absurdo"; break; }
        var b = bytes[pc++];
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = extB * 256 + (v < 128 ? v : v - 256); continue; }
        var eB = extB, b2, b3, dist;
        extA = 0; extB = 0;
        if (b <= 0x51) { /* pushes cortos */ }
        else if (b === 0x52) { if (eB === 0) r.thisContext++; }
        else if (b === 0x53) { /* dup */ }
        else if (b >= 0x54 && b <= 0x57) { r.raro = "no-usado"; break; }
        else if (b >= 0x58 && b <= 0x5C) { done = pc > endPC; }
        else if (b === 0x5D || b === 0x5E) { r.blockReturn++; done = pc > endPC; }
        else if (b === 0x5F) { /* nop */ }
        else if (b <= 0xAF) { /* sends */ }
        else if (b <= 0xB7) { dist = (b & 7) + 1; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xD8) { /* pops/stores */ }
        else if (b <= 0xDF) { r.raro = "no-usado"; break; }
        else if (b === 0xE2 || b === 0xE3 || b === 0xE4 || b === 0xE5) { pc++; }
        else if (b === 0xE6) { r.raro = "no-usado-e6"; break; }
        else if (b === 0xE7) { pc++; }
        else if (b === 0xE8 || b === 0xE9) { pc++; }
        else if (b === 0xEA) { pc++; }
        else if (b === 0xEB) { pc++; }
        else if (b === 0xEC) { r.raro = "class-trap"; break; }
        else if (b === 0xED) { b2 = bytes[pc++]; dist = b2 + eB * 256; if (dist > 0 && pc + dist > endPC) endPC = pc + dist; }
        else if (b === 0xEE || b === 0xEF) { b2 = bytes[pc++]; dist = b2 + eB * 256; if (dist > 0 && pc + dist > endPC) endPC = pc + dist; }
        else if (b >= 0xF0 && b <= 0xF5) { pc++; }
        else if (b === 0xF6 || b === 0xF7) { r.raro = "no-usado"; break; }
        else if (b === 0xF8) { pc += 2; r.raro = "callPrim-en-medio"; }
        else if (b === 0xF9) {                            // pushFullClosure
            var byteB = bytes[pc + 1];                    // bytes[pc]=byteA, bytes[pc+1]=byteB
            if ((byteB >> 6 & 1) === 1) r.limpios++; else r.fullSucios++;
            pc += 2;
        }
        else if (b === 0xFA) {                            // pushClosureCopy (bloque embebido)
            b2 = bytes[pc++]; b3 = bytes[pc++];
            var blockSize = b3 + (eB << 8);
            r.embebidos++;
            if (pc + blockSize > endPC) endPC = pc + blockSize;   // igual que jit.js:1294
        }
        else if (b >= 0xFB && b <= 0xFD) { pc += 2; r.remotos++; }
        else { r.raro = "desconocido"; break; }
    }
    return r;
}

fs.readFile(fullName, function (error, data) {
    if (error) { console.error("no pude leer la imagen", error); process.exit(1); }
    const image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function () {
        const vm = new Squeak.Interpreter(image,
            { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] });
        self.__vm = vm;
        const vistos = new Set();
        let tot = 0, sinBloques = 0, soloLimpios = 0, conSucios = 0, raros = 0;
        let totLimpios = 0, totEmbebidos = 0, totFullSucios = 0;
        const ejemplos = [];
        vm.allMethodsDo(function (classObj, m, selObj) {
            if (vistos.has(m)) return; vistos.add(m);
            if (!m.methodSignFlag || !m.methodSignFlag() || !m.bytes) return;
            tot++;
            const r = clasificar(m);
            if (r.raro) { raros++; return; }
            totLimpios += r.limpios; totEmbebidos += r.embebidos; totFullSucios += r.fullSucios;
            const sucio = r.fullSucios + r.embebidos + r.remotos + r.blockReturn;
            if (!sucio && !r.limpios) sinBloques++;
            else if (!sucio && r.limpios) {
                soloLimpios++;
                if (ejemplos.length < 10)
                    ejemplos.push(classObj.className() + ">>" +
                        (selObj && selObj.bytesAsString ? selObj.bytesAsString() : "?"));
            } else conSucios++;
        });
        console.log("imagen: " + path.basename(fullName));
        console.log("  métodos Sista con bytes:          " + tot + (raros ? "  (" + raros + " no decodificables)" : ""));
        console.log("  sin ningún bloque:                " + sinBloques + "  (" + (100*sinBloques/tot).toFixed(1) + "%)");
        console.log("  SOLO clean blocks (se ganarían):  " + soloLimpios + "  (" + (100*soloLimpios/tot).toFixed(1) + "%)");
        console.log("  con al menos un bloque que captura: " + conSucios + "  (" + (100*conSucios/tot).toFixed(1) + "%)");
        console.log("  bytecodes de bloque en total: limpios=" + totLimpios +
                    " fullSucios=" + totFullSucios + " embebidos(Cuis)=" + totEmbebidos);
        if (ejemplos.length) console.log("  ejemplos de solo-limpios:\n    " + ejemplos.join("\n    "));
        else console.log("  (esta imagen NO emite clean blocks)");
        process.exit(0);
    });
});
