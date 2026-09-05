"use strict";
// MICRO 2: la variante "labeled blocks" — saltos mecanicos SIN switch y SIN
// reconstruccion de estructura: cada destino de salto hacia adelante T abre un
// bloque etiquetado bT que cierra justo antes de T (salto = break bT); cada
// destino de back-jump D abre un loop etiquetado LD (back-jump = continue LD).
// Emision 1:1 por salto, cero analisis de estructura (solo destinos ordenados).
// Comparo: nat (if/else reconstruido) vs blk (labeled) vs swd (switch denso).

var vm = { ic: 1000000000 };
var tObj = { esTrue: true }, fObj = { esFalse: true }, DEOPT = { esDeopt: true };
function raro() { throw new Error("camino raro"); }

// ---- fib nat (referencia, igual que micro-fib) ----
function fibNat(vm, rcvr, d) {
    var s0, s1, s2, r;
    if (--vm.ic <= 0) { vm.ic = 1000000000; }
    s0 = rcvr; s1 = 2;
    if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
    else return raro();
    if (s0 === fObj) {
        s0 = rcvr; s1 = 1;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 - s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        r = fibNat(vm, s0, d + 1); if (r === DEOPT) return raro(); s0 = r;
        s1 = rcvr; s2 = 2;
        if (typeof s1 === "number" && typeof s2 === "number") {
            r = s1 - s2; if (r < -1073741824 || r > 1073741823) return raro(); s1 = r;
        } else return raro();
        r = fibNat(vm, s1, d + 1); if (r === DEOPT) return raro(); s1 = r;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    } else if (s0 === tObj) {
        s0 = 1;
    } else return raro();
    return s0;
}

// ---- fib blk: labeled blocks, transcripcion 1:1 de los saltos del bytecode ----
// destinos forward: 8 y 20 -> bloques b8 (cierra antes de pc8) y b20 (antes de pc20)
function fibBlk(vm, rcvr, d) {
    var s0, s1, s2, r;
    b20: {
        b8: {
            // pc 0..6
            if (--vm.ic <= 0) { vm.ic = 1000000000; }
            s0 = rcvr; s1 = 2;
            if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
            else return raro();
            if (s0 === fObj) break b8;           // jumpIfFalse 8
            else if (s0 !== tObj) return raro();
            s0 = 1;
            break b20;                            // jumpTo 20
        } // pc 8
        s0 = rcvr; s1 = 1;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 - s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        r = fibBlk(vm, s0, d + 1); if (r === DEOPT) return raro(); s0 = r;
        s1 = rcvr; s2 = 2;
        if (typeof s1 === "number" && typeof s2 === "number") {
            r = s1 - s2; if (r < -1073741824 || r > 1073741823) return raro(); s1 = r;
        } else return raro();
        r = fibBlk(vm, s1, d + 1); if (r === DEOPT) return raro(); s1 = r;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    } // pc 20
    return s0;
}

// ---- fib swd (switch denso, igual que micro-fib) ----
function fibSwd(vm, rcvr, d) {
    var s0, s1, s2, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        s0 = rcvr; s1 = 2;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) { bc = 1; continue loop; }
        else if (s0 !== tObj) return raro();
        s0 = 1;
        bc = 2; continue loop;
    case 1:
        s0 = rcvr; s1 = 1;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 - s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        r = fibSwd(vm, s0, d + 1); if (r === DEOPT) return raro(); s0 = r;
        s1 = rcvr; s2 = 2;
        if (typeof s1 === "number" && typeof s2 === "number") {
            r = s1 - s2; if (r < -1073741824 || r > 1073741823) return raro(); s1 = r;
        } else return raro();
        r = fibSwd(vm, s1, d + 1); if (r === DEOPT) return raro(); s1 = r;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    case 2:
        return s0;
    }
}

// ---- loop nat / blk / swd ----
function loopNat(vm, n) {
    var t0, t1, s0, s1, r;
    t0 = 1; t1 = 0;
    for (;;) {
        s0 = t0; s1 = n;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 <= s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) break;
        else if (s0 !== tObj) return raro();
        s0 = t1; s1 = t0;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t1 = r;
        } else return raro();
        s0 = t0; s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t0 = r;
        } else return raro();
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
    }
    return t1;
}

// blk: back-jump a D=header -> LD: for(;;){...continue LD}; salida forward -> break bFin
function loopBlk(vm, n) {
    var t0, t1, s0, s1, r;
    t0 = 1; t1 = 0;
    bFin: {
        L1: for (;;) {
            s0 = t0; s1 = n;
            if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 <= s1 ? tObj : fObj; }
            else return raro();
            if (s0 === fObj) break bFin;     // jumpIfFalse fin
            else if (s0 !== tObj) return raro();
            s0 = t1; s1 = t0;
            if (typeof s0 === "number" && typeof s1 === "number") {
                r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t1 = r;
            } else return raro();
            s0 = t0; s1 = 1;
            if (typeof s0 === "number") {
                r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t0 = r;
            } else return raro();
            if (--vm.ic <= 0) { vm.ic = 1000000000; }
            continue L1;                      // back-jump
        }
    }
    return t1;
}

function loopSwd(vm, n) {
    var t0, t1, s0, s1, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        t0 = 1; t1 = 0;
    case 1:
        s0 = t0; s1 = n;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 <= s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) { bc = 2; continue loop; }
        else if (s0 !== tObj) return raro();
        s0 = t1; s1 = t0;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t1 = r;
        } else return raro();
        s0 = t0; s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); t0 = r;
        } else return raro();
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        bc = 1; continue loop;
    case 2:
        return t1;
    }
}

// ---------- arnes ----------
function correr(nombre, variantes, args, esperado, minMs) {
    for (var v = 0; v < variantes.length; v++) {
        var got = variantes[v][1].apply(null, args);
        if (got !== esperado) { console.error("MAL " + nombre + ": " + variantes[v][0] + " -> " + got); process.exit(1); }
    }
    function medir(fn, reps) {
        var t0 = process.hrtime.bigint();
        var acc = 0;
        for (var i = 0; i < reps; i++) acc += fn.apply(null, args);
        var t1 = process.hrtime.bigint();
        if (acc !== esperado * reps) throw new Error("corrupto");
        return Number(t1 - t0) / 1e6;
    }
    for (var w = 0; w < variantes.length; w++) medir(variantes[w][1], 20);
    var reps = 5;
    while (medir(variantes[0][1], reps) < minMs) reps *= 2;
    var RONDAS = 11;
    var tiempos = variantes.map(function () { return []; });
    for (var ronda = 0; ronda < RONDAS; ronda++)
        for (var k = 0; k < variantes.length; k++) {
            var idx = (k + ronda) % variantes.length;
            tiempos[idx].push(medir(variantes[idx][1], reps));
        }
    function mediana(xs) { var s = xs.slice().sort(function (a, b) { return a - b; }); return s[s.length >> 1]; }
    var base = mediana(tiempos[0]);
    console.log(nombre + " (cocientes vs " + variantes[0][0].trim() + ", mediana de " + RONDAS + " rondas):");
    for (var v2 = 0; v2 < variantes.length; v2++) {
        var m = mediana(tiempos[v2]);
        console.log("  " + variantes[v2][0] + "  x" + (m / base).toFixed(3));
    }
}

var esperadoFib = fibNat(vm, 22, 0);
console.log("fib(22) = " + esperadoFib);
correr("FIB ", [["nat", fibNat], ["blk", fibBlk], ["swd", fibSwd]], [vm, 22, 0], esperadoFib, 60);
var esperadoLoop = loopNat(vm, 20000);
correr("LOOP", [["nat", loopNat], ["blk", loopBlk], ["swd", loopSwd]], [vm, 20000], esperadoLoop, 60);
