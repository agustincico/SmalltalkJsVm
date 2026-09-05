"use strict";
// Sondeo de profundidad de pila de JS para frames con forma de "método directo".
// Mide la profundidad máxima de recursión antes del RangeError, para varias
// formas de frame (más locales = frame más grande = menos profundidad).

function medir(nombre, f) {
    var depth = 0;
    function probe(vm, rcvr) {
        depth++;
        return f(probe, vm, rcvr);
    }
    try {
        probe({sendCount: 0, interruptCheckCounter: 1e9}, 1);
    } catch (e) {
        if (!(e instanceof RangeError)) throw e;
    }
    console.log(nombre + ": " + depth.toLocaleString() + " frames");
    return depth;
}

// forma benchFib del spike: 2 args, ~3 locales
medir("fib-shape (2 args, 3 locales)", function(probe, vm, rcvr) {
    vm.sendCount++;
    if (--vm.interruptCheckCounter <= 0) return null;
    var r1 = probe(vm, rcvr - 1);
    if (r1 === undefined) return r1;
    var r2 = r1 + 1;
    var s = r1 + r2;
    return s;
});

// forma con más locales: método con 8 temporales
medir("8 temps", function(probe, vm, rcvr) {
    vm.sendCount++;
    var t1 = rcvr, t2 = t1 + 1, t3 = t2, t4 = t3, t5 = t4, t6 = t5, t7 = t6, t8 = t7;
    var r1 = probe(vm, t8 - 1);
    return r1 === undefined ? r1 : t1 + t2 + t3 + t4 + t5 + t6 + t7 + t8 + r1;
});

// forma con 16 temporales y 4 args extra
medir("16 temps + extra args", function(probe, vm, rcvr) {
    vm.sendCount++;
    var a = [rcvr, rcvr, rcvr, rcvr];
    var t1 = rcvr, t2 = t1, t3 = t2, t4 = t3, t5 = t4, t6 = t5, t7 = t6, t8 = t7,
        t9 = t8, t10 = t9, t11 = t10, t12 = t11, t13 = t12, t14 = t13, t15 = t14, t16 = t15;
    var r1 = probe(vm, t16 - 1, a[0], a[1], a[2], a[3]);
    return r1 === undefined ? r1 : t1 + t16 + r1;
});

// ¿se puede atrapar el RangeError y seguir? (relevante para un plan B)
var caught = false;
function deep(n) { return n <= 0 ? 0 : deep(n - 1) + 1; }
try { deep(1e9); } catch (e) { caught = e instanceof RangeError; }
console.log("RangeError atrapable y el proceso sigue: " + caught + " (deep(1000) despues: " + deep(1000) + ")");
