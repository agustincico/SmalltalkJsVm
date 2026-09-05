// CENSO del vocabulario SISTA sobre una imagen, para el codegen directo.
// Carga la imagen SIN correrla, recorre todos los metodos instalados, decodifica
// con un decoder espejo de vm.instruction.stream.sista.js, verifica el modelo de
// profundidad de pila ESTATICA por pc (interpretacion abstracta con worklist), y
// clasifica elegibilidad. Solo lectura del repo; imagen copiada al scratchpad.
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
const fullName = path.resolve(process.argv[2]);
const root = path.dirname(fullName) + path.sep;
const imageName = path.basename(fullName, ".image");

Object.assign(global, {
    self: new Proxy({}, {
        get: (o, p) => global[p],
        set: (o, p, v) => { global[p] = v; return true; },
    }),
});
Object.assign(self, {
    localStorage: {},
    WebSocket: null,
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
require(REPO + "/vm.display.js");
require(REPO + "/vm.display.headless.js");
require(REPO + "/vm.input.js");
require(REPO + "/vm.input.headless.js");
require(REPO + "/vm.plugins.js");

// ---- decoder espejo del set sista ------------------------------------------
// devuelve {fin, kind, net, dests:[], terminal, fallthrough} o null (ilegal)
// net = efecto neto de pila; dests = destinos de salto (ademas del fallthrough)
// specialSelectors argCounts (indices 0-31): binarios 0-15 => 1 arg salvo:
const SPECIAL_ARGC = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, // + - < > <= >= = ~= * / \\ @ bitShift: // bitAnd: bitOr:
                      1,2,0,0,1,0,1,0,1,0,1,1,0,1,0,0]; // at: at:put: size next nextPut: atEnd == class blockCopy: value value: do: new new: x y
function decode(bytes, pc0) {
    var pc = pc0, extA = 0, extB = 0, nExt = 0;
    for (;;) {
        var b = bytes[pc++];
        if (b === 0xE0) { extA = (extA << 8) + bytes[pc++]; nExt++; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = (extB << 8) + (v < 128 ? v : v - 256); nExt++; continue; }
        var r = { fin: 0, kind: null, net: 0, dests: [], terminal: false, ext: nExt };
        if (b <= 0x0F) { r.kind = "pushInst"; r.net = 1; }
        else if (b <= 0x1F) { r.kind = "pushLitVar"; r.net = 1; }
        else if (b <= 0x3F) { r.kind = "pushLit"; r.net = 1; }
        else if (b <= 0x4B) { r.kind = "pushTemp"; r.net = 1; }
        else if (b === 0x4C) { r.kind = "pushRcvr"; r.net = 1; }
        else if (b <= 0x51) { r.kind = "pushConst"; r.net = 1; }
        else if (b === 0x52) { r.kind = extB === 1 ? "pushThisProcess" : "pushThisContext"; r.net = 1; }
        else if (b === 0x53) { r.kind = "dup"; r.net = 1; }
        else if (b <= 0x57) { r.kind = "UNUSED"; }
        else if (b <= 0x5B) { r.kind = "returnConst"; r.terminal = true; }
        else if (b === 0x5C) { r.kind = "returnTop"; r.net = -1; r.terminal = true; }
        else if (b === 0x5D) { r.kind = "blockReturnNil"; r.terminal = true; }
        else if (b === 0x5E) { r.kind = "blockReturnTop"; r.net = -1; r.terminal = true; }
        else if (b === 0x5F) { r.kind = "nop"; }
        else if (b <= 0x6F) { r.kind = "specialNum"; r.sel = b & 0xF; r.net = -1; }
        else if (b <= 0x7F) { r.kind = "specialQuick"; r.sel = (b & 0xF) + 16; r.net = -SPECIAL_ARGC[(b & 0xF) + 16]; }
        else if (b <= 0x8F) { r.kind = "send"; r.numArgs = 0; r.net = 0; }
        else if (b <= 0x9F) { r.kind = "send"; r.numArgs = 1; r.net = -1; }
        else if (b <= 0xAF) { r.kind = "send"; r.numArgs = 2; r.net = -2; }
        else if (b <= 0xB7) { r.kind = "jump"; r.dests = [pc + (b & 7) + 1]; r.terminal = true; }
        else if (b <= 0xBF) { r.kind = "jumpTrue"; r.net = -1; r.dests = [pc + (b & 7) + 1]; }
        else if (b <= 0xC7) { r.kind = "jumpFalse"; r.net = -1; r.dests = [pc + (b & 7) + 1]; }
        else if (b <= 0xCF) { r.kind = "popIntoInst"; r.net = -1; }
        else if (b <= 0xD7) { r.kind = "popIntoTemp"; r.net = -1; }
        else if (b === 0xD8) { r.kind = "pop"; r.net = -1; }
        else if (b === 0xD9) { r.kind = "trap"; r.terminal = true; }
        else if (b <= 0xDF) { r.kind = "UNUSED"; }
        else if (b === 0xE2) { pc++; r.kind = "pushInst"; r.net = 1; }
        else if (b === 0xE3) { pc++; r.kind = "pushLitVar"; r.net = 1; }
        else if (b === 0xE4) { pc++; r.kind = "pushLit"; r.net = 1; }
        else if (b === 0xE5) { pc++; r.kind = "pushTemp"; r.net = 1; }
        else if (b === 0xE6) { r.kind = "UNUSED"; }
        else if (b === 0xE7) { var b2 = bytes[pc++];
            if (b2 < 128) { r.kind = "pushNewArrayEmpty"; r.net = 1; }
            else { r.kind = "popIntoNewArray"; r.count = b2 - 128; r.net = 1 - (b2 - 128); } }
        else if (b === 0xE8) { pc++; r.kind = "pushConst"; r.net = 1; }
        else if (b === 0xE9) { pc++; r.kind = "pushChar"; r.net = 1; }
        else if (b === 0xEA) { var b2 = bytes[pc++]; r.kind = "send"; r.numArgs = (b2 & 7) + (extB << 3); r.net = -r.numArgs; }
        else if (b === 0xEB) { var b2 = bytes[pc++];
            if (extB >= 64) { r.kind = "superDirected"; r.numArgs = (b2 & 7) + ((extB & 63) << 3); r.net = -r.numArgs - 1; }
            else { r.kind = "superSend"; r.numArgs = (b2 & 7) + (extB << 3); r.net = -r.numArgs; } }
        else if (b === 0xEC) { r.kind = "classTrap"; }
        else if (b === 0xED) { var b2 = bytes[pc++]; r.kind = "jump"; r.dests = [pc + b2 + (extB << 8)]; r.terminal = true; }
        else if (b === 0xEE) { var b2 = bytes[pc++]; r.kind = "jumpTrue"; r.net = -1; r.dests = [pc + b2 + (extB << 8)]; }
        else if (b === 0xEF) { var b2 = bytes[pc++]; r.kind = "jumpFalse"; r.net = -1; r.dests = [pc + b2 + (extB << 8)]; }
        else if (b === 0xF0) { pc++; r.kind = "popIntoInst"; r.net = -1; }
        else if (b === 0xF1) { pc++; r.kind = "popIntoLitVar"; r.net = -1; }
        else if (b === 0xF2) { pc++; r.kind = "popIntoTemp"; r.net = -1; }
        else if (b === 0xF3) { pc++; r.kind = "storeInst"; }
        else if (b === 0xF4) { pc++; r.kind = "storeLitVar"; }
        else if (b === 0xF5) { pc++; r.kind = "storeTemp"; }
        else if (b <= 0xF7) { r.kind = "UNUSED"; }
        else if (b === 0xF8) { pc += 2; r.kind = "callPrimitive"; }
        else if (b === 0xF9) { var b2 = bytes[pc++], b3 = bytes[pc++];
            r.kind = "pushFullClosure"; r.numCopied = b3 & 63; r.net = 1 - r.numCopied; }
        else if (b === 0xFA) { var b2 = bytes[pc++], b3 = bytes[pc++];
            r.kind = "closureCopy";
            r.numCopied = ((b2 >> 3) & 7) + Math.floor(extA / 16) * 8;
            r.blockSize = b3 + (extB << 8);
            r.net = 1 - r.numCopied;
            r.dests = [pc + r.blockSize];   // continua despues del cuerpo
            r.blockFrom = pc;
            r.terminal = true; }            // el fallthrough es el cuerpo del bloque, otra activacion
        else if (b === 0xFB) { pc += 2; r.kind = "remotePushTemp"; r.net = 1; }
        else if (b === 0xFC) { pc += 2; r.kind = "remoteStoreTemp"; }
        else if (b === 0xFD) { pc += 2; r.kind = "remotePopIntoTemp"; r.net = -1; }
        else { r.kind = "UNUSED"; }
        r.fin = pc;
        return r;
    }
}

// familias que descalifican un metodo para la forma directa (v1 estricta)
const DESCALIFICA = new Set(["pushThisContext", "pushThisProcess", "pushFullClosure", "closureCopy",
    "pushNewArrayEmpty", "remotePushTemp", "remoteStoreTemp", "remotePopIntoTemp",
    "blockReturnNil", "blockReturnTop", "callPrimitive", "trap", "classTrap", "UNUSED"]);

fs.readFile(root + imageName + ".image", function(error, data) {
    if (error) { console.error("no pude leer la imagen", error); process.exit(1); }
    var image = new Squeak.Image(root + imageName + ".image");
    image.readFromBuffer(data.buffer, function() {
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"], argv: [] };
        var vm = new Squeak.Interpreter(image, display);
        var familias = {}, familiasEnElegibles = {};
        var nMetodos = 0, nSista = 0, nV3 = 0, nPrim = 0, nPrimQuick = 0, nPrim117 = 0;
        var errores = 0, ejemploError = null;
        var depthOK = 0, depthBad = 0, ejemplosDepthBad = [];
        var sendsTotal = 0, sendsEnLabel = 0;
        var maxDepthGlobal = 0, sumMaxDepth = 0, nConDepth = 0;
        var elegibles = 0, conPrim = 0, conClosure = 0, conCtx = 0, conOtroDesc = 0;
        var elegiblesYchicos = 0;
        var porRazon = {};
        var muestraElegibles = [], muestraDescalificados = [];

        vm.allMethodsDo(function(classObj, methodObj, selectorObj) {
            if (!methodObj.isMethod || !methodObj.isMethod()) return;
            nMetodos++;
            if (!methodObj.methodSignFlag()) { nV3++; return; }
            nSista++;
            var prim = methodObj.methodPrimitiveIndex();
            if (prim > 0) { nPrim++; if (prim > 255 && prim < 520) nPrimQuick++; if (prim === 117) nPrim117++; }
            var bytes = methodObj.bytes;
            var quickPrim = prim > 255 && prim < 520;
            var razones = new Set();
            if (prim > 0 && !quickPrim) razones.add("primitiva");
            if (quickPrim) razones.add("quick-prim");
            // decodificar linealmente todo el rango de bytecodes
            var insns = {}, pc = 0, endPC = bytes.length;
            // los quick prims no tienen cuerpo util; el trailer arranca en pc 0
            var decodeFailed = false;
            if (!quickPrim) {
                // el trailer (source pointer) esta al final; para no meternos en el,
                // frenamos al pasar el ultimo pc alcanzable: hacemos como el jit,
                // decodificamos hasta cubrir el mayor destino visto o hasta un terminal
                var done = false, maxTarget = 0;
                while (!done && pc < bytes.length) {
                    var ins = decode(bytes, pc);
                    if (!ins || !ins.kind) { decodeFailed = true; break; }
                    insns[pc] = ins;
                    familias[ins.kind] = (familias[ins.kind] || 0) + 1;
                    if (DESCALIFICA.has(ins.kind)) razones.add(ins.kind);
                    for (var d = 0; d < ins.dests.length; d++)
                        if (ins.dests[d] > maxTarget) maxTarget = ins.dests[d];
                    if (ins.kind === "closureCopy" && ins.dests[0] > maxTarget) maxTarget = ins.dests[0];
                    pc = ins.fin;
                    if (ins.terminal && ins.dests.length === 0 && pc > maxTarget) done = true;
                }
                if (decodeFailed) { errores++; if (!ejemploError) ejemploError = classObj.className() + ">>" + selectorObj.bytesAsString(); razones.add("decode-error"); }
            } else {
                razones.add("sin-cuerpo");
            }

            // interpretacion abstracta de profundidad (solo si decodifico entero y
            // no hay closureCopy, cuyo cuerpo es otra activacion)
            var tieneCC = razones.has("closureCopy");
            if (!decodeFailed && !quickPrim) {
                var depth = {}, work = [[0, 0]], bad = false, maxD = 0;
                // etiquetas del jit clasico: destinos de salto + pc despues de
                // send/specialNum/specialQuick/jumpIf (needsLabel)
                var labeled = {};
                for (var p in insns) {
                    var i2 = insns[p];
                    for (var d2 = 0; d2 < i2.dests.length; d2++) labeled[i2.dests[d2]] = true;
                    if (/^(send|superSend|superDirected|specialNum|specialQuick|jumpTrue|jumpFalse)$/.test(i2.kind))
                        labeled[i2.fin] = true;
                    if (i2.kind === "closureCopy") { labeled[i2.blockFrom] = true; labeled[i2.dests[0]] = true; }
                }
                while (work.length) {
                    var it = work.pop(), at = it[0], d0 = it[1];
                    if (depth[at] !== undefined) {
                        if (depth[at] !== d0) { bad = true; break; }
                        continue;
                    }
                    depth[at] = d0;
                    var ins2 = insns[at];
                    if (!ins2) { bad = true; break; } // salto al medio de una instruccion
                    var d1 = d0 + ins2.net;
                    if (d1 < 0 && !ins2.terminal) { bad = true; break; }
                    if (d1 > maxD) maxD = d1;
                    if (/^(send|superSend|superDirected)$/.test(ins2.kind)) {
                        sendsTotal++;
                        if (labeled[at]) sendsEnLabel++;
                    }
                    if (!ins2.terminal) work.push([ins2.fin, d1]);
                    for (var d3 = 0; d3 < ins2.dests.length; d3++) work.push([ins2.dests[d3], d1]);
                }
                if (bad) { depthBad++; if (ejemplosDepthBad.length < 8) ejemplosDepthBad.push(classObj.className() + ">>" + selectorObj.bytesAsString()); }
                else { depthOK++; sumMaxDepth += maxD; nConDepth++; if (maxD > maxDepthGlobal) maxDepthGlobal = maxD; }
            }

            razones.delete("sin-cuerpo");
            if (razones.size === 0) {
                elegibles++;
                if (bytes.length <= 60) elegiblesYchicos++;
                if (muestraElegibles.length < 10) muestraElegibles.push(classObj.className() + ">>" + selectorObj.bytesAsString());
                for (var p2 in insns) {
                    var k2 = insns[p2].kind;
                    familiasEnElegibles[k2] = (familiasEnElegibles[k2] || 0) + 1;
                }
            } else {
                razones.forEach(function(rz) { porRazon[rz] = (porRazon[rz] || 0) + 1; });
                if (razones.has("primitiva") || razones.has("quick-prim")) conPrim++;
                else if (razones.has("pushFullClosure") || razones.has("closureCopy") || razones.has("pushNewArrayEmpty")
                        || razones.has("remotePushTemp") || razones.has("remoteStoreTemp") || razones.has("remotePopIntoTemp")
                        || razones.has("blockReturnNil") || razones.has("blockReturnTop")) conClosure++;
                else if (razones.has("pushThisContext") || razones.has("pushThisProcess")) conCtx++;
                else { conOtroDesc++; if (muestraDescalificados.length < 10) muestraDescalificados.push(classObj.className() + ">>" + selectorObj.bytesAsString() + " " + Array.from(razones).join(",")); }
            }
        });

        console.log("== censo sobre " + imageName + " ==");
        console.log("metodos instalados: " + nMetodos + " | sista: " + nSista + " | v3: " + nV3);
        console.log("con primitiva: " + nPrim + " (quick 256-519: " + nPrimQuick + ", prim 117 named: " + nPrim117 + ")");
        console.log("errores de decode: " + errores + (ejemploError ? " (ej: " + ejemploError + ")" : ""));
        console.log("");
        console.log("-- verificacion de profundidad estatica (metodos sista con cuerpo) --");
        console.log("consistentes: " + depthOK + " | INCONSISTENTES: " + depthBad);
        ejemplosDepthBad.forEach(function(e) { console.log("   inconsistente: " + e); });
        console.log("profundidad maxima de operandos vista: " + maxDepthGlobal +
            " | promedio de maximos: " + (sumMaxDepth / Math.max(1, nConDepth)).toFixed(2));
        console.log("");
        console.log("-- sends y etiquetas del jit clasico --");
        console.log("sends totales (send/super/superDirected, estaticos, alcanzables): " + sendsTotal);
        console.log("sends cuyo PROPIO pc tiene etiqueta en el jit clasico: " + sendsEnLabel +
            " (" + (100 * sendsEnLabel / Math.max(1, sendsTotal)).toFixed(1) + "%)");
        console.log("");
        console.log("-- elegibilidad v1 (sin prim, sin closures/ctx/remote/callPrim/trap) --");
        console.log("elegibles: " + elegibles + " de " + nSista + " (" + (100 * elegibles / Math.max(1, nSista)).toFixed(1) + "%)" +
            " | elegibles de <=60 bytes: " + elegiblesYchicos);
        console.log("descalificados: prim=" + conPrim + " closure=" + conClosure + " thisContext/Process=" + conCtx + " otros=" + conOtroDesc);
        console.log("por razon:");
        Object.keys(porRazon).sort(function(a, b) { return porRazon[b] - porRazon[a]; })
            .forEach(function(k) { console.log("   " + porRazon[k] + "\t" + k); });
        console.log("ejemplos elegibles: " + muestraElegibles.join(", "));
        if (muestraDescalificados.length) console.log("ejemplos otros-descalificados:\n   " + muestraDescalificados.join("\n   "));
        console.log("");
        console.log("-- familias (ocurrencias estaticas, todos los metodos sista) --");
        Object.keys(familias).sort(function(a, b) { return familias[b] - familias[a]; })
            .forEach(function(k) { console.log("   " + familias[k] + "\t" + k + (familiasEnElegibles[k] ? "\t(en elegibles: " + familiasEnElegibles[k] + ")" : "")); });
        process.exit(0);
    });
});
