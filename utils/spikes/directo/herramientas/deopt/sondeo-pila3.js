"use strict";
// Sondeo 3: igual que 2 pero con warmup para que V8 optimice (frames de TurboFan
// son mas chicos que los del interprete/sparkplug).
var depth, limit;

function fibShape(vm, rcvr) {
    depth++;
    if (depth >= limit) return 1;
    vm.sendCount++;
    if (--vm.interruptCheckCounter <= 0) return null;
    if (rcvr < 2) return 1;
    var r1 = fibShape(vm, rcvr - 1);
    if (r1 === null) return null;
    var r2 = r1;
    var s = r1 + r2 + 1;
    return s;
}

function gordo(vm, rcvr, a1, a2, a3, a4) {
    depth++;
    if (depth >= limit) return 1;
    var t1 = rcvr, t2 = t1, t3 = t2, t4 = t3, t5 = t4, t6 = t5, t7 = t6, t8 = t7,
        t9 = t8, t10 = t9, t11 = t10, t12 = t11, t13 = t12, t14 = t13, t15 = t14, t16 = t15;
    var r1 = gordo(vm, t16 - 1, a1, a2, a3, a4);
    return r1 === null ? null : t1 + t16 + r1 + a1;
}

function medir(nombre, f) {
    var vm = {sendCount: 0, interruptCheckCounter: 2e9};
    // warmup: muchas corridas cortas
    limit = 50;
    for (var i = 0; i < 20000; i++) { depth = 0; f(vm, 2e9, 1, 1, 1, 1); }
    // medicion
    limit = 1e12; depth = 0;
    try { f(vm, 2e9, 1, 1, 1, 1); }
    catch (e) { if (!(e instanceof RangeError)) throw e; }
    console.log(nombre + ": " + depth.toLocaleString() + " frames (optimizado)");
}

medir("fib-shape", fibShape);
medir("6 args + 16 temps", gordo);
