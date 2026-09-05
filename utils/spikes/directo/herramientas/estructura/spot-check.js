// Spot-check del parser estructural contra metodos conocidos.
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);
Object.assign(global, { self: new Proxy({}, { get: (o,p)=>global[p], set:(o,p,v)=>{global[p]=v;return true;} }) });
Object.assign(self, {
    localStorage: {},
    WebSocket: typeof WebSocket === "undefined" ? require(REPO + "/lib_node/WebSocket") : WebSocket,
    sha1: require(REPO + "/lib/sha1"),
    btoa: s => Buffer.from(s, "ascii").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("ascii"),
});
require(REPO + "/globals.js"); require(REPO + "/vm.js"); require(REPO + "/vm.object.js");
require(REPO + "/vm.object.spur.js"); require(REPO + "/vm.image.js"); require(REPO + "/vm.interpreter.js");
require(REPO + "/vm.interpreter.proxy.js"); require(REPO + "/vm.instruction.stream.js");
require(REPO + "/vm.instruction.stream.sista.js"); require(REPO + "/vm.instruction.printer.js");
require(REPO + "/vm.primitives.js"); require(REPO + "/jit.js"); require(REPO + "/vm.display.js");
require(REPO + "/vm.display.headless.js"); require(REPO + "/vm.input.js"); require(REPO + "/vm.input.headless.js");
require(REPO + "/vm.plugins.js"); require(REPO + "/vm.plugins.file.node");
Object.extend(Squeak, { vmPath: process.cwd() + path.sep, platformSubtype: "Node.js",
    osVersion: process.version, windowSystem: "none" });
const { analizar, decodificar, profundidades } = require("./estructura-lib.js");

const OBJETIVOS = ["Integer>>benchFib", "Integer>>benchmark", "SequenceableCollection>>do:",
                   "Dictionary>>at:ifAbsent:", "Set>>findElementOrNil:"];
fs.readFile(fullName, function(error, data) {
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display);
        vm.allMethodsDo(function(cls, method, selector) {
            var nombre;
            try { nombre = cls.className() + ">>" + selector.bytesAsString(); } catch (e) { return; }
            if (OBJETIVOS.indexOf(nombre) < 0) return;
            var a = analizar(method);
            var d = decodificar(method);
            console.log(nombre + ": " + (a.ok ? JSON.stringify(a.stats) : "BAIL " + a.motivo));
            if (d.instrs) {
                var prof = profundidades(d);
                console.log("  instrs=" + d.instrs.length + " fin=" + d.fin +
                    (prof.ok ? " profundidades-ok" : " PROF-MAL:" + prof.motivo));
            }
        });
        process.exit(0);
    });
});
