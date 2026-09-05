// Genera con el JIT REAL (jit.js) el JS de Integer>>benchFib sobre la imagen
// cargada (sin correrla) y lo imprime, para ver que labels sobreviven.
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);
const root = path.dirname(fullName) + path.sep;
const imageName = path.basename(fullName, ".image");
Object.assign(global, {
    self: new Proxy({}, { get: (o, p) => global[p], set: (o, p, v) => { global[p] = v; return true; } }),
});
Object.assign(self, {
    localStorage: {}, WebSocket: null, sha1: require(REPO + "/lib/sha1"),
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

fs.readFile(root + imageName + ".image", function(error, data) {
    if (error) { console.error("error", error); process.exit(1); }
    var image = new Squeak.Image(root + imageName + ".image");
    image.readFromBuffer(data.buffer, function() {
        var vm = new Squeak.Interpreter(image, { vmOptions: [], argv: [] });
        // sin peephole/spLocal para ver el codigo base del codegen
        vm.jitPeephole = false; vm.jitSpLocal = false;
        var comp = new Squeak.Compiler(vm);
        var target = process.argv[3] || "Integer>>benchFib";
        var parts = target.split(">>");
        var found = null;
        vm.allMethodsDo(function(cls, m, sel) {
            if (cls.className() === parts[0] && sel.bytesAsString() === parts[1]) { found = m; return true; }
        });
        if (!found) { console.error("no encontrado: " + target); process.exit(1); }
        // reproducir lo que hace generate() pero imprimiendo el fuente
        comp.singleStep = false; comp.debug = true; comp.comments = true;
        var origFn = Function;
        var src = null;
        // interceptar: generate termina con new Function(source)(); capturamos el fuente
        var origGenerate = comp.generate.bind(comp);
        comp.method = found;
        comp.sista = found.methodSignFlag();
        comp.pc = 0; comp.endPC = 0; comp.prevPC = 0;
        comp.source = []; comp.sourceLabels = {}; comp.needsLabel = {};
        comp.sourcePos = {}; comp.needsVar = {}; comp.needsBreak = false;
        comp.instVarNames = null;
        comp.allVars = ['context', 'stack', 'rcvr', 'inst[', 'temp[', 'lit['];
        comp.sourcePos['context'] = comp.source.length; comp.source.push("var context = vm.activeContext;\n");
        comp.sourcePos['stack'] = comp.source.length; comp.source.push("var stack = vm.stack;\n");
        comp.sourcePos['rcvr'] = comp.source.length; comp.source.push("var rcvr = vm.receiver;\n");
        comp.sourcePos['inst['] = comp.source.length; comp.source.push("var inst = rcvr.pointers;\n");
        comp.sourcePos['temp['] = comp.source.length; comp.source.push("var temp = vm.temps;\n");
        comp.sourcePos['lit['] = comp.source.length; comp.source.push("var lit = vm.method.pointers;\n");
        comp.sourcePos['loop-start'] = comp.source.length; comp.source.push("while (true) switch (vm.pc) {\ncase 0:\n");
        if (comp.sista) comp.generateSista(found); else comp.generateV3(found);
        comp.sourcePos['loop-end'] = comp.source.length; comp.source.push("default: vm.interpretOne(true); return;\n}");
        comp.deleteUnneededLabels();
        comp.deleteUnneededVariables();
        console.log("=== " + target + " (labels vivos: " + Object.keys(comp.needsLabel).join(",") + ") ===");
        console.log(comp.source.join(""));
        process.exit(0);
    });
});
