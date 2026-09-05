"use strict";
// Chequea con natives-syntax que las tres formas quedan TurboFan-optimizadas y
// no sufren deopts recurrentes. Correr: node --allow-natives-syntax estado-opt.js
var vm = { ic: 1000000000 };
var tObj = { esTrue: true }, fObj = { esFalse: true }, DEOPT = { esDeopt: true };
function raro() { throw new Error("raro"); }

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
function fibBlk(vm, rcvr, d) {
    var s0, s1, s2, r;
    b20: { b8: {
        if (--vm.ic <= 0) { vm.ic = 1000000000; }
        s0 = rcvr; s1 = 2;
        if (typeof s0 === "number" && typeof s1 === "number") { s0 = s0 < s1 ? tObj : fObj; }
        else return raro();
        if (s0 === fObj) break b8;
        else if (s0 !== tObj) return raro();
        s0 = 1; break b20;
    }
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
    }
    return s0;
}

function estado(nombre, fn) {
    %PrepareFunctionForOptimization(fn);
    fn(vm, 18, 0); fn(vm, 18, 0);
    %OptimizeFunctionOnNextCall(fn);
    fn(vm, 18, 0);
    // corrida larga para detectar deopts recurrentes
    for (var i = 0; i < 200; i++) fn(vm, 20, 0);
    var st = %GetOptimizationStatus(fn);
    // bits: 1 funcion | 16 optimizada | 32 maglev | 64 turbofan | 8 maybeDeopted (segun version)
    console.log(nombre + ": status=0b" + st.toString(2) +
        "  optimizada=" + !!(st & 16) + "  turbofan=" + !!(st & 64) + "  maglev=" + !!(st & 32));
}
estado("fibSwd", fibSwd);
estado("fibBlk", fibBlk);
