// VERIFICADOR del censo: re-clasifica cada metodo usando Squeak.InstructionStreamSista
// (el decodificador del repo, el mismo que usa el disassembler) como segunda opinion,
// y compara con el escaner a mano de censo-elegibilidad.js. Reporta discrepancias.
//   node verificar-censo.js <imagen.image>
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
Object.extend(Squeak, { vmPath: process.cwd() + path.sep, platformSubtype: "Node.js",
    osVersion: "verif", windowSystem: "none" });

const censo = require("./censo-lib.js"); // escanearMetodo + motivos, compartido

// BUG LATENTE upstream: InstructionStreamSista usa this.mod/this.div en el caso 0xFA
// (pushClosureCopy) pero no existen en el prototipo -> TypeError en cualquier metodo
// con closure embebido. Parche local solo para poder verificar:
Squeak.InstructionStreamSista.prototype.mod = function(a, b) { return a % b; };
Squeak.InstructionStreamSista.prototype.div = function(a, b) { return Math.floor(a / b); };

// -- segunda opinion: cliente para InstructionStreamSista -----------------------
function clasificarConStream(vm, method) {
    var prim = method.methodPrimitiveIndex();
    var f = { prim: prim, closure: 0, newArray: 0, thisCtx: 0, superS: 0, back: 0, sends: 0, raro: null };
    if (prim >= 256 && prim < 520) return f;    // quick: sin cuerpo
    var stream = new Squeak.InstructionStreamSista(method, vm);
    var endPC = 0, done = false;
    var client = {
        pushReceiverVariable: function() {}, pushLiteralVariable: function() {},
        pushConstant: function() {}, pushTemporaryVariable: function() {},
        pushReceiver: function() {}, doDup: function() {}, doPop: function() {}, nop: function() {},
        pushActiveContext: function() { f.thisCtx++; },
        methodReturnReceiver: function() { done = stream.pc > endPC; },
        methodReturnConstant: function() { done = stream.pc > endPC; },
        methodReturnTop: function() { done = stream.pc > endPC; },
        blockReturnConstant: function() { f.closure++; done = stream.pc > endPC; },
        blockReturnTop: function() { f.closure++; done = stream.pc > endPC; },
        send: function(sel, argc, superFlag) { if (superFlag) f.superS++; else f.sends++; },
        sendSuperDirected: function() { f.superS++; },
        jump: function(dist) { if (dist <= 0) f.back++; else if (stream.pc + dist > endPC) endPC = stream.pc + dist; },
        jumpIf: function(cond, dist) { if (dist <= 0) f.back++; else if (stream.pc + dist > endPC) endPC = stream.pc + dist; },
        popIntoReceiverVariable: function() {}, popIntoTemporaryVariable: function() {},
        storeIntoReceiverVariable: function() {}, storeIntoTemporaryVariable: function() {},
        popIntoLiteralVariable: function() {}, storeIntoLiteralVariable: function() {},
        pushNewArray: function() { f.newArray++; }, popIntoNewArray: function() { f.newArray++; },
        callPrimitive: function() {},
        pushFullClosure: function() { f.closure++; },
        pushClosureCopy: function(numCopied, numArgs, blockSize) {
            f.closure++;
            if (stream.pc + blockSize > endPC) endPC = stream.pc + blockSize;
        },
        pushRemoteTemp: function() { f.closure++; },
        storeIntoRemoteTemp: function() { f.closure++; },
        popIntoRemoteTemp: function() { f.closure++; },
    };
    var pasos = 0;
    while (!done) {
        if (stream.pc >= method.bytes.length) { f.raro = "fin-sin-return"; break; }
        if (pasos++ > 200000) { f.raro = "absurdo"; break; }
        try { stream.interpretNextInstructionFor(client); }
        catch (e) { f.raro = "excepcion: " + e.message; break; }
    }
    return f;
}

function resumir(f, esCensoPropio) {
    // tupla comparable: [prim>0, closure>0, newArray>0, thisCtx>0, super>0, back>0, sends]
    if (esCensoPropio) {
        return [f.prim > 0, (f.fullClosure + f.closureCopy + f.remoteTemp + f.blockReturn) > 0,
            (f.newArrayVacio + f.newArrayPop) > 0, (f.thisContext + f.thisProcess) > 0,
            (f.superSend + f.superDirected) > 0, f.backJump > 0, f.sends, !!f.raro].join("|");
    }
    return [f.prim > 0, f.closure > 0, f.newArray > 0, f.thisCtx > 0,
        f.superS > 0, f.back > 0, f.sends, !!f.raro].join("|");
}

fs.readFile(fullName, function(error, data) {
    if (error) { console.error("No pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;
        var vistos = new Set(), total = 0, iguales = 0, distintos = [];
        vm.allMethodsDo(function(cls, method, selector) {
            if (vistos.has(method)) return; vistos.add(method);
            if (!method.methodSignFlag() || !method.bytes || !method.bytes.length) return;
            total++;
            var mio = censo.escanearMetodo(method);
            var otro = clasificarConStream(vm, method);
            var a = resumir(mio, true), b = resumir(otro, false);
            if (a === b) iguales++;
            else if (distintos.length < 20) {
                var nombre; try { nombre = cls.className() + ">>" + selector.bytesAsString(); } catch (e) { nombre = "?"; }
                distintos.push(nombre + "\n    censo:  " + a + "\n    stream: " + b);
            }
        });
        console.log("verificados: " + total + " | iguales: " + iguales + " | distintos: " + (total - iguales));
        distintos.forEach(function(d) { console.log("  " + d); });
        // y benchFib puntual
        var bf = vm.findMethod("Integer>>benchFib");
        if (bf) {
            var r = censo.escanearMetodo(bf);
            var mot = censo.motivos(r);
            console.log("\nInteger>>benchFib: motivos=[" + mot.join(",") + "] backJump=" + r.backJump +
                " super=" + (r.superSend + r.superDirected) + " sends=" + r.sends +
                " condJumps=" + r.condJumps + "  => " +
                (mot.length === 0 && !r.backJump && !(r.superSend + r.superDirected) ? "R0" : "NO-R0"));
            console.log(new Squeak.InstructionPrinter(bf, vm).printInstructions());
        }
        process.exit(total - iguales === 0 ? 0 : 1);
    });
});
