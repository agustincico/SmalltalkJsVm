"use strict";
// SONDA: censo de disparadores del GC propio de SqueakJS. Envuelve fullGC y
// partialGC y captura el stack de JS de cada disparo, clasificando por que
// archivo/funcion llego ahi. Se carga via SPIKE_PATH (DIRECTO=1) pero NO
// activa ninguna forma directa.
(function () {
    var censo = new Map();

    function registrar(tipo, reason) {
        var stack = (new Error().stack || "").split("\n").slice(2, 12);
        // clasificacion gruesa: ¿por que capa entro?
        var vias = [];
        for (var i = 0; i < stack.length; i++) {
            var l = stack[i];
            if (l.indexOf("vm.primitives.js") >= 0) { vias.push("primitivas"); }
            else if (l.indexOf("vm.image.js") >= 0) { vias.push("image"); }
            else if (l.indexOf("vm.interpreter.js") >= 0) { vias.push("interprete"); }
            else if (l.indexOf("jit.js") >= 0 || l.indexOf("eval") >= 0 || l.indexOf("anonymous") >= 0) { vias.push("jit/eval"); }
            else vias.push("otro:" + l.trim().slice(0, 60));
        }
        var clave = tipo + "(" + reason + ") via " + vias.join(" > ");
        censo.set(clave, (censo.get(clave) || 0) + 1);
        if (!censo.has("STACK " + clave)) censo.set("STACK " + clave, "\n    " + stack.join("\n    "));
    }

    var iProto = Squeak.Image.prototype;
    var origFull = iProto.fullGC, origPartial = iProto.partialGC;
    iProto.fullGC = function(reason) { registrar("fullGC", reason); return origFull.call(this, reason); };
    iProto.partialGC = function(reason) { registrar("partialGC", reason); return origPartial.call(this, reason); };
    console.error("[sonda-gc] censo de disparadores de GC: ACTIVADO");
    process.on("exit", function() {
        console.error("== censo de GC ==");
        censo.forEach(function(v, k) {
            if (k.indexOf("STACK ") === 0) console.error("  " + k.slice(6) + " stack:" + v);
            else console.error("  " + v + "x " + k);
        });
    });
})();
