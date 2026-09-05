"use strict";
// Sondeo 2: recursión directa sin indirecciones — un frame de JS por nivel.
var depth;

function fibShape(vm, rcvr) {   // 2 args, 3 locales — la forma del spike
    depth++;
    vm.sendCount++;
    if (--vm.interruptCheckCounter <= 0) return null;
    if (rcvr < 2) return 1;
    var r1 = fibShape(vm, rcvr - 1);   // en la sonda: siempre recursa por acá
    if (r1 === null) return null;
    var r2 = r1;
    var s = r1 + r2 + 1;
    return s;
}

function conTemps(vm, rcvr) {   // 8 temporales
    depth++;
    var t1 = rcvr, t2 = t1, t3 = t2, t4 = t3, t5 = t4, t6 = t5, t7 = t6, t8 = t7;
    var r1 = conTemps(vm, t8 - 1);
    return r1 === null ? null : t1 + t2 + t3 + t4 + t5 + t6 + t7 + t8 + r1;
}

function gordo(vm, rcvr, a1, a2, a3, a4) {   // 6 args, 16 temporales
    depth++;
    var t1 = rcvr, t2 = t1, t3 = t2, t4 = t3, t5 = t4, t6 = t5, t7 = t6, t8 = t7,
        t9 = t8, t10 = t9, t11 = t10, t12 = t11, t13 = t12, t14 = t13, t15 = t14, t16 = t15;
    var r1 = gordo(vm, t16 - 1, a1, a2, a3, a4);
    return r1 === null ? null : t1 + t16 + r1 + a1;
}

function medir(nombre, f) {
    depth = 0;
    try { f({sendCount: 0, interruptCheckCounter: 2e9}, 2e9, 1, 1, 1, 1); }
    catch (e) { if (!(e instanceof RangeError)) throw e; }
    console.log(nombre + ": " + depth.toLocaleString() + " frames");
}

medir("fib-shape (2 args, 3 locales)", fibShape);
medir("8 temps", conTemps);
medir("6 args + 16 temps", gordo);
