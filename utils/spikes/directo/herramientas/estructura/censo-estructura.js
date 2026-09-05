// CENSO DE RECONSTRUCCION ESTRUCTURADA (Diseñador B): sobre los metodos ELEGIBLES
// (motivos() vacio, mismo criterio R2 del censo estatico), ¿cuantos se dejan
// reconstruir como if/while/for de JS reales por el parser recursivo de
// estructura-lib.js, y por que fallan los que fallan?
//
// Uso: node censo-estructura.js <imagen.image> [--json salida.json]
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

const { escanearMetodo, motivos } = require("../censo/censo-lib.js");
const { analizar } = require("./estructura-lib.js");

fs.readFile(fullName, function(error, data) {
    if (error) { console.error("No pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;

        var vistos = new Set();
        var st = {
            imagen: path.basename(fullName),
            unicos: 0, noSista: 0, sinBytes: 0, elegibles: 0,
            match: 0, bail: 0,
            bailPor: {}, bailEjemplos: {},
            // subset con loops
            elegConLoop: 0, matchConLoop: 0,
            loops: 0, diamantes: 0, ifPlanos: 0, breaksCond: 0, breaksIncond: 0,
            breaksAExterno: 0, multiExit: 0, continues: 0, anidamientoMax: 0, anidamientoHisto: {},
            headerDepthHisto: {},   // profundidad de pila en el header del loop
            metodosHeaderDepthPos: [], // ejemplos con depth>0 en un header
            loopsPorMetodoHisto: {},
            ejemplosMatchLoop: [],
        };

        vm.allMethodsDo(function(cls, method, selector) {
            if (vistos.has(method)) return;
            vistos.add(method);
            st.unicos++;
            if (!method.methodSignFlag()) { st.noSista++; return; }
            if (!method.bytes || !method.bytes.length) { st.sinBytes++; return; }
            var r = escanearMetodo(method);
            if (motivos(r).length !== 0) return;      // solo elegibles (criterio R2)
            st.elegibles++;
            var nombre;
            try { nombre = cls.className() + ">>" + selector.bytesAsString(); }
            catch (e) { nombre = "?>>?"; }
            var a = analizar(method);
            var tieneLoop = r.backJump > 0;
            if (tieneLoop) st.elegConLoop++;
            if (a.ok) {
                st.match++;
                var s = a.stats;
                st.loops += s.loops; st.diamantes += s.diamantes; st.ifPlanos += s.ifPlanos;
                st.breaksCond += s.breaksCond; st.breaksIncond += s.breaksIncond;
                st.breaksAExterno += s.breaksAExterno; st.multiExit += s.multiExit;
                st.continues += s.continues;
                if (s.loops) {
                    st.matchConLoop++;
                    st.anidamientoHisto[s.anidamientoMax] = (st.anidamientoHisto[s.anidamientoMax] || 0) + 1;
                    if (s.anidamientoMax > st.anidamientoMax) st.anidamientoMax = s.anidamientoMax;
                    st.loopsPorMetodoHisto[s.loops] = (st.loopsPorMetodoHisto[s.loops] || 0) + 1;
                    for (var hd = 0; hd < s.headerDepths.length; hd++) {
                        var k = s.headerDepths[hd];
                        st.headerDepthHisto[k] = (st.headerDepthHisto[k] || 0) + 1;
                        if (k > 0 && st.metodosHeaderDepthPos.length < 15)
                            st.metodosHeaderDepthPos.push(nombre + " (depth " + k + ")");
                    }
                    if (st.ejemplosMatchLoop.length < 12)
                        st.ejemplosMatchLoop.push(nombre + " (loops=" + s.loops + " anid=" + s.anidamientoMax +
                            " brkCond=" + s.breaksCond + " brkIncond=" + s.breaksIncond + ")");
                }
            } else {
                st.bail++;
                st.bailPor[a.motivo] = (st.bailPor[a.motivo] || 0) + 1;
                (st.bailEjemplos[a.motivo] = st.bailEjemplos[a.motivo] || []);
                if (st.bailEjemplos[a.motivo].length < 12) st.bailEjemplos[a.motivo].push(nombre);
            }
        });

        function pct(n, d2) { return d2 ? (100 * n / d2).toFixed(2) + "%" : "-"; }
        console.log("==============================================================");
        console.log("CENSO ESTRUCTURAL (Diseñador B) — " + st.imagen);
        console.log("==============================================================");
        console.log("metodos unicos: " + st.unicos + "  (no-sista: " + st.noSista + ", sin bytes: " + st.sinBytes + ")");
        console.log("elegibles (criterio R2, motivos() vacio): " + st.elegibles);
        console.log("");
        console.log("MATCH estructurado completo: " + st.match + "  (" + pct(st.match, st.elegibles) + " de los elegibles)");
        console.log("BAIL (necesitan fallback):   " + st.bail + "  (" + pct(st.bail, st.elegibles) + ")");
        console.log("");
        console.log("subset con loops: elegibles " + st.elegConLoop + " | match " + st.matchConLoop +
            "  (" + pct(st.matchConLoop, st.elegConLoop) + ")");
        console.log("");
        console.log("-- motivos de bail --");
        Object.keys(st.bailPor).sort(function(a,b){ return st.bailPor[b]-st.bailPor[a]; }).forEach(function(k) {
            console.log("  " + k + ": " + st.bailPor[k]);
            console.log("      ej: " + st.bailEjemplos[k].slice(0, 6).join(", "));
        });
        console.log("");
        console.log("-- inventario estructural de los que matchean --");
        console.log("loops: " + st.loops + " | diamantes if/else: " + st.diamantes + " | ifs planos: " + st.ifPlanos);
        console.log("breaks condicionales: " + st.breaksCond + " (a loop EXTERNO = labeled break: " + st.breaksAExterno + ")");
        console.log("breaks incondicionales: " + st.breaksIncond + " | loops multi-exit: " + st.multiExit + " | continues (multi-latch): " + st.continues);
        console.log("anidamiento de loops max: " + st.anidamientoMax + "  histo: " + JSON.stringify(st.anidamientoHisto));
        console.log("loops por metodo: " + JSON.stringify(st.loopsPorMetodoHisto));
        console.log("profundidad de pila en headers de loop: " + JSON.stringify(st.headerDepthHisto));
        if (st.metodosHeaderDepthPos.length)
            console.log("  con depth>0 en header: " + st.metodosHeaderDepthPos.join(" | "));
        console.log("");
        console.log("-- ejemplos con loops que matchean --");
        st.ejemplosMatchLoop.forEach(function(e) { console.log("  " + e); });
        if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(st, null, 2)); console.log("\n[json en " + jsonOut + "]"); }
        process.exit(0);
    });
});
