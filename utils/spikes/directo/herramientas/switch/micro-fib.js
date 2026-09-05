"use strict";
// MICRO: benchFib transcripto bytecode-a-bytecode con LOS MISMOS guards en todas
// las variantes; lo unico que cambia es la forma del control de flujo:
//   nat    = control de flujo nativo de JS (forma "reconstruida", disenador A)
//   swd    = for(;;) switch(bc) con bc LOCAL y cases DENSOS 0,1,2 (disenador C)
//   swpc   = idem pero cases ralos con los pcs squeak reales (0,8,20)
//   swall  = idem con un case por CADA bytecode (18 cases, peor caso de labels)
// Todas reciben (vm, rcvr, d) y devuelven un number; guards typeof + cotas de
// overflow + chequeo de centinela DEOPT tras cada llamada directa + decremento
// del interruptCheckCounter a la entrada — como emitiria el codegen real.
// A/B intercalado, solo cocientes (maquina compartida: tiempos absolutos no valen).

var vm = { ic: 1000000000 };
var tObj = { esTrue: true }, fObj = { esFalse: true }, DEOPT = { esDeopt: true };
function raro() { throw new Error("camino raro alcanzado"); }

// ---------- nat: forma reconstruida (if/else nativo) ----------
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

// ---------- swd: switch-local, cases densos (bloques 0,1,2) ----------
function fibSwd(vm, rcvr, d) {
    var s0, s1, s2, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0: // pc 0..6
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        s0 = rcvr; s1 = 2;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) { bc = 1; continue loop; }
        else if (s0 !== tObj) return raro();
        s0 = 1;
        bc = 2; continue loop;
    case 1: // pc 8..19
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
        // fallthrough al case 2 (pc 20)
    case 2: // pc 20
        return s0;
    }
}

// ---------- swpc: switch-local, cases ralos (pcs squeak 0, 8, 20) ----------
function fibSwpc(vm, rcvr, d) {
    var s0, s1, s2, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        s0 = rcvr; s1 = 2;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) { bc = 8; continue loop; }
        else if (s0 !== tObj) return raro();
        s0 = 1;
        bc = 20; continue loop;
    case 8:
        s0 = rcvr; s1 = 1;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 - s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        r = fibSwpc(vm, s0, d + 1); if (r === DEOPT) return raro(); s0 = r;
        s1 = rcvr; s2 = 2;
        if (typeof s1 === "number" && typeof s2 === "number") {
            r = s1 - s2; if (r < -1073741824 || r > 1073741823) return raro(); s1 = r;
        } else return raro();
        r = fibSwpc(vm, s1, d + 1); if (r === DEOPT) return raro(); s1 = r;
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        s1 = 1;
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
        // fallthrough
    case 20:
        return s0;
    }
}

// ---------- swall: switch-local, un case por bytecode (como single-step) ----------
function fibSwall(vm, rcvr, d) {
    var s0, s1, s2, r;
    var bc = 0;
    loop: for (;;) switch (bc) {
    case 0:
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        s0 = rcvr;
    case 1:
        s1 = 2;
    case 3:
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
        else return raro();
    case 4:
        if (s0 === fObj) { bc = 8; continue loop; }
        else if (s0 !== tObj) return raro();
    case 5:
        s0 = 1;
    case 6:
        bc = 20; continue loop;
    case 8:
        s0 = rcvr;
    case 9:
        s1 = 1;
    case 10:
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 - s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    case 11:
        r = fibSwall(vm, s0, d + 1); if (r === DEOPT) return raro(); s0 = r;
    case 12:
        s1 = rcvr;
    case 13:
        s2 = 2;
    case 15:
        if (typeof s1 === "number" && typeof s2 === "number") {
            r = s1 - s2; if (r < -1073741824 || r > 1073741823) return raro(); s1 = r;
        } else return raro();
    case 16:
        r = fibSwall(vm, s1, d + 1); if (r === DEOPT) return raro(); s1 = r;
    case 17:
        if (typeof s0 === "number" && typeof s1 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    case 18:
        s1 = 1;
    case 19:
        if (typeof s0 === "number") {
            r = s0 + s1; if (r < -1073741824 || r > 1073741823) return raro(); s0 = r;
        } else return raro();
    case 20:
        return s0;
    }
}

// ---------- arnes: A/B intercalado, mediana, cocientes ----------
var variantes = [
    ["nat  ", fibNat],
    ["swd  ", fibSwd],
    ["swpc ", fibSwpc],
    ["swall", fibSwall],
];

var N = 22;

// correctitud primero
var esperado = fibNat(vm, N, 0);
for (var v = 1; v < variantes.length; v++) {
    var got = variantes[v][1](vm, N, 0);
    if (got !== esperado) { console.error("MAL: " + variantes[v][0] + " dio " + got + " != " + esperado); process.exit(1); }
}
console.log("correctitud: todas dan benchFib(" + N + ") = " + esperado);

function medir(fn, reps) {
    var t0 = process.hrtime.bigint();
    var acc = 0;
    for (var i = 0; i < reps; i++) acc += fn(vm, N, 0);
    var t1 = process.hrtime.bigint();
    if (acc !== esperado * reps) throw new Error("resultado corrupto");
    return Number(t1 - t0) / 1e6; // ms
}

// warmup parejo
for (var w = 0; w < variantes.length; w++) medir(variantes[w][1], 20);

// calibrar reps para ~80ms por ronda con nat
var reps = 5;
while (medir(fibNat, reps) < 60) reps *= 2;
console.log("reps por ronda: " + reps);

var RONDAS = 11;
var tiempos = variantes.map(function () { return []; });
for (var ronda = 0; ronda < RONDAS; ronda++) {
    for (var k = 0; k < variantes.length; k++) {
        // rotar el orden por ronda para repartir el ruido
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
