// CENSO ESTATICO DE ELEGIBILIDAD para la "forma directa" (ver utils/spikes/directo/).
// Carga una imagen con la maquinaria de SqueakJS SIN correrla, recorre todos los
// CompiledMethods via vm.allMethodsDo, escanea los bytecodes (set SISTA) y clasifica:
//   R0 = sin primitiva, sin closures, sin thisContext, sin super, sin saltos atras,
//        solo bytecodes de la lista OK (pushes/stores/dup/pop/sends/saltos adelante/
//        returns/aritmetica especial)
//   R1 = R0 + saltos hacia atras (loops)
//   R2 = R1 + super-sends
// y tabula el "por que" de cada rechazo.
//
// Uso:  node censo-elegibilidad.js <imagen.image> [--json salida.json]
//
// El escaner replica la semantica de jit.js generateSista / InstructionStreamSista:
// - extA/extB se acumulan con 0xE0/0xE1 y se resetean tras cada instruccion real
// - el fin del metodo es "return con pc > endPC", donde endPC = destino de salto
//   mas lejano visto (los bytes que siguen son el trailer del source pointer)
// - quick prims (256..519) no tienen cuerpo (jit.js generateCallPrimitive)
// - 0xFA (closure embebido) extiende endPC con blockSize y el cuerpo del bloque
//   se sigue escaneando (mismo set)
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);
const jsonOut = (function() { const i = process.argv.indexOf("--json"); return i > 0 ? process.argv[i+1] : null; })();

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

// escaner compartido (mismo codigo que usa verificar-censo.js)
const { escanearMetodo, motivos } = require("./censo-lib.js");

// ------------------------------------------------------------------- el censo ----
fs.readFile(fullName, function(error, data) {
    if (error) { console.error("No pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;

        var vistos = new Set();
        var stats = {
            imagen: path.basename(fullName),
            entradasDiccionario: 0, unicos: 0, noSista: 0, sinBytes: 0,
            R0: 0, R1: 0, R2: 0,
            conPrimitiva: 0, quickPrim: 0,
            primConCuerpoR0: 0, primConCuerpoR1: 0, primConCuerpoR2: 0,
            soloPor: {}, combos: {},
            conBackJump: 0, conSuper: 0, conClosure: 0, conFullClosure: 0, conClosureCopy: 0,
            conThisContext: 0, conThisProcess: 0, conNewArray: 0, conRaro: 0,
            rarosEjemplos: [],
            numArgsR0R1: {}, numTempsR0R1: {},
            r0Cero: 0,   // R0 sin ningun send (triviales: getters sin quick prim, etc)
        };
        var ejemplosR0 = [], ejemplosR1 = [];

        vm.allMethodsDo(function(cls, method, selector) {
            stats.entradasDiccionario++;
            if (vistos.has(method)) return;
            vistos.add(method);
            stats.unicos++;
            var nombre;
            try { nombre = cls.className() + ">>" + selector.bytesAsString(); }
            catch (e) { nombre = "?>>?"; }
            if (!method.methodSignFlag()) { stats.noSista++; return; }
            if (!method.bytes || !method.bytes.length) { stats.sinBytes++; return; }

            var r = escanearMetodo(method);
            var mot = motivos(r);
            var esR2 = mot.length === 0;
            var esR1 = esR2 && !r.superSend && !r.superDirected;
            var esR0 = esR1 && !r.backJump;

            if (r.prim > 0) {
                stats.conPrimitiva++;
                if (r.quickPrim) stats.quickPrim++;
                else {
                    // el cuerpo (fallback) estaria limpio si le resolvieramos la primitiva?
                    var motSinPrim = mot.filter(function(x) { return x !== "primitiva"; });
                    if (motSinPrim.length === 0) {
                        stats.primConCuerpoR2++;
                        if (!r.superSend && !r.superDirected) {
                            stats.primConCuerpoR1++;
                            if (!r.backJump) stats.primConCuerpoR0++;
                        }
                    }
                }
            }
            if (r.backJump) stats.conBackJump++;
            if (r.superSend || r.superDirected) stats.conSuper++;
            if (r.fullClosure || r.closureCopy || r.remoteTemp || r.blockReturn) stats.conClosure++;
            if (r.fullClosure) stats.conFullClosure++;
            if (r.closureCopy) stats.conClosureCopy++;
            if (r.thisContext) stats.conThisContext++;
            if (r.thisProcess) stats.conThisProcess++;
            if (r.newArrayVacio || r.newArrayPop) stats.conNewArray++;
            if (r.raro) {
                stats.conRaro++;
                if (stats.rarosEjemplos.length < 10) stats.rarosEjemplos.push(nombre + " [" + r.raro + "]");
            }

            if (esR2) {
                stats.R2++;
                if (esR1) {
                    stats.R1++;
                    if (esR0) {
                        stats.R0++;
                        if (r.sends === 0) stats.r0Cero++;
                    }
                    var na = method.methodNumArgs(), nt = method.methodTempCount() - na;
                    stats.numArgsR0R1[na] = (stats.numArgsR0R1[na] || 0) + 1;
                    stats.numTempsR0R1[nt] = (stats.numTempsR0R1[nt] || 0) + 1;
                }
                // ejemplos interesantes: con sends Y control de flujo
                if (esR0 && r.sends >= 3 && r.condJumps >= 1)
                    ejemplosR0.push({ nombre: nombre, sends: r.sends, condJumps: r.condJumps, bytes: r.cuerpoBytes });
                else if (esR1 && !esR0 && r.sends >= 3 && r.backJump >= 1)
                    ejemplosR1.push({ nombre: nombre, sends: r.sends, condJumps: r.condJumps, backJumps: r.backJump, bytes: r.cuerpoBytes });
            } else {
                if (mot.length === 1) {
                    var k = "solo-" + mot[0];
                    stats.soloPor[k] = (stats.soloPor[k] || 0) + 1;
                } else {
                    var ck = mot.join("+");
                    stats.combos[ck] = (stats.combos[ck] || 0) + 1;
                }
            }
        });

        ejemplosR0.sort(function(a, b) { return (b.sends + b.condJumps) - (a.sends + a.condJumps); });
        ejemplosR1.sort(function(a, b) { return (b.sends + b.condJumps) - (a.sends + a.condJumps); });

        var esc = stats.unicos - stats.noSista - stats.sinBytes; // escaneados
        function pct(n) { return (100 * n / esc).toFixed(1) + "%"; }
        console.log("=============================================================");
        console.log("CENSO DE ELEGIBILIDAD — " + stats.imagen);
        console.log("=============================================================");
        console.log("entradas en diccionarios de metodos: " + stats.entradasDiccionario);
        console.log("metodos unicos:                      " + stats.unicos);
        console.log("  no-sista (V3, no escaneados):      " + stats.noSista);
        console.log("  sin bytes:                         " + stats.sinBytes);
        console.log("  escaneados (base de los %):        " + esc);
        console.log("");
        console.log("R0 (sin prim/closure/thisContext/super/loops): " + stats.R0 + "  (" + pct(stats.R0) + ")");
        console.log("     de esos, sin ningun send (triviales):     " + stats.r0Cero);
        console.log("R1 (R0 + loops):                               " + stats.R1 + "  (" + pct(stats.R1) + ")");
        console.log("R2 (R1 + super):                               " + stats.R2 + "  (" + pct(stats.R2) + ")");
        console.log("");
        console.log("-- caracteristicas (no excluyentes, sobre escaneados) --");
        console.log("con primitiva:        " + stats.conPrimitiva + "  (" + pct(stats.conPrimitiva) + ")  [quick 256-519: " + stats.quickPrim + "]");
        console.log("con closure:          " + stats.conClosure + "  (" + pct(stats.conClosure) + ")  [full 0xF9: " + stats.conFullClosure + ", embebido 0xFA: " + stats.conClosureCopy + "]");
        console.log("con newArray (0xE7):  " + stats.conNewArray);
        console.log("con thisContext:      " + stats.conThisContext + "   con thisProcess: " + stats.conThisProcess);
        console.log("con super:            " + stats.conSuper);
        console.log("con salto atras:      " + stats.conBackJump);
        console.log("con bytecode raro:    " + stats.conRaro + (stats.rarosEjemplos.length ? "   ej: " + stats.rarosEjemplos.join(", ") : ""));
        console.log("");
        console.log("-- por que quedan afuera de R2 (motivos duros) --");
        Object.keys(stats.soloPor).sort(function(a,b){ return stats.soloPor[b]-stats.soloPor[a]; })
            .forEach(function(k) { console.log("  " + k + ": " + stats.soloPor[k]); });
        console.log("  combos (mas de un motivo):");
        Object.keys(stats.combos).sort(function(a,b){ return stats.combos[b]-stats.combos[a]; })
            .forEach(function(k) { console.log("    " + k + ": " + stats.combos[k]); });
        console.log("");
        console.log("-- rescatables: con primitiva pero cuerpo-fallback limpio --");
        console.log("  cuerpo R0: " + stats.primConCuerpoR0 + "   cuerpo R1: " + stats.primConCuerpoR1 + "   cuerpo R2: " + stats.primConCuerpoR2);
        console.log("");
        console.log("-- numArgs / numTemps(extra) de los R1 --");
        console.log("  numArgs:  " + JSON.stringify(stats.numArgsR0R1));
        console.log("  numTemps: " + JSON.stringify(stats.numTempsR0R1));
        console.log("");
        console.log("-- 15 ejemplos R0 interesantes (sends + saltos condicionales) --");
        ejemplosR0.slice(0, 15).forEach(function(e) {
            console.log("  " + e.nombre + "  (sends=" + e.sends + " condJumps=" + e.condJumps + " bytes=" + e.bytes + ")");
        });
        console.log("");
        console.log("-- 15 ejemplos R1 interesantes (con loops) --");
        ejemplosR1.slice(0, 15).forEach(function(e) {
            console.log("  " + e.nombre + "  (sends=" + e.sends + " condJumps=" + e.condJumps + " backJumps=" + e.backJumps + " bytes=" + e.bytes + ")");
        });
        if (jsonOut) {
            stats.ejemplosR0 = ejemplosR0.slice(0, 50);
            stats.ejemplosR1 = ejemplosR1.slice(0, 50);
            fs.writeFileSync(jsonOut, JSON.stringify(stats, null, 2));
            console.log("\n[json en " + jsonOut + "]");
        }
        process.exit(0);
    });
});
