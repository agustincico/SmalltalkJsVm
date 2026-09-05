"use strict";
// SONDA de profundidad: variante del spike directo donde benchFib se reemplaza por
// una CADENA LINEAL (depth = receptor). No decrementa interruptCheckCounter (probe
// puro de profundidad). Atrapa el RangeError en el hook mas externo, reporta la
// profundidad alcanzada, y devuelve 0 para que la imagen siga hasta el quit.
(function () {
    var METODO = null;
    var profundidad = 0, maxima = 0;

    function cadena(vm, rcvr) {
        profundidad++;
        if (profundidad > maxima) maxima = profundidad;
        if (rcvr <= 0) { profundidad--; return 0; }
        var r = cadena(vm, rcvr - 1);
        profundidad--;
        return r + 1;
    }

    var vmProto = Squeak.Interpreter.prototype;
    var origENM = vmProto.executeNewMethod;
    vmProto.executeNewMethod = function(rcvr, method, argc, prim, optClass, optSel) {
        if (METODO === null && optClass && optSel && optSel.bytesAsString() === "benchFib"
            && optClass.className() === "Integer") METODO = method;
        if (method === METODO && METODO !== null && typeof rcvr === "number" && argc === 0) {
            this.popN(1);
            profundidad = 0;
            try {
                var r = cadena(this, rcvr);
                console.error("[sonda] cadena de " + rcvr + " OK (max depth " + maxima + ")");
                this.push(r);
            } catch (e) {
                if (!(e instanceof RangeError)) throw e;
                console.error("[sonda] RangeError con receptor " + rcvr +
                    ": max depth alcanzada = " + maxima + " frames directos");
                this.push(0); // recuperar en el hook mas externo: la imagen sigue
            }
            maxima = 0;
            return;
        }
        return origENM.call(this, rcvr, method, argc, prim, optClass, optSel);
    };
    console.error("[sonda] cadena lineal en forma directa: ACTIVADA");
})();
