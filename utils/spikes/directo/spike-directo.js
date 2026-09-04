"use strict";
// SPIKE: benchFib en forma DIRECTA — argumentos como argumentos de JS, retorno con
// return, frames en la pila de JS, y DEOPTIMIZACION AL DESENROLLAR: cuando hace falta
// reificar (chequeo de interrupciones), cada frame materializa su propio MethodContext
// mientras la pila de JS se desenrolla, y el VM sigue con la maquinaria normal.
// Se activa con DIRECTO=1. Es un spike de medicion, no codigo de produccion.
(function () {
    var DEOPT = { esDeopt: true };
    var METODO = null;
    var TFS = Squeak.Context_tempFrameStart;

    function materializar(vm, method, rcvr, pc, valoresDePila) {
        var ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame());
        var p = ctx.pointers;
        p[Squeak.Context_method] = method;
        p[Squeak.BlockContext_initialIP] = vm.nilObj;
        p[Squeak.Context_sender] = vm.nilObj;          // lo completa el frame de afuera
        p[Squeak.Context_receiver] = rcvr;
        var base = TFS + method.methodTempCount();
        for (var i = 0; i < method.methodTempCount(); i++) p[TFS + i] = vm.nilObj;
        for (var j = 0; j < valoresDePila.length; j++) p[base + j] = valoresDePila[j];
        p[Squeak.Context_instructionPointer] = vm.encodeSqueakPC(pc, method);
        p[Squeak.Context_stackPointer] = vm.encodeSqueakSP(base + valoresDePila.length - 1);
        ctx.dirty = true;
        // el desenrollado va de adentro hacia afuera: el primero es el mas interno
        vm.deoptFrames = (vm.deoptFrames || 0) + 1;
        if (!vm.deoptInner) { vm.deoptInner = ctx; vm.deoptEventos = (vm.deoptEventos || 0) + 1; }
        else vm.deoptOuter.pointers[Squeak.Context_sender] = ctx;
        vm.deoptOuter = ctx;
        return DEOPT;
    }

    function fibDirecto(vm, rcvr) {
        vm.sendCount++;
        if (--vm.interruptCheckCounter <= 0) return materializar(vm, METODO, rcvr, 0, []);
        if (rcvr < 2) return 1;
        var r1 = fibDirecto(vm, rcvr - 1);
        if (r1 === DEOPT) return materializar(vm, METODO, rcvr, 12, []);
        var r2 = fibDirecto(vm, rcvr - 2);
        if (r2 === DEOPT) return materializar(vm, METODO, rcvr, 17, [r1]);
        var s = r1 + r2 + 1;
        return (s >= -1073741824 && s <= 1073741823) ? s : vm.primHandler.signed32BitIntegerFor(s);
    }

    var vmProto = Squeak.Interpreter.prototype;
    var origENM = vmProto.executeNewMethod;
    vmProto.executeNewMethod = function(rcvr, method, argc, prim, optClass, optSel) {
        if (METODO === null && optClass && optSel && optSel.bytesAsString() === "benchFib"
            && optClass.className() === "Integer") METODO = method;
        if (method === METODO && METODO !== null && typeof rcvr === "number" && argc === 0) {
            this.popN(1);                       // el receptor lo consume la llamada directa
            var r = fibDirecto(this, rcvr);
            if (r === DEOPT) {
                // el frame mas externo cuelga del contexto real que llamo
                this.deoptOuter.pointers[Squeak.Context_sender] = this.activeContext;
                this.storeContextRegisters();
                this.activeContext = this.deoptInner;
                this.fetchContextRegisters(this.deoptInner);
                this.deoptInner = this.deoptOuter = null;
                this.reclaimableContextCount = 0;
                this.activeContext.dirty = true;
                // atender la interrupcion YA, con el estado consistente: si no, el
                // contador nunca se repone y cada activacion vuelve a deoptimizar
                if (this.interruptCheckCounter <= 0) this.checkForInterrupts();
                return;
            }
            this.push(r);
            return;
        }
        return origENM.call(this, rcvr, method, argc, prim, optClass, optSel);
    };
    console.error("[directo] benchFib en forma directa: ACTIVADO");
    process.on("exit", function() {
        var vm = self.__vm;
        if (vm) console.error("[directo] deopts: " + (vm.deoptEventos||0) + " eventos, " +
            (vm.deoptFrames||0) + " frames materializados");
    });
})();
