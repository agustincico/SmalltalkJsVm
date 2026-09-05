"use strict";
// EXPERIMENTO DEL CRITICO: ejercitar la deopt de FRONTERA (D5: send comun con
// operandos repuestos + replay vm.send en el epilogo; D4: special-send con replay
// vm.sendSpecial) que el spike original NUNCA ejercito (sus 368 deopts eran todas
// por interrupcion, pend=null). Base: utils/spikes/directo/spike-directo.js.
// Cadencias forzadas primas para interlevar los tres tipos.
(function () {
    var DEOPT = { esDeopt: true };
    var METODO = null;
    var SEL_BENCHFIB = null; // literal del selector benchFib dentro del metodo
    var TFS = Squeak.Context_tempFrameStart;
    var nCalls = 0;
    var stats = { d5r1: 0, d5r2: 0, d4plus: 0, interrupt: 0, reentradaDirecta: 0 };

    function materializar(vm, method, rcvr, pc, valoresDePila) {
        var ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame());
        var p = ctx.pointers;
        p[Squeak.Context_method] = method;
        p[Squeak.BlockContext_initialIP] = vm.nilObj;
        p[Squeak.Context_sender] = vm.nilObj;
        p[Squeak.Context_receiver] = rcvr;
        var base = TFS + method.methodTempCount();
        for (var i = 0; i < method.methodTempCount(); i++) p[TFS + i] = vm.nilObj;
        for (var j = 0; j < valoresDePila.length; j++) p[base + j] = valoresDePila[j];
        p[Squeak.Context_instructionPointer] = vm.encodeSqueakPC(pc, method);
        p[Squeak.Context_stackPointer] = vm.encodeSqueakSP(base + valoresDePila.length - 1);
        ctx.dirty = true;
        vm.deoptFrames = (vm.deoptFrames || 0) + 1;
        if (!vm.deoptInner) { vm.deoptInner = ctx; vm.deoptEventos = (vm.deoptEventos || 0) + 1; }
        else vm.deoptOuter.pointers[Squeak.Context_sender] = ctx;
        vm.deoptOuter = ctx;
        return DEOPT;
    }

    function fibDirecto(vm, rcvr) {
        vm.sendCount++;
        if (--vm.interruptCheckCounter <= 0) { stats.interrupt++; return materializar(vm, METODO, rcvr, 0, []); }
        if (rcvr < 2) return 1;
        nCalls++;
        // D5 en el sitio del PRIMER benchFib (pc 11, retorno 12): frontera con
        // el receptor del send REPUESTO y pend = send comun
        if (nCalls % 5003 === 0) {
            stats.d5r1++;
            vm.deoptPendiente = { tipo: "send", sel: SEL_BENCHFIB, argc: 0 };
            return materializar(vm, METODO, rcvr, 12, [rcvr - 1]);
        }
        var r1 = fibDirecto(vm, rcvr - 1);
        if (r1 === DEOPT) return materializar(vm, METODO, rcvr, 12, []); // D3
        // D5 en el sitio del SEGUNDO benchFib (pc 16, retorno 17)
        if (nCalls % 7019 === 0) {
            stats.d5r2++;
            vm.deoptPendiente = { tipo: "send", sel: SEL_BENCHFIB, argc: 0 };
            return materializar(vm, METODO, rcvr, 17, [r1, rcvr - 2]);
        }
        var r2 = fibDirecto(vm, rcvr - 2);
        if (r2 === DEOPT) return materializar(vm, METODO, rcvr, 17, [r1]); // D3
        // D4 en el + de pc 17 (retorno 18): operandos repuestos, replay sendSpecial(0)
        if (nCalls % 11027 === 0) {
            stats.d4plus++;
            vm.deoptPendiente = { tipo: "special", idx: 0 };
            return materializar(vm, METODO, rcvr, 18, [r1, r2]);
        }
        var s = r1 + r2 + 1;
        return (s >= -1073741824 && s <= 1073741823) ? s : vm.primHandler.signed32BitIntegerFor(s);
    }

    var vmProto = Squeak.Interpreter.prototype;
    var origENM = vmProto.executeNewMethod;
    vmProto.executeNewMethod = function(rcvr, method, argc, prim, optClass, optSel) {
        if (METODO === null && optClass && optSel && optSel.bytesAsString() === "benchFib"
            && optClass.className() === "Integer") {
            METODO = method;
            // buscar el literal del selector benchFib (send a si mismo)
            for (var i = 1; i < method.pointers.length; i++) {
                var lit = method.pointers[i];
                if (lit && lit.bytesAsString && lit.bytesAsString() === "benchFib") { SEL_BENCHFIB = lit; break; }
            }
            console.error("[frontera] benchFib capturado; literal selector benchFib: " +
                (SEL_BENCHFIB ? "encontrado (idx no importa, es el objeto)" : "NO ENCONTRADO"));
        }
        if (method === METODO && METODO !== null && typeof rcvr === "number" && argc === 0) {
            if (this.deoptInner) stats.reentradaDirecta++; // no deberia pasar: llegar aca con deopt a medias
            this.popN(1);
            var r = fibDirecto(this, rcvr);
            if (r === DEOPT) {
                this.deoptOuter.pointers[Squeak.Context_sender] = this.activeContext;
                this.storeContextRegisters();
                this.activeContext = this.deoptInner;
                this.fetchContextRegisters(this.deoptInner);
                this.deoptInner = this.deoptOuter = null;
                this.reclaimableContextCount = 0;
                this.activeContext.dirty = true;
                var pend = this.deoptPendiente; this.deoptPendiente = null;
                // REGLA DEL EPILOGO: exactamente UNA accion terminal
                if (pend && pend.tipo === "send") this.send(pend.sel, pend.argc, false);
                else if (pend && pend.tipo === "special") this.sendSpecial(pend.idx);
                else if (this.interruptCheckCounter <= 0) this.checkForInterrupts();
                return;
            }
            this.push(r);
            return;
        }
        return origENM.call(this, rcvr, method, argc, prim, optClass, optSel);
    };
    console.error("[frontera] spike de FRONTERA activado (D5 r1 % 5003, D5 r2 % 7019, D4 + % 11027)");
    process.on("exit", function() {
        var vm = self.__vm;
        if (vm) console.error("[frontera] deopts: " + (vm.deoptEventos||0) + " eventos, " +
            (vm.deoptFrames||0) + " frames | " + JSON.stringify(stats));
    });
})();
