// DISEÑADOR B — analisis de RECONSTRUCCION ESTRUCTURADA (match-only, sin emision).
// Decodifica un CompiledMethod Sista ELEGIBLE (sin primitiva/closure/remoteTemp/
// thisContext/newArray/raro — el llamador filtra con censo-lib.motivos) a una lista
// de instrucciones, computa la profundidad estatica de pila por pc (worklist), y
// corre el parser recursivo que el codegen estructurado usaria: identifica loops
// (header = destino de back-jump incondicional, latch unico), diamantes if/else,
// ifs planos, breaks condicionales a exits de loops (incluidos loops externos =
// labeled break de JS). Si TODO el metodo se deja parsear, el emisor estructurado
// puede compilarlo a if/while de JS reales; si no, BAIL con motivo (fallback).
//
// Espeja la semantica de jit.js generateSista / censo-lib.js:
// - prefijos 0xE0/0xE1 acumulan; el pc de la instruccion es el del PRIMER prefijo
// - fin de metodo: return con pc > endPC (endPC = destino de salto mas lejano)
// - saltos: target = pcDespues + dist; dist<=0 => back-jump (solo 0xED en la practica)
"use strict";

var QUICK_ARGC = [1,2,0,0,1,0,1,0,1,0,1,1,0,1,0,0]; // at: at:put: size next nextPut: atEnd == class blockCopy: value value: do: new new: x y

function decodificar(m) {
    var bytes = m.bytes;
    var instrs = [], porPc = Object.create(null), porNext = Object.create(null);
    var pc = 0, endPC = 0, extA = 0, extB = 0, done = false, instrPc = -1;
    while (!done) {
        if (pc >= bytes.length) return { raro: "fin-sin-return" };
        if (instrs.length > 200000) return { raro: "metodo-absurdo" };
        if (instrPc < 0) instrPc = pc;
        var b = bytes[pc++];
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = extB * 256 + (v < 128 ? v : v - 256); continue; }
        var eA = extA, eB = extB, b2, dist;
        extA = 0; extB = 0;
        var i = { pc: instrPc, op: "otro", net: 0, target: -1 };
        instrPc = -1;
        if (b <= 0x51) { i.op = "push"; i.net = 1; }
        else if (b === 0x53) { i.op = "dup"; i.net = 1; }
        else if (b >= 0x58 && b <= 0x5C) { i.op = "ret"; done = pc > endPC; }
        else if (b === 0x5F) { i.op = "nop"; }
        else if (b <= 0x6F && b >= 0x60) { i.op = "send"; i.net = -1; }
        else if (b <= 0x7F) { i.op = "send"; i.net = -QUICK_ARGC[b - 0x70]; }
        else if (b <= 0x8F) { i.op = "send"; i.net = 0; }
        else if (b <= 0x9F) { i.op = "send"; i.net = -1; }
        else if (b <= 0xAF) { i.op = "send"; i.net = -2; }
        else if (b <= 0xB7) { dist = (b & 7) + 1; i.op = "jump"; i.target = pc + dist; }
        else if (b <= 0xBF) { dist = (b & 7) + 1; i.op = "jt"; i.net = -1; i.target = pc + dist; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; i.op = "jf"; i.net = -1; i.target = pc + dist; }
        else if (b <= 0xD7) { i.op = "popStore"; i.net = -1; }
        else if (b === 0xD8) { i.op = "pop"; i.net = -1; }
        else if (b === 0xE2 || b === 0xE3 || b === 0xE4 || b === 0xE5) { pc++; i.op = "push"; i.net = 1; }
        else if (b === 0xE7) {
            b2 = bytes[pc++];
            if (b2 < 128) return { raro: "newArray-vacio" };
            i.op = "mkArr"; i.net = 1 - (b2 & 127);
        }
        else if (b === 0xE8 || b === 0xE9) { pc++; i.op = "push"; i.net = 1; }
        else if (b === 0xEA) { b2 = bytes[pc++]; i.op = "send"; i.net = -((b2 & 7) + (eB << 3)); }
        else if (b === 0xEB) {
            b2 = bytes[pc++];
            var na = (b2 & 7) + ((eB & 63) << 3);
            i.op = "send"; i.net = eB >= 64 ? -(na + 1) : -na;
        }
        else if (b === 0xED) { b2 = bytes[pc++]; dist = b2 + eB * 256; i.op = "jump"; i.target = pc + dist; }
        else if (b === 0xEE) { b2 = bytes[pc++]; dist = b2 + eB * 256; i.op = "jt"; i.net = -1; i.target = pc + dist; }
        else if (b === 0xEF) { b2 = bytes[pc++]; dist = b2 + eB * 256; i.op = "jf"; i.net = -1; i.target = pc + dist; }
        else if (b >= 0xF0 && b <= 0xF2) { pc++; i.op = "popStore"; i.net = -1; }
        else if (b >= 0xF3 && b <= 0xF5) { pc++; i.op = "store"; }
        else return { raro: "bytecode-inelegible-" + b.toString(16) };
        if (i.target > endPC && i.target > i.pc) endPC = i.target;
        i.next = pc;
        instrs.push(i); porPc[i.pc] = i; porNext[i.next] = i;
    }
    return { instrs: instrs, porPc: porPc, porNext: porNext, fin: pc };
}

// profundidad estatica de pila por pc (worklist); ademas valida joins y targets
function profundidades(d) {
    var depth = Object.create(null);
    var work = [[d.instrs[0].pc, 0]];
    while (work.length) {
        var par = work.pop(), pc = par[0], k = par[1];
        var i = d.porPc[pc];
        if (!i) return { ok: false, motivo: "salto-a-medio-de-instruccion" };
        if (pc in depth) {
            if (depth[pc] !== k) return { ok: false, motivo: "profundidad-inconsistente" };
            continue;
        }
        depth[pc] = k;
        if (k < 0) return { ok: false, motivo: "profundidad-negativa" };
        if (i.op === "ret") continue;
        if (i.op === "jump") { work.push([i.target, k]); continue; }
        if (i.op === "jt" || i.op === "jf") {
            work.push([i.target, k - 1]);
            work.push([i.next, k - 1]);
            continue;
        }
        if (d.porPc[i.next] || i.next < d.fin) work.push([i.next, k + i.net]);
    }
    return { ok: true, depth: depth };
}

// ------------------------------------------------------- el parser estructural ----
function analizar(m) {
    var d = decodificar(m);
    if (d.raro) return { ok: false, motivo: "decode:" + d.raro };
    var prof = profundidades(d);
    if (!prof.ok) return { ok: false, motivo: prof.motivo };
    var depth = prof.depth;

    // headers de loop: destinos de saltos incondicionales hacia atras
    var headers = Object.create(null), n;
    for (n = 0; n < d.instrs.length; n++) {
        var it = d.instrs[n];
        if (it.op === "jump" && it.target <= it.pc) {
            (headers[it.target] = headers[it.target] || []).push(it.pc);
        }
        if ((it.op === "jt" || it.op === "jf") && it.target <= it.pc)
            return { ok: false, motivo: "cond-back-jump" };
    }

    var stats = {
        loops: 0, diamantes: 0, ifPlanos: 0, breaksCond: 0, breaksIncond: 0,
        breaksAExterno: 0, anidamientoMax: 0, headerDepths: [], multiExit: 0,
        continues: 0,
    };
    var consumidos = Object.create(null);
    var BAIL = {};
    var motivo = null;
    function bail(m2) { motivo = m2; throw BAIL; }

    function parseSeq(lo, hi, loops) {
        var pc = lo;
        while (pc < hi) {
            if (headers[pc] && !consumidos[pc]) {
                var latches = headers[pc];
                var L = latches[latches.length - 1];              // el latch de MAS abajo cierra el for(;;)
                for (var lx = 0; lx < latches.length; lx++)
                    if (latches[lx] > L) L = latches[lx];
                if (L < pc || L >= hi) bail("latch-fuera-de-region");
                var latchInstr = d.porPc[L];
                if (!latchInstr || latchInstr.op !== "jump") bail("latch-raro");
                consumidos[pc] = true;
                stats.loops++;
                stats.headerDepths.push(depth[pc]);
                if (loops.length + 1 > stats.anidamientoMax) stats.anidamientoMax = loops.length + 1;
                var exits0 = stats.breaksCond + stats.breaksIncond;
                parseSeq(pc, L, loops.concat([{ H: pc, E: latchInstr.next }]));
                if (stats.breaksCond + stats.breaksIncond - exits0 > 1) stats.multiExit++;
                pc = latchInstr.next;
                continue;
            }
            var i = d.porPc[pc];
            if (!i) bail("pc-hueco");
            if (i.op === "jt" || i.op === "jf") {
                var T = i.target;
                if (T <= pc) bail("cond-back");
                var idx = -1, li;
                for (li = loops.length - 1; li >= 0; li--) if (loops[li].E === T) { idx = li; break; }
                if (idx >= 0) {                                  // break condicional
                    stats.breaksCond++;
                    if (idx < loops.length - 1) stats.breaksAExterno++;
                    pc = i.next;
                    continue;
                }
                if (T > hi) bail("cond-target-fuera-de-region");
                var last = d.porNext[T];                          // ultima instr antes de T
                if (last && last.pc >= i.next && last.op === "jump" && last.target > T) {
                    var M = last.target;                          // diamante if/else
                    if (M > hi) bail("join-fuera-de-region");
                    stats.diamantes++;
                    parseSeq(i.next, last.pc, loops);
                    parseSeq(T, M, loops);
                    pc = M;
                } else {                                          // if plano (cae a T)
                    stats.ifPlanos++;
                    parseSeq(i.next, T, loops);
                    pc = T;
                }
                continue;
            }
            if (i.op === "jump") {
                var T2 = i.target;
                if (T2 <= pc) {
                    // back-jump que no es el latch de cierre: continue a un loop en curso
                    var ic = -1, lc;
                    for (lc = loops.length - 1; lc >= 0; lc--) if (loops[lc].H === T2) { ic = lc; break; }
                    if (ic >= 0) {
                        stats.continues++;
                        if (ic < loops.length - 1) bail("continue-a-loop-externo"); // JS labeled continue lo cubriria, pero medirlo aparte
                        pc = i.next;
                        continue;
                    }
                    bail("latch-suelto");
                }
                var idx2 = -1, lj;
                for (lj = loops.length - 1; lj >= 0; lj--) if (loops[lj].E === T2) { idx2 = lj; break; }
                if (idx2 >= 0) {                                  // break incondicional
                    stats.breaksIncond++;
                    if (idx2 < loops.length - 1) stats.breaksAExterno++;
                    pc = i.next;
                    continue;
                }
                bail("jump-adelante-suelto");                     // else-skip fuera de diamante
            }
            pc = i.next;                                          // lineal (ret incluido)
        }
        if (pc !== hi) bail("region-desbordada");
    }

    try {
        parseSeq(d.instrs[0].pc, d.fin, []);
    } catch (e) {
        if (e !== BAIL) throw e;
        return { ok: false, motivo: motivo };
    }
    return { ok: true, stats: stats };
}

module.exports = { decodificar: decodificar, profundidades: profundidades, analizar: analizar };
