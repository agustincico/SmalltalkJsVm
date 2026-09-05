// CAZADOR DE TRAMPAS: verifica sobre la imagen cargada el invariante
//   "typeof slot === 'number'  =>  entero de 31 bits en rango SmallInteger"
// del que dependen TODOS los fast-paths typeof-number del jit (y del codegen directo).
// Ademas: censo de Floats boxed, chars, y un ejemplo de literal Float en un metodo.
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

fs.readFile(fullName, function(error, data) {
    if (error) { console.error("No pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(fullName);
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [Squeak.vmPath, fullName] };
        var vm = new Squeak.Interpreter(image, display);

        console.log("== constantes del VM ==");
        console.log("MaxSmallInt", Squeak.MaxSmallInt, "MinSmallInt", Squeak.MinSmallInt,
            "NonSmallInt", Squeak.NonSmallInt);
        console.log("Context_sender", Squeak.Context_sender,
            "Context_receiver", Squeak.Context_receiver,
            "Context_tempFrameStart", Squeak.Context_tempFrameStart,
            "Context_smallFrameSize", Squeak.Context_smallFrameSize,
            "Context_largeFrameSize", Squeak.Context_largeFrameSize,
            "Context_closure(=BlockContext_initialIP)", Squeak.Context_closure, Squeak.BlockContext_initialIP);
        console.log("imagen: spur=" + image.isSpur + " 64bit=" + !!image.is64Bit + " (hasClosures=" + image.hasClosures + ")");

        // --- escaneo del heap viejo entero ---
        var nObjs = 0, nSlotsNum = 0, noEnteros = 0, fueraDeRango = 0, negZero = 0,
            nFloats = 0, nUndef = 0, nNull = 0, nBoolJS = 0, nStringJS = 0,
            ejemplos = [];
        var obj = image.firstOldObject;
        while (obj) {
            nObjs++;
            if (obj.isFloat) nFloats++;
            var body = obj.pointers;
            if (body) for (var i = 0; i < body.length; i++) {
                var v = body[i];
                var t = typeof v;
                if (t === "number") {
                    nSlotsNum++;
                    if (!Number.isInteger(v)) { noEnteros++; if (ejemplos.length < 5) ejemplos.push(["noEntero", v, obj.sqClass && obj.sqClass.className && obj.sqClass.className()]); }
                    else if (v < Squeak.MinSmallInt || v > Squeak.MaxSmallInt) { fueraDeRango++; if (ejemplos.length < 5) ejemplos.push(["fueraDeRango", v, obj.sqClass && obj.sqClass.className && obj.sqClass.className()]); }
                    if (Object.is(v, -0)) negZero++;
                } else if (t === "undefined") { nUndef++; if (ejemplos.length < 5) ejemplos.push(["undefined", i, obj.sqClass && obj.sqClass.className && obj.sqClass.className()]); }
                else if (v === null) nNull++;
                else if (t === "boolean") nBoolJS++;
                else if (t === "string") nStringJS++;
            }
            obj = obj.nextObject;
        }
        console.log("\n== heap viejo ==");
        console.log("objetos:", nObjs, "| slots number:", nSlotsNum,
            "| NO enteros:", noEnteros, "| fuera de rango SmallInt:", fueraDeRango,
            "| -0:", negZero);
        console.log("floats boxed:", nFloats, "| undefined:", nUndef, "| null:", nNull,
            "| bool JS:", nBoolJS, "| string JS:", nStringJS);
        if (ejemplos.length) console.log("ejemplos:", JSON.stringify(ejemplos));

        // --- literales Float en CompiledMethods: representacion ---
        var floatLits = 0, ejemploLit = null, charLits = 0, largeLits = 0;
        vm.allMethodsDo(function(cls, method, selector) {
            var lits = method.pointers;
            if (!lits) return;
            for (var i = 1; i < lits.length; i++) {
                var l = lits[i];
                if (l && typeof l === "object") {
                    if (l.isFloat) {
                        floatLits++;
                        if (!ejemploLit) {
                            ejemploLit = cls.className() + ">>" + selector.bytesAsString() +
                                " lit[" + i + "] = objeto isFloat, .float=" + l.float +
                                ", typeof=" + typeof l + ", sqClass=" + (l.sqClass && l.sqClass.className());
                        }
                    } else if (l.sqClass === vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger] ||
                               l.sqClass === vm.specialObjects[Squeak.splOb_ClassLargeNegativeInteger]) largeLits++;
                }
            }
        });
        console.log("\n== literales de metodos ==");
        console.log("literales Float (boxed):", floatLits, "| literales LargeInteger:", largeLits);
        if (ejemploLit) console.log("ejemplo:", ejemploLit);

        // caracteres inmediatos: identidad via characterTable
        var c1 = image.getCharacter ? image.getCharacter(65) : null;
        var c2 = image.getCharacter ? image.getCharacter(65) : null;
        console.log("\ngetCharacter(65) identidad estable:", c1 === c2, "| typeof:", typeof c1);

        // frame sizes reales de un contexto alocado
        var ctxS = vm.allocateOrRecycleContext(false), ctxL = vm.allocateOrRecycleContext(true);
        console.log("context chico pointers.length =", ctxS.pointers.length,
            "| grande =", ctxL.pointers.length,
            "| esperado chico=TFS+16=" + (Squeak.Context_tempFrameStart + Squeak.Context_smallFrameSize),
            "grande=TFS+56=" + (Squeak.Context_tempFrameStart + Squeak.Context_largeFrameSize));

        // slots de un contexto RECICLADO: que basura queda al reciclar
        // simulo: lleno el contexto, lo reciclo, lo vuelvo a pedir
        var marca = { soyBasura: true };
        for (var i = 0; i < ctxS.pointers.length; i++) ctxS.pointers[i] = marca;
        vm.recycleIfPossible(ctxS);
        var otraVez = vm.allocateOrRecycleContext(false);
        var basura = 0;
        for (var i = 0; i < otraVez.pointers.length; i++) if (otraVez.pointers[i] === marca) basura++;
        console.log("contexto reciclado: mismo objeto:", otraVez === ctxS,
            "| slots con basura previa:", basura, "de", otraVez.pointers.length,
            "| pointers[0] (link de free list) =", typeof otraVez.pointers[0],
            otraVez.pointers[0] === marca ? "(basura)" : "(era el link, pisado o nil)");
        process.exit(0);
    });
});
