// Escaner de bytecodes SISTA para el censo de elegibilidad (compartido entre
// censo-elegibilidad.js y verificar-censo.js). Ver censo-elegibilidad.js para docs.
"use strict";

function escanearMetodo(m) {
    var bytes = m.bytes;
    var prim = m.methodPrimitiveIndex();
    var r = {
        prim: prim,
        quickPrim: prim >= 256 && prim < 520,
        fullClosure: 0, closureCopy: 0, remoteTemp: 0,
        newArrayVacio: 0, newArrayPop: 0,
        thisContext: 0, thisProcess: 0,
        superSend: 0, superDirected: 0,
        backJump: 0, backCondJump: 0,
        blockReturn: 0,
        raro: null,
        sends: 0, sendsEspeciales: 0, jumps: 0, condJumps: 0,
        nInstr: 0, cuerpoBytes: 0,
    };
    var pc = 0, endPC = 0, extA = 0, extB = 0, done = false;
    if (prim > 0) {
        if (bytes.length < 3 || bytes[0] !== 0xF8) { r.raro = "prim-sin-callPrimitive"; return r; }
        pc = 3;
        if (r.quickPrim) return r;            // sin cuerpo: solo trailer despues
    }
    var inicio = pc;
    while (!done) {
        if (pc >= bytes.length) { if (!r.raro) r.raro = "fin-sin-return"; break; }
        if (r.nInstr++ > 200000) { r.raro = "metodo-absurdo"; break; }
        var b = bytes[pc++];
        // prefijos de extension: acumulan y NO resetean
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = extB * 256 + (v < 128 ? v : v - 256); continue; }
        var eA = extA, eB = extB, b2, b3, dist;
        extA = 0; extB = 0;
        if (b <= 0x51) { /* pushes cortos */ }
        else if (b === 0x52) {
            if (eB === 0) r.thisContext++;
            else if (eB === 1) r.thisProcess++;
            else r.raro = "0x52-extB-" + eB;
        }
        else if (b === 0x53) { /* dup */ }
        else if (b >= 0x54 && b <= 0x57) { r.raro = "no-usado-" + b.toString(16); break; }
        else if (b >= 0x58 && b <= 0x5C) { done = pc > endPC; }               // returns de metodo
        else if (b === 0x5D || b === 0x5E) { r.blockReturn++; done = pc > endPC; }
        else if (b === 0x5F) { /* nop */ }
        else if (b <= 0x7F) { r.sends++; r.sendsEspeciales++; }               // especiales
        else if (b <= 0xAF) { r.sends++; }                                    // literales 0-2 args
        else if (b <= 0xB7) { dist = (b & 7) + 1; r.jumps++; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; r.condJumps++; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xD7) { /* popInto rcvrVar / temp */ }
        else if (b === 0xD8) { /* pop */ }
        else if (b <= 0xDF) { r.raro = (b === 0xD9 ? "trap-0xD9" : "no-usado-" + b.toString(16)); break; }
        else if (b === 0xE2 || b === 0xE3 || b === 0xE4 || b === 0xE5) { pc++; }
        else if (b === 0xE6) { r.raro = "no-usado-e6"; break; }
        else if (b === 0xE7) { b2 = bytes[pc++]; if (b2 < 128) r.newArrayVacio++; else r.newArrayPop++; }
        else if (b === 0xE8 || b === 0xE9) { pc++; }
        else if (b === 0xEA) { pc++; r.sends++; }
        else if (b === 0xEB) { pc++; if (eB >= 64) r.superDirected++; else r.superSend++; }
        else if (b === 0xEC) { r.raro = "class-trap-0xEC"; break; }
        else if (b === 0xED) {
            b2 = bytes[pc++]; dist = b2 + eB * 256; r.jumps++;
            if (dist <= 0) r.backJump++; else if (pc + dist > endPC) endPC = pc + dist;
        }
        else if (b === 0xEE || b === 0xEF) {
            b2 = bytes[pc++]; dist = b2 + eB * 256; r.condJumps++;
            if (dist <= 0) { r.backJump++; r.backCondJump++; } else if (pc + dist > endPC) endPC = pc + dist;
        }
        else if (b >= 0xF0 && b <= 0xF5) { pc++; }
        else if (b === 0xF6 || b === 0xF7) { r.raro = "no-usado-" + b.toString(16); break; }
        else if (b === 0xF8) { pc += 2; r.raro = "callPrim-en-medio"; }
        else if (b === 0xF9) { pc += 2; r.fullClosure++; }
        else if (b === 0xFA) {
            b2 = bytes[pc++]; b3 = bytes[pc++];
            var blockSize = b3 + (eB << 8);
            r.closureCopy++;
            if (pc + blockSize > endPC) endPC = pc + blockSize;               // como jit.js:1294
        }
        else if (b >= 0xFB && b <= 0xFD) { pc += 2; r.remoteTemp++; }
        else { r.raro = "desconocido-" + b.toString(16); break; }
    }
    r.cuerpoBytes = pc - inicio;
    return r;
}

// motivos "duros" (rechazan incluso en R2); backJump y superSend son graduales
function motivos(r) {
    var m = [];
    if (r.prim > 0) m.push("primitiva");
    if (r.fullClosure || r.closureCopy || r.remoteTemp || r.blockReturn) m.push("closure");
    if (r.newArrayVacio || r.newArrayPop) m.push("newArray");
    if (r.thisContext) m.push("thisContext");
    if (r.thisProcess) m.push("thisProcess");
    if (r.raro) m.push("raro");
    return m;
}

module.exports = { escanearMetodo: escanearMetodo, motivos: motivos };
