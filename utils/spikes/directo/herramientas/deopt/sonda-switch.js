"use strict";
// Carga el spike real y ademas censa CADA transferTo: ¿hay frames directos
// (fibDirecto) vivos en la pila de JS al momento del cambio de proceso?
require("/Users/agustin/SqueakJS/utils/spikes/directo/spike-directo.js");
(function () {
    var conDirectos = 0, sinDirectos = 0, ejemplo = null;
    var pProto = Squeak.Primitives.prototype;
    var orig = pProto.transferTo;
    pProto.transferTo = function(newProc) {
        var stack = new Error().stack || "";
        if (stack.indexOf("fibDirecto") >= 0) { conDirectos++; if (!ejemplo) ejemplo = stack; }
        else sinDirectos++;
        return orig.call(this, newProc);
    };
    process.on("exit", function() {
        console.error("[sonda-switch] cambios de proceso con frames directos en pila: " + conDirectos +
            " | sin frames directos: " + sinDirectos);
        if (ejemplo) console.error("[sonda-switch] EJEMPLO CON FRAMES DIRECTOS:\n" + ejemplo);
    });
})();
