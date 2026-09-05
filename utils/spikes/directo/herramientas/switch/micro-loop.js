"use strict";
// MICRO: loop puro (1 to: n do: [acc := acc + i]) — el caso MAS ADVERSO para el
// switch-local: el back-edge paga el dispatch del switch en CADA iteracion.
//   nat    = while nativo (forma reconstruida)
//   swd    = for(;;) switch(bc) denso: back-jump = bc=1; continue
//   swbig  = idem con 24 cases muertos extra (metodo grande, el loop es un bloque
//            entre muchos) — testea si mas cases degradan el dispatch
// Guards identicos (typeof + cotas + interrupt counter en el back-edge, como
// emitiria el codegen real en las DOS formas).

var vm = { ic: 1000000000 };
var tObj = { esTrue: true }, fObj = { esFalse: true };
function raro() { throw new Error("camino raro"); }

function loopNat(vm, n) {
    var t0, t1, s0, s1, r; // t0=i, t1=acc
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
        if (--vm.ic <= 0) { vm.ic = 1000000000; } // chequeo de interrupciones del back-edge
    }
    return t1;
}

function loopSwd(vm, n) {
    var t0, t1, s0, s1, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        t0 = 1; t1 = 0;
        // fallthrough
    case 1: // cabeza del loop (destino del back-jump)
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
        bc = 1; continue loop; // back-jump: paga el dispatch
    case 2:
        return t1;
    }
}

// mismo loop, pero el switch tiene 24 cases muertos mas (bloques de un metodo grande)
function loopSwbig(vm, n) {
    var t0, t1, s0, s1, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        t0 = 1; t1 = 0;
        // fallthrough
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
    case 3: s0 = raro(); bc = 4; continue loop;
    case 4: s0 = raro(); bc = 5; continue loop;
    case 5: s0 = raro(); bc = 6; continue loop;
    case 6: s0 = raro(); bc = 7; continue loop;
    case 7: s0 = raro(); bc = 8; continue loop;
    case 8: s0 = raro(); bc = 9; continue loop;
    case 9: s0 = raro(); bc = 10; continue loop;
    case 10: s0 = raro(); bc = 11; continue loop;
    case 11: s0 = raro(); bc = 12; continue loop;
    case 12: s0 = raro(); bc = 13; continue loop;
    case 13: s0 = raro(); bc = 14; continue loop;
    case 14: s0 = raro(); bc = 15; continue loop;
    case 15: s0 = raro(); bc = 16; continue loop;
    case 16: s0 = raro(); bc = 17; continue loop;
    case 17: s0 = raro(); bc = 18; continue loop;
    case 18: s0 = raro(); bc = 19; continue loop;
    case 19: s0 = raro(); bc = 20; continue loop;
    case 20: s0 = raro(); bc = 21; continue loop;
    case 21: s0 = raro(); bc = 22; continue loop;
    case 22: s0 = raro(); bc = 23; continue loop;
    case 23: s0 = raro(); bc = 24; continue loop;
    case 24: s0 = raro(); bc = 25; continue loop;
    case 25: s0 = raro(); bc = 26; continue loop;
    case 26: s0 = raro(); bc = 0; continue loop;
    }
}

var variantes = [
    ["nat  ", loopNat],
    ["swd  ", loopSwd],
    ["swbig", loopSwbig],
];

var N = 20000; // n chico por las cotas de overflow del acumulador (suma < 2^30)

var esperado = loopNat(vm, N);
for (var v = 1; v < variantes.length; v++) {
    var got = variantes[v][1](vm, N);
    if (got !== esperado) { console.error("MAL: " + variantes[v][0] + " -> " + got + " != " + esperado); process.exit(1); }
}
console.log("correctitud: todas dan suma(1.." + N + ") = " + esperado);

function medir(fn, reps) {
    var t0 = process.hrtime.bigint();
    var acc = 0;
    for (var i = 0; i < reps; i++) acc += fn(vm, N);
    var t1 = process.hrtime.bigint();
    if (acc !== esperado * reps) throw new Error("resultado corrupto");
    return Number(t1 - t0) / 1e6;
}

for (var w = 0; w < variantes.length; w++) medir(variantes[w][1], 50);

var reps = 50;
while (medir(loopNat, reps) < 60) reps *= 2;
console.log("reps por ronda: " + reps);

var RONDAS = 11;
var tiempos = variantes.map(function () { return []; });
for (var ronda = 0; ronda < RONDAS; ronda++) {
    for (var k = 0; k < variantes.length; k++) {
        var idx = (k + ronda) % variantes.length;
        tiempos[idx].push(medir(variantes[idx][1], reps));
    }
}

function mediana(xs) { var s = xs.slice().sort(function (a, b) { return a - b; }); return s[s.length >> 1]; }
var base = mediana(tiempos[0]);
console.log("\ncocientes (mediana de " + RONDAS + " rondas intercaladas, vs nat):");
for (var v2 = 0; v2 < variantes.length; v2++) {
    var m = mediana(tiempos[v2]);
    var mn = Math.min.apply(null, tiempos[v2]), mx = Math.max.apply(null, tiempos[v2]);
    console.log("  " + variantes[v2][0] + "  x" + (m / base).toFixed(3) +
        "   (dispersion propia min/max: " + (mn / m).toFixed(2) + ".." + (mx / m).toFixed(2) + ")");
}
