"use strict";
/*
 * jit.directo.js — FORMA DIRECTA con deoptimización al desenrollar.
 *
 * Un método elegible se compila a una función JS que recibe receptor y argumentos
 * como argumentos reales de JS y devuelve con return: los frames viven en la pila
 * de JS y NO se crea MethodContext en el caso común. Cuando hay que reificar
 * (interrupciones, frontera con la maquinaria clásica, profundidad), cada frame
 * materializa su propio MethodContext mientras la pila de JS se desenrolla
 * (centinela devuelto, no excepción), encadenándose de adentro hacia afuera; el
 * VM sigue después con el jit clásico, que ya sabe reanudar desde cualquier pc.
 *
 * Diseño completo, censos y validación: utils/spikes/directo/ (README, analisis/,
 * herramientas/). Spike que validó el diseño: 15,7x en benchFib (commit 97f15a0);
 * la deopt de frontera la validó spike-frontera.js (crítico, 5-sep).
 *
 * Reglas de oro (todas comprobadas corriendo, ver analisis/trampas.md):
 * - Materializar SIEMPRE en un pc etiquetado del jit clásico: pc 0, destino de
 *   salto, o pc de retorno post-send/post-op. JAMÁS en el pc del send (75,6% no
 *   tiene case → default → interpretOne single-step para siempre).
 * - sp del contexto materializado EXACTO (el GC nilea todo slot > sp) y ningún
 *   slot undefined (el contexto reciclado trae 21/22 slots de basura).
 * - El epílogo de deopt hace exactamente UNA acción terminal: el send pendiente
 *   O checkForInterrupts, jamás ambas.
 * - sendCount es semántico (línea de tiempo del replay de eventos): se cuenta
 *   iff executeNewMethod habría corrido.
 * - interruptCheckCounter vive en el vm, jamás en una local (forceInterruptCheck
 *   = -1000 es el canal de todos los eventos asíncronos).
 * - El código directo NUNCA escribe vm.pc. El epílogo hace storeContextRegisters()
 *   sobre el contexto del caller CLÁSICO, así que un vm.pc contaminado con el pc de
 *   un método directo le guarda un pc ajeno y explota como "invalid PC" al reanudar
 *   (lo cazó el oráculo cuando la traza lo seteaba; el pc de muestreo viaja como
 *   argumento del hook, no por vm.pc).
 * - Los helpers aritméticos del intérprete (pop2AndPush*, stackIntOrFloat...)
 *   están PROHIBIDOS desde código directo (leen la pila del VM, usan flags
 *   globales y devuelven centinelas in-band): todo fallo de fast-path = frontera.
 */

Object.extend(Squeak, { Directo: (function() {

var DEOPT = Object.freeze({ esDeopt: true });
var VACIO = Object.freeze([]);
var UMBRAL = 8;          // activaciones antes de intentar compilar (espejo de .compiled)
var SIN_QUICK = !!process.env.DIRECTOSINQUICK;
var SIN_LOOPS = !!process.env.DIRECTOSINLOOPS;   // biseccion: volver a etapa 1 (sin loops)
// TRAZA: emite el muestreo del oraculo en cada sitio directo->directo. Sin esto
// esos sends son invisibles para el muestreador (que engancha executeNewMethod)
// y el hash diverge espuriamente. Se decide en tiempo de compilacion: costo cero
// cuando esta apagada. Es el mismo patron que jit2LeafHook del proyecto stack-zone.
var TRAZA = false;
var FILTRO = null;       // biseccion: {div, rem} compila solo si (hash % div) === rem
var TOPE_PROFUNDIDAD = 1000;
var VETO_MIN_FRONTERAS = +(process.env.DIRECTOVETO || 32);

// ---------------------------------------------------------------------------
// RT: materialización de un frame (la receta del spike + temps vivos + trampas)
// ---------------------------------------------------------------------------
function mat(vm, method, rcvr, args, temps, pc, ops, tag) {
    var ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame());
    var p = ctx.pointers;
    p[Squeak.Context_method] = method;
    p[Squeak.BlockContext_initialIP] = vm.nilObj;
    p[Squeak.Context_sender] = vm.nilObj;      // SIEMPRE: pointers[0] trae el link de la free list
    p[Squeak.Context_receiver] = rcvr;
    var TFS = Squeak.Context_tempFrameStart,
        nT = method.methodTempCount(), i, j;
    for (i = 0; i < nT; i++) p[TFS + i] = vm.nilObj;          // base limpia (basura del reciclado)
    for (i = 0; i < args.length; i++) p[TFS + i] = args[i];
    for (i = 0; i < temps.length; i++) p[TFS + args.length + i] = temps[i];
    var base = TFS + nT;
    for (j = 0; j < ops.length; j++) p[base + j] = ops[j];
    p[Squeak.Context_instructionPointer] = vm.encodeSqueakPC(pc, method);
    p[Squeak.Context_stackPointer] = vm.encodeSqueakSP(base + ops.length - 1);  // EXACTO o el GC nilea/corre
    ctx.dirty = true;
    vm.nDeoptFramesDirecto++;
    if (vm.deoptInner === null) {
        if (vm.directoCensoDeopt) {
            var kk = tag === null || tag === undefined ? "D1/D2 interrupcion"
                   : tag.mbb ? "D6 mustBeBoolean"
                   : tag.si !== undefined ? "D4 especial si" + tag.si
                   : tag.dirsuper ? "D5 super dirigido" : "D5 frontera de send";
            vm.directoCensoDeopt[kk] = (vm.directoCensoDeopt[kk] || 0) + 1;
        }
        vm.deoptInner = ctx;
        vm.deoptPendiente = tag || null;
        vm.deoptIniciador = method;
        vm.nDeoptEventosDirecto++;
    } else {
        vm.deoptOuter.pointers[Squeak.Context_sender] = ctx;
    }
    vm.deoptOuter = ctx;
    return DEOPT;
}

// ---------------------------------------------------------------------------
// El hook: vive DENTRO de executeNewMethod (post-tryPrimitive, pre-decode).
// Devuelve true si la activación quedó manejada (directo o deopt completada).
// ---------------------------------------------------------------------------
function hook(vm, newRcvr, newMethod, argumentCount) {
    var f = newMethod.directo;
    if (f === undefined) { newMethod.directo = 1; return false; }
    if (typeof f === "number") {
        if (f < UMBRAL) { newMethod.directo = f + 1; return false; }
        if (FILTRO !== null && ((newMethod.hash >>> 0) % FILTRO.div) !== FILTRO.rem) {
            newMethod.directo = false; return false;    // biseccion: fuera del filtro
        }
        f = instalar(vm, newMethod);            // función o false (vetado)
        if (typeof f !== "function") return false;
    }
    if (typeof f !== "function") return false;  // false = vetado
    if (argumentCount !== f.numArgs) return false;
    if (vm.logSends || vm.breakOnMethod !== null || vm.breakOnContextChanged ||
        vm.breakOutOfInterpreter !== false) return false;   // freeze/break pendiente: al clasico
    // sendCount de la entrada ya lo contó executeNewMethod (línea ~1116).
    var st = vm.stack, b = vm.sp - argumentCount;
    var v;
    vm.popN(argumentCount + 1);                 // INCONDICIONAL (éxito o deopt)
    switch (argumentCount) {                    // llamada monomórfica por aridad
        case 0: v = f(vm, newRcvr, 1); break;
        case 1: v = f(vm, newRcvr, st[b + 1], 1); break;
        case 2: v = f(vm, newRcvr, st[b + 1], st[b + 2], 1); break;
        case 3: v = f(vm, newRcvr, st[b + 1], st[b + 2], st[b + 3], 1); break;
        default: v = f(vm, newRcvr, st[b + 1], st[b + 2], st[b + 3], st[b + 4], 1); break;
    }
    if (v !== DEOPT) { vm.push(v); return true; }   // el caller clásico sigue inline
    epilogo(vm);
    return true;
}

// Epílogo de deopt: instalar la cadena y hacer exactamente UNA acción terminal.
function epilogo(vm) {
    vm.deoptOuter.pointers[Squeak.Context_sender] = vm.activeContext;
    vm.storeContextRegisters();
    vm.activeContext = vm.deoptInner;
    vm.fetchContextRegisters(vm.deoptInner);
    vm.deoptInner = vm.deoptOuter = null;
    vm.reclaimableContextCount = 0;
    vm.activeContext.dirty = true;
    var pend = vm.deoptPendiente;
    vm.deoptPendiente = null;
    var ini = vm.deoptIniciador;
    vm.deoptIniciador = null;
    if (pend !== null) {
        // frontera: contabilidad de veto sobre el método que la inició
        if (ini && typeof ini.directo === "function") {
            var g = ini.directo;
            g.nFronteras++;
            if (g.nFronteras >= VETO_MIN_FRONTERAS && g.nFronteras * 2 > g.nLlamadas) {
                ini.directo = false;            // vetado: deoptimiza más de lo que corre
                vm.nDirectoVetados++;
            }
        }
        if (pend.mbb === true) vm.send(vm.specialObjects[Squeak.splOb_SelectorMustBeBoolean], 0, false);
        else if (pend.si !== undefined) replayEspecial(vm, pend.si);
        // pend.lit es el indice DE pointers (1+literalIdx), leido por activacion
        // desde el metodo del frame mas interno: nunca se hornea el objeto selector
        // en la clausura (become sobre el selector quedaria stale).
        else if (pend.dirsuper === true) vm.sendSuperDirected(vm.method.pointers[pend.lit], pend.argc);
        else vm.send(vm.method.pointers[pend.lit], pend.argc, pend.sup === true);
    } else if (vm.interruptCheckCounter <= 0) {
        vm.checkForInterrupts();
    }
}

// ---------------------------------------------------------------------------
// Replay del SEGUNDO NIVEL de un special send, con la pila YA sincronizada
// (el frame materializado es activeContext y los operandos estan repuestos).
//
// Por que existe: el jit clasico resuelve muchas especiales sin hacer un send —
// primero un fast path inline, y si falla, un helper (pop2AndPush*, objectAt,
// quickSendOther) que puede tener exito. Recien si el helper falla hace
// sendSpecial. Si la frontera del modo directo fuera directo a sendSpecial,
// AGREGARIA sends reales que el clasico no hace: medido, +1.240 sends (+0,5%)
// en el diferencial, con la traza del oraculo divergiendo. sendCount es
// semantico (es la linea de tiempo del replay de eventos), asi que esto es
// infidelidad, no solo ruido. Cada rama de abajo es copia byte a byte de su
// plantilla en jit.js: si cambia alla, cambia aca.
// ---------------------------------------------------------------------------
function replayEspecial(vm, si) {
    if (vm.directoCensoReplay) {
        var k = "si" + si;
        vm.directoCensoReplay[k] = (vm.directoCensoReplay[k] || 0) + 1;
    }
    switch (si) {
        // 0x60-0x67: aritmetica y comparaciones — el nivel 2 acepta floats y
        // LargeInts de 4 bytes sin send (jit.js:1139-1210)
        case 0: vm.success = true; vm.resultIsFloat = false;
            if (vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) + vm.stackIntOrFloat(0))) return; break;
        case 1: vm.success = true; vm.resultIsFloat = false;
            if (vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) - vm.stackIntOrFloat(0))) return; break;
        case 2: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) < vm.stackIntOrFloat(0))) return; break;
        case 3: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) > vm.stackIntOrFloat(0))) return; break;
        case 4: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) <= vm.stackIntOrFloat(0))) return; break;
        case 5: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) >= vm.stackIntOrFloat(0))) return; break;
        case 6: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) === vm.stackIntOrFloat(0))) return; break;
        case 7: vm.success = true;
            if (vm.pop2AndPushBoolResult(vm.stackIntOrFloat(1) !== vm.stackIntOrFloat(0))) return; break;
        // 0x68-0x6F: sin fast path inline en el clasico, todo por helpers
        case 8: vm.success = true; vm.resultIsFloat = false;
            if (vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) return; break;
        case 9: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1), vm.stackInteger(0)))) return; break;
        case 10: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1), vm.stackInteger(0)))) return; break;
        case 11: vm.success = true;
            if (vm.primHandler.primitiveMakePoint(1, true)) return; break;
        case 12: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1), vm.stackInteger(0)))) return; break;
        case 13: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1), vm.stackInteger(0)))) return; break;
        case 14: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.stackInteger(1) & vm.stackInteger(0))) return; break;
        case 15: vm.success = true;
            if (vm.pop2AndPushIntResult(vm.stackInteger(1) | vm.stackInteger(0))) return; break;
        // 0x70-0x7F quick sends: at:/at:put:/size y los de quickSendOther
        // (blockCopy:/value/value:) resuelven sin send cuando aciertan
        case 16: {
            var c = vm.primHandler.objectAt(true, true, false);
            if (vm.primHandler.success) { vm.stack[vm.sp -= 1] = c; return; }
            break;
        }
        case 17: {
            var v17 = vm.stack[vm.sp];
            vm.primHandler.objectAtPut(true, true, false);
            if (vm.primHandler.success) { vm.stack[vm.sp -= 2] = v17; return; }
            break;
        }
        case 18: break;   // el clasico no tiene nivel 2 para size: va directo a send
        default:
            // 19-31: quickSendOther cubre 22,23,24,25,26 (== class blockCopy: value value:)
            // y devuelve false para el resto, que sí van a send completo — igual que el clasico
            if (vm.primHandler.quickSendOther(vm.receiver, si - 16)) return;
            break;
    }
    if (vm.directoCensoReplay) {
        var kf = "si" + si + "-FALLO";
        vm.directoCensoReplay[kf] = (vm.directoCensoReplay[kf] || 0) + 1;
    }
    vm.sendSpecial(si);   // el helper fallo: send real, como hace el clasico
}

// ---------------------------------------------------------------------------
// Instalación: compilar y colgar .directo del método (además fuerza .compiled,
// para que la reanudación post-deopt jamás caiga a interpretOne-por-bytecode)
// ---------------------------------------------------------------------------
function instalar(vm, method) {
    var f = false;
    try { f = compilar(vm, method); }
    catch (e) {
        vm.nDirectoErroresCodegen++;
        if (vm.directoDebug) console.warn("[directo] codegen fallo: " + e.message);
        f = false;
    }
    method.directo = f;
    if (typeof f === "function") {
        vm.nDirectoCompilados++;
        if (vm.directoDebug && vm.nDirectoCompilados <= (vm.directoVolcarN || 0))
            console.error("=== directo #" + vm.nDirectoCompilados + " (" + method.bytes.length + "b) ===\n" + f.fuente);
        if (!method.compiled && vm.compiler) {   // protocolo dos-fases del jit clásico
            vm.compiler.compile(method);         // 1ª llamada: marca false
            if (!method.compiled) vm.compiler.compile(method);  // 2ª: genera
        }
    } else {
        vm.nDirectoRechazados++;
    }
    return f;
}

// ---------------------------------------------------------------------------
// PASE 1: decodificación + elegibilidad + profundidades (interpretación
// abstracta con worklist). Deriva de herramientas/censo/censo-lib.js, validado
// 19.162/19.162 contra Cuis. Devuelve null si el método no es elegible.
// ---------------------------------------------------------------------------
var MOTIVOS = null;   // censo de rechazos del gate (DIRECTOMOTIVOS=1)
function NO(motivo) { if (MOTIVOS) MOTIVOS[motivo] = (MOTIVOS[motivo] || 0) + 1; return null; }
function pase1(method) {
    if (!method.methodSignFlag()) return NO("solo Sista");           // solo Sista
    if (method.methodPrimitiveIndex() !== 0) return NO("v1: sin primitivas (hojas quick: etapa"); // v1: sin primitivas (hojas quick: etapa 1b)
    var numArgs = method.methodNumArgs();
    if (numArgs > 4) return NO("r2");
    var bytes = method.bytes;
    if (bytes.length > 400) return NO("r3");

    // decodificación lineal a instrucciones {pc, sig, op, ...}
    var instrs = [], porPc = {}, atras = [], pc = 0, extA = 0, extB = 0, endPC = 0, fin = false;
    var pcInicio = -1;
    while (!fin) {
        if (pc >= bytes.length) return NO("fin sin return");             // fin sin return
        // pcInicio es el pc de la instruccion COMPLETA, prefijos de extension
        // incluidos: los saltos apuntan ahi, no al bytecode que sigue al prefijo
        // (perder esto hacia rechazar 40 metodos por "salto al medio")
        if (pcInicio < 0) pcInicio = pc;
        var pc0 = pcInicio, b = bytes[pc++];
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var vext = bytes[pc++]; extB = extB * 256 + (vext < 128 ? vext : vext - 256); continue; }
        var eA = extA, eB = extB, b2, b3, ins = null, dist;
        extA = 0; extB = 0;
        if (b <= 0x0F) ins = { op: "pushInst", i: b & 0xF, d: +1 };
        else if (b <= 0x1F) ins = { op: "pushLitVar", n: b & 0xF, d: +1 };
        else if (b <= 0x3F) ins = { op: "pushLit", n: b & 0x1F, d: +1 };
        else if (b <= 0x47) ins = { op: "pushTemp", i: b & 0xF, d: +1 };
        else if (b <= 0x4B) ins = { op: "pushTemp", i: (b & 0x3) + 8, d: +1 };
        else if (b === 0x4C) ins = { op: "pushRcvr", d: +1 };
        else if (b === 0x4D) ins = { op: "pushVM", campo: "trueObj", d: +1 };
        else if (b === 0x4E) ins = { op: "pushVM", campo: "falseObj", d: +1 };
        else if (b === 0x4F) ins = { op: "pushVM", campo: "nilObj", d: +1 };
        else if (b === 0x50) ins = { op: "pushInt", v: 0, d: +1 };
        else if (b === 0x51) ins = { op: "pushInt", v: 1, d: +1 };
        else if (b === 0x52) return NO("thisContext / thisProcess");                // thisContext / thisProcess
        else if (b === 0x53) ins = { op: "dup", d: +1 };
        else if (b >= 0x54 && b <= 0x57) return NO("no usados");    // no usados
        else if (b === 0x58) { ins = { op: "retRcvr", d: 0, term: true }; }
        else if (b === 0x59) { ins = { op: "retVM", campo: "trueObj", d: 0, term: true }; }
        else if (b === 0x5A) { ins = { op: "retVM", campo: "falseObj", d: 0, term: true }; }
        else if (b === 0x5B) { ins = { op: "retVM", campo: "nilObj", d: 0, term: true }; }
        else if (b === 0x5C) { ins = { op: "retTope", d: -1, term: true }; }
        else if (b === 0x5D || b === 0x5E) return NO("blockReturn (solo en closures)");  // blockReturn (solo en closures)
        else if (b === 0x5F) ins = { op: "nop", d: 0 };
        else if (b <= 0x6F) ins = { op: "especial", si: b - 0x60, d: -1 };       // binarios
        else if (b <= 0x7F) {
            var si = b - 0x60, argcQ = QUICK_ARGC[si - 16];
            if (SIN_QUICK && si !== 22 && si !== 23) return NO("biseccion");   // biseccion
            ins = { op: "quick", si: si, argc: argcQ, d: -argcQ };
        }
        else if (b <= 0x8F) ins = { op: "send", n: b & 0xF, argc: 0, d: 0 };
        else if (b <= 0x9F) ins = { op: "send", n: b & 0xF, argc: 1, d: -1 };
        else if (b <= 0xAF) ins = { op: "send", n: b & 0xF, argc: 2, d: -2 };
        else if (b <= 0xB7) { dist = (b & 7) + 1; ins = { op: "jump", destino: pc + dist, d: 0, term: true }; }
        else if (b <= 0xBF) { dist = (b & 7) + 1; ins = { op: "jumpIf", cond: true, destino: pc + dist, d: -1 }; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; ins = { op: "jumpIf", cond: false, destino: pc + dist, d: -1 }; }
        else if (b <= 0xCF) ins = { op: "popIntoInst", i: b & 7, d: -1 };
        else if (b <= 0xD7) ins = { op: "popIntoTemp", i: b - 0xD0, d: -1 };
        else if (b === 0xD8) ins = { op: "pop", d: -1 };
        else if (b <= 0xDF) return NO("trap 0xD9 / no usados");                 // trap 0xD9 / no usados
        else if (b === 0xE2) { b2 = bytes[pc++]; ins = { op: "pushInst", i: b2 + (eA << 8), d: +1 }; }
        else if (b === 0xE3) { b2 = bytes[pc++]; ins = { op: "pushLitVar", n: b2 + (eA << 8), d: +1 }; }
        else if (b === 0xE4) { b2 = bytes[pc++]; ins = { op: "pushLit", n: b2 + (eA << 8), d: +1 }; }
        else if (b === 0xE5) { b2 = bytes[pc++]; ins = { op: "pushTemp", i: b2, d: +1 }; }
        else if (b === 0xE6) return NO("r10");
        else if (b === 0xE7) return NO("brace arrays: rechazado en v1 (decisió");                // brace arrays: rechazado en v1 (decisión documentada)
        else if (b === 0xE8) { b2 = bytes[pc++]; ins = { op: "pushInt", v: b2 + (eB << 8), d: +1 }; }
        else if (b === 0xE9) { b2 = bytes[pc++]; ins = { op: "pushChar", v: b2 + (eB << 8), d: +1 }; }
        else if (b === 0xEA) {
            b2 = bytes[pc++];
            ins = { op: "send", n: (b2 >> 3) + (eA << 5), argc: (b2 & 7) + (eB << 3) };
            ins.d = -ins.argc;
        }
        else if (b === 0xEB) {
            b2 = bytes[pc++];
            if (eB >= 64) ins = { op: "superDir", n: (b2 >> 3) + (eA << 5), argc: (b2 & 7) + ((eB - 64) << 3), d: 0 };
            else ins = { op: "send", n: (b2 >> 3) + (eA << 5), argc: (b2 & 7) + (eB << 3), sup: true };
            if (ins.op === "superDir") ins.d = -ins.argc - 1;   // popea también la clase dirigida
            else ins.d = -ins.argc;
        }
        else if (b === 0xED) { b2 = bytes[pc++]; dist = b2 + eB * 256; ins = { op: "jump", destino: pc + dist, d: 0, term: true }; }
        else if (b === 0xEE) { b2 = bytes[pc++]; dist = b2 + eB * 256; ins = { op: "jumpIf", cond: true, destino: pc + dist, d: -1 }; }
        else if (b === 0xEF) { b2 = bytes[pc++]; dist = b2 + eB * 256; ins = { op: "jumpIf", cond: false, destino: pc + dist, d: -1 }; }
        else if (b === 0xF0) { b2 = bytes[pc++]; ins = { op: "popIntoInst", i: b2 + (eA << 8), d: -1 }; }
        else if (b === 0xF1) { b2 = bytes[pc++]; ins = { op: "popIntoLitVar", n: b2 + (eA << 8), d: -1 }; }
        else if (b === 0xF2) { b2 = bytes[pc++]; ins = { op: "popIntoTemp", i: b2, d: -1 }; }
        else if (b === 0xF3) { b2 = bytes[pc++]; ins = { op: "storeInst", i: b2 + (eA << 8), d: 0 }; }
        else if (b === 0xF4) { b2 = bytes[pc++]; ins = { op: "storeLitVar", n: b2 + (eA << 8), d: 0 }; }
        else if (b === 0xF5) { b2 = bytes[pc++]; ins = { op: "storeTemp", i: b2, d: 0 }; }
        else return NO("F6-FF: callPrim/closures/remoteTemps/d");                                // F6-FF: callPrim/closures/remoteTemps/desconocidos

        if (ins.op === "jump" || ins.op === "jumpIf") {
            if (ins.destino <= pc0) {                    // salto hacia atras = loop
                if (SIN_LOOPS) return NO("salto hacia atras = loop");
                if (ins.op !== "jump") return NO("gate (a): condicional hacia atras");      // gate (a): condicional hacia atras
                ins.atras = true;
                atras.push(ins);
            } else if (ins.destino > endPC) endPC = ins.destino;
        }
        ins.pc = pc0; ins.sig = pc;
        pcInicio = -1;
        instrs.push(ins); porPc[pc0] = ins;
        if (ins.term && ins.op !== "jump" && pc > endPC) fin = true;   // return más allá del último destino
    }

    // interpretación abstracta: profundidad única por pc
    var depth = {}, work = [{ pc: instrs[0].pc, d: 0 }], maxD = 0;
    while (work.length > 0) {
        var w = work.pop(), ins2 = porPc[w.pc];
        if (ins2 === undefined) return NO("salto al medio de una instrucción");             // salto al medio de una instrucción
        if (depth[w.pc] !== undefined) {
            if (depth[w.pc] !== w.d) return NO("join inconsistente");        // join inconsistente
            continue;
        }
        depth[w.pc] = w.d;
        var dDespues = w.d + ins2.d;
        if (w.d < 0 || dDespues < 0) return NO("r17");
        var antes = ins2.op === "jumpIf" ? w.d : dDespues;
        if (antes > maxD) maxD = antes;
        if (w.d > maxD) maxD = w.d;
        if (ins2.op === "jump") { work.push({ pc: ins2.destino, d: dDespues }); continue; }
        if (ins2.op === "jumpIf") work.push({ pc: ins2.destino, d: dDespues });
        if (!ins2.term) work.push({ pc: ins2.sig, d: dDespues });
    }

    var numTemps = method.methodTempCount();
    var capacidad = (method.methodNeedsLargeFrame() ? 62 : 22) - Squeak.Context_tempFrameStart;
    if (numTemps + maxD > capacidad) return NO("red que el clásico no tiene");        // red que el clásico no tiene

    // Regiones de loop: por cada destino de back-jump H, el loop abarca [H, fin)
    // donde fin = el sig del ULTIMO latch que vuelve a H (multi-latch permitido).
    var loops = [];
    for (var li = 0; li < atras.length; li++) {
        var H = atras[li].destino;
        if (depth[H] === undefined) return NO("header inalcanzable: al clasico");         // header inalcanzable: al clasico
        var ya = null;
        for (var lj = 0; lj < loops.length; lj++) if (loops[lj].H === H) ya = loops[lj];
        if (ya === null) { ya = { H: H, fin: 0 }; loops.push(ya); }
        if (atras[li].sig > ya.fin) ya.fin = atras[li].sig;
    }
    loops.sort(function(a, b) { return a.H - b.H; });
    // gate (b): loops anidados o disjuntos, nunca parcialmente solapados
    for (var i1 = 0; i1 < loops.length; i1++)
        for (var i2 = i1 + 1; i2 < loops.length; i2++)
            if (!(loops[i2].fin <= loops[i1].fin || loops[i2].H >= loops[i1].fin)) return NO("r20");
    // gate (c): ningun salto de AFUERA aterriza ESTRICTAMENTE adentro de un loop
    for (var k1 = 0; k1 < instrs.length; k1++) {
        var j1 = instrs[k1];
        if (j1.destino === undefined || j1.atras) continue;
        for (var k2 = 0; k2 < loops.length; k2++) {
            var L = loops[k2];
            if (j1.pc < L.H && j1.destino > L.H && j1.destino < L.fin) return NO("r21");
        }
    }
    // cada destino forward pertenece a la region de loop mas interna que lo contiene
    function regionDe(t) {
        var mejor = -1;
        for (var q = 0; q < loops.length; q++)
            // OJO el < estricto: un destino que ES el header de un loop NO esta
            // adentro — su bloque tiene que cerrar justo ANTES del for(;;), porque
            // los saltos que van al header vienen de afuera (si abriera adentro,
            // el break quedaria sin label: 'Undefined label b37')
            if (loops[q].H < t && t < loops[q].fin && loops[q].H > mejor) mejor = loops[q].H;
        return mejor;                                    // -1 = region de la funcion
    }

    return { instrs: instrs, depth: depth, maxD: maxD, numArgs: numArgs, numTemps: numTemps,
             loops: loops, regionDe: regionDe };
}

// argc de los quick sends 0x70-0x7F (índices 16-31 de specialSelectors)
var QUICK_ARGC = [1, 2, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0];
// índices quick: 16 at:, 17 at:put:, 18 size, 19 next, 20 nextPut:, 21 atEnd,
// 22 ==, 23 class, 24 blockCopy:, 25 value, 26 value:, 27 do:, 28 new, 29 new:, 30 x, 31 y

// ---------------------------------------------------------------------------
// EMISIÓN (modo BLK): bloques etiquetados 1:1 con los saltos, operandos en
// locales s{i} por profundidad estática, deopts D1-D6 según la tabla de la spec.
// ---------------------------------------------------------------------------
function compilar(vm, method) {
    if (vm.directoCosto) vm.directoCosto._t0 = Date.now();
    var p1 = pase1(method);
    if (p1 === null) return false;
    var instrs = p1.instrs, depth = p1.depth,
        numArgs = p1.numArgs, numTemps = p1.numTemps, maxD = p1.maxD;

    var nombre = nombredirecto(vm, method);
    var argsJS = [];
    for (var a = 0; a < numArgs; a++) argsJS.push("a" + a);
    var firma = ["vm", "r"].concat(argsJS).concat(["d"]).join(", ");

    // materialización parametrizada del sitio: args y temps como literales de array
    var ARGS = numArgs === 0 ? "RT.VACIO" : "[" + argsJS.join(",") + "]";
    function TEMPS() {
        if (numTemps === numArgs) return "RT.VACIO";
        var ts = [];
        for (var t = numArgs; t < numTemps; t++) ts.push("t" + t);
        return "[" + ts.join(",") + "]";
    }
    function OPS(n, extra) {
        var xs = [];
        for (var k = 0; k < n; k++) xs.push("s" + k);
        if (extra !== undefined) xs.push(extra);
        return xs.length === 0 ? "RT.VACIO" : "[" + xs.join(",") + "]";
    }
    function MAT(pcRet, opsTxt, tagTxt) {
        return "return RT.mat(vm, METH, r, " + ARGS + ", " + TEMPS() + ", " + pcRet + ", " + opsTxt + ", " + tagTxt + ");";
    }

    var src = [];
    src.push("'use strict';\nreturn function " + nombre + "(" + firma + ") {\n");
    // D1: entrada (interrupciones o profundidad) — post-decremento espejo del clásico
    src.push("if (vm.interruptCheckCounter-- <= 0 || d > " + TOPE_PROFUNDIDAD + ") "
        + MAT("0", "RT.VACIO", "null") + "\n");
    var usaLit = instrs.some(function(i) { return i.op === "pushLit" || i.op === "pushLitVar" || i.op === "popIntoLitVar" || i.op === "storeLitVar"; });
    var usaInst = instrs.some(function(i) { return i.op === "pushInst" || i.op === "popIntoInst" || i.op === "storeInst"; });
    if (usaLit) src.push("var lit = METH.pointers;\n");
    if (usaInst) src.push("var inst = r.pointers;\n");
    for (var t = numArgs; t < numTemps; t++) src.push("var t" + t + " = vm.nilObj;\n");
    if (maxD > 0) {
        var esses = [];
        for (var s = 0; s < maxD; s++) esses.push("s" + s);
        src.push("var " + esses.join(", ") + ";\n");
    }
    src.push("var x, y, v;\n");

    // Estructura: bloques etiquetados para los saltos hacia adelante y for(;;)
    // etiquetados para los loops, anidados correctamente. Cada destino forward
    // abre su bloque al principio de la region que lo contiene (la funcion, o el
    // header del loop mas interno); dentro de una region anidan por destino
    // DECRECIENTE. Asi un "break bT" desde adentro de un loop hacia un T de
    // afuera sale del loop y aterriza donde debe, sin caso especial.
    var loops = p1.loops, regionDe = p1.regionDe;
    var aperturas = {};
    instrs.forEach(function(i) {
        if (i.destino === undefined || i.atras) return;
        var clave = regionDe(i.destino); if (clave < 0) clave = "fn";
        if (!aperturas[clave]) aperturas[clave] = [];
        if (aperturas[clave].indexOf(i.destino) < 0) aperturas[clave].push(i.destino);
    });
    Object.keys(aperturas).forEach(function(k) { aperturas[k].sort(function(a2, b2) { return b2 - a2; }); });
    var abiertos = [];
    function abrirBloquesDe(clave) {
        (aperturas[clave] || []).forEach(function(dst) {
            src.push("b" + dst + ": {\n");
            abiertos.push({ cierra: dst });
        });
    }
    abrirBloquesDe("fn");

    for (var ix = 0; ix < instrs.length; ix++) {
        var ins = instrs[ix];
        // cerrar los bloques cuyo destino es este pc (el más interno primero)
        while (abiertos.length > 0 && abiertos[abiertos.length - 1].cierra === ins.pc) {
            src.push("}\n"); abiertos.pop();
        }
        for (var lp = 0; lp < loops.length; lp++) if (loops[lp].H === ins.pc) {
            src.push("L" + loops[lp].H + ": for(;;) {\n");
            abiertos.push({ cierra: loops[lp].fin });
            abrirBloquesDe(loops[lp].H);
        }
        var D = depth[ins.pc];
        if (D === undefined) continue;                    // código muerto (inalcanzable)
        var Q = ins.sig;                                  // pc de retorno post-instrucción
        switch (ins.op) {
            case "pushInst":   src.push("s" + D + " = inst[" + ins.i + "];\n"); break;
            case "pushLitVar": src.push("s" + D + " = lit[" + (1 + ins.n) + "].pointers[1];\n"); break;
            case "pushLit":    src.push("s" + D + " = lit[" + (1 + ins.n) + "];\n"); break;
            case "pushTemp":   src.push("s" + D + " = " + (ins.i < numArgs ? "a" + ins.i : "t" + ins.i) + ";\n"); break;
            case "pushRcvr":   src.push("s" + D + " = r;\n"); break;
            case "pushVM":     src.push("s" + D + " = vm." + ins.campo + ";\n"); break;
            case "pushInt":    src.push("s" + D + " = " + ins.v + ";\n"); break;
            case "pushChar":   src.push("s" + D + " = vm.image.getCharacter(" + ins.v + ");\n"); break;
            case "dup":        src.push("s" + D + " = s" + (D - 1) + ";\n"); break;
            case "pop": case "nop": break;
            case "popIntoTemp": case "storeTemp":
                src.push((ins.i < numArgs ? "a" + ins.i : "t" + ins.i) + " = s" + (D - 1) + ";\n"); break;
            case "popIntoInst": case "storeInst":
                src.push("inst[" + ins.i + "] = s" + (D - 1) + "; r.dirty = true;\n"); break;
            case "popIntoLitVar": case "storeLitVar":
                src.push("x = lit[" + (1 + ins.n) + "]; x.pointers[1] = s" + (D - 1) + "; x.dirty = true;\n"); break;
            case "retRcvr":  src.push("return r;\n"); break;
            case "retVM":    src.push("return vm." + ins.campo + ";\n"); break;
            case "retTope":  src.push("return s" + (D - 1) + ";\n"); break;
            case "jump":
                if (ins.atras) {
                    // back-edge: chequeo de interrupciones ANTES de volver, igual que el
                    // jit clasico (generateJump con distancia negativa). D2 materializa
                    // en el pc del DESTINO, que es label por definicion.
                    src.push("if (vm.interruptCheckCounter-- <= 0) "
                        + MAT(ins.destino, OPS(depth[ins.destino] || 0), "null") + "\n"
                        + "continue L" + ins.destino + ";\n");
                } else src.push("break b" + ins.destino + ";\n");
                break;
            case "jumpIf":
                // D6: condición no-booleana → materializar en el pc del FALL-THROUGH
                // con la condición REPUESTA y replay del send mustBeBoolean
                src.push("x = s" + (D - 1) + ";\n");
                if (ins.cond) src.push("if (x === vm.trueObj) break b" + ins.destino + ";\n"
                    + "else if (x !== vm.falseObj) { " + MAT(Q, OPS(D - 1, "x"), "{mbb:true}") + " }\n");
                else src.push("if (x === vm.falseObj) break b" + ins.destino + ";\n"
                    + "else if (x !== vm.trueObj) { " + MAT(Q, OPS(D - 1, "x"), "{mbb:true}") + " }\n");
                break;
            case "especial":  emitirEspecial(src, ins, D, Q, MAT, OPS); break;
            case "quick":     emitirQuick(src, ins, D, Q, MAT, OPS); break;
            case "send": {
                // v1a: FRONTERA SIEMPRE (D5). v1b (llamada directa) se enciende con vm.directoEncadenar.
                var tag = "{lit:" + (1 + ins.n) + ", argc:" + ins.argc + (ins.sup ? ", sup:true" : "") + "}";
                if (vm.directoEncadenar && !ins.sup) {
                    var m = ins.argc, rxSlot = "s" + (D - m - 1);
                    var argsCall = [];
                    for (var k2 = 0; k2 < m; k2++) argsCall.push("s" + (D - m + k2));
                    src.push("x = " + rxSlot + ";\n"
                        + "y = typeof x === 'number' ? vm.specialObjects[" + Squeak.splOb_ClassInteger + "] : x.sqClass;\n"
                        + "var e" + ins.pc + " = vm.findMethodCacheEntry(METH.pointers[" + (1 + ins.n) + "], y);\n"
                        + "v = e" + ins.pc + ".method !== null ? e" + ins.pc + ".method.directo : undefined;\n"
                        + "if (typeof v === 'function' && v.numArgs === " + m + ") {\n"
                        + (TRAZA ? "  if (vm.directoTraceHook) vm.directoTraceHook(e" + ins.pc + ".method, vm.sendCount, x, METH.pointers[" + (1 + ins.n) + "], " + Q + ");\n" : "")
                        + "  vm.sendCount++; v.nLlamadas++;\n"
                        + "  v = v(vm, x" + (argsCall.length ? ", " + argsCall.join(", ") : "") + ", d + 1);\n"
                        + "  if (v === DEOPT) { " + MAT(Q, OPS(D - m - 1), "null") + " }\n"   // D3
                        + "  " + rxSlot + " = v;\n"
                        + "} else { " + MAT(Q, OPS(D), tag) + " }\n");                        // D5
                } else {
                    src.push(MAT(Q, OPS(D), tag) + "\n");                                     // D5 siempre
                }
                break;
            }
            case "superDir":
                src.push(MAT(Q, OPS(D), "{dirsuper:true, lit:" + (1 + ins.n) + ", argc:" + ins.argc + "}") + "\n");
                break;
            default:
                throw Error("emision: op desconocida " + ins.op);
        }
    }
    while (abiertos.length > 0) { src.push("}\n"); abiertos.pop(); }
    src.push("return r;\n");   // inalcanzable (todo camino termina en return/deopt); calma al parser
    src.push("}");

    var texto = src.join("");
    // MEDICION del reparto del costo de compilar (DIRECTOCOSTO=1): la mitad
    // "analisis" (pase1 + emision, todo JS nuestro sobre bytes+header) es
    // delegable a otro worker; la mitad "new Function" NO lo es, porque la
    // funcion tiene que cerrarse sobre los objetos de ESTE worker.
    if (vm.directoCosto) vm.directoCosto.analisis += Date.now() - vm.directoCosto._t0;
    var t1 = vm.directoCosto ? Date.now() : 0;
    var fabrica = new Function("vm", "METH", "RT", "DEOPT", texto);
    var fn = fabrica(vm, method, RT, DEOPT);
    if (vm.directoCosto) { vm.directoCosto.newFunction += Date.now() - t1; vm.directoCosto.bytes += texto.length; }
    fn.numArgs = numArgs;
    fn.nLlamadas = 0;
    fn.nFronteras = 0;
    if (vm.directoDebug) fn.fuente = texto;
    return fn;
}

// especiales binarios 0x60-0x67: espejo byte a byte de los fast paths del jit clásico
function emitirEspecial(src, ins, D, Q, MAT, OPS) {
    var a = "s" + (D - 2), b = "s" + (D - 1), si = ins.si;
    var frontera = MAT(Q, OPS(D), "{si:" + si + "}");
    if (si <= 1) {          // + -
        var opTxt = si === 0 ? " + " : " - ";
        src.push("x = " + a + "; y = " + b + ";\n"
            + "if (typeof x === 'number' && typeof y === 'number') {\n"
            + "  v = x" + opTxt + "y;\n"
            + "  " + a + " = (v >= -1073741824 && v <= 1073741823) ? v : vm.primHandler.signed32BitIntegerFor(v);\n"
            + "} else { " + frontera + " }\n");
    } else if (si >= 2 && si <= 5) {   // < > <= >=
        var cmp = ["<", ">", "<=", ">="][si - 2];
        src.push("x = " + a + "; y = " + b + ";\n"
            + "if (typeof x === 'number' && typeof y === 'number') {\n"
            + "  " + a + " = x " + cmp + " y ? vm.trueObj : vm.falseObj;\n"
            + "} else { " + frontera + " }\n");
    } else if (si === 6 || si === 7) { // = ~= (con el fast path de identidad+NaN del jit)
        var t = si === 6 ? "vm.trueObj" : "vm.falseObj", f = si === 6 ? "vm.falseObj" : "vm.trueObj";
        src.push("x = " + a + "; y = " + b + ";\n"
            + "if (typeof x === 'number' && typeof y === 'number') {\n"
            + "  " + a + " = x === y ? " + t + " : " + f + ";\n"
            + "} else if (x === y && x.float === x.float) {\n"
            + "  " + a + " = " + t + ";\n"
            + "} else { " + frontera + " }\n");
    } else {                // * / \\ @ bitShift: // bitAnd: bitOr: → frontera siempre en v1
        src.push(MAT(Q, OPS(D), "{si:" + si + "}") + "\n");
    }
}

// quick sends 0x70-0x7F. Los fast paths son copia BYTE A BYTE de jit.js
// (generateQuickPrim): si el directo no los reprodujera y mandara todo a
// frontera, el replay llamaria a los helpers donde el clasico resuelve inline,
// y eso ALTERA la traza — medido con el oraculo: divergencia en el send 8361
// (un Array>>at:put: real que el clasico nunca hace). Con estos inline el
// oraculo da traza identica.
function emitirQuick(src, ins, D, Q, MAT, OPS) {
    var frontera = MAT(Q, OPS(D), "{si:" + ins.si + "}");
    switch (ins.si) {
        case 16:    // at: — solo Array con indice number en rango (jit.js:1049-1053)
            src.push("x = s" + (D - 2) + "; y = s" + (D - 1) + ";\n"
                + "if (x.sqClass === vm.specialObjects[7] && x.pointers && typeof y === 'number' && y>0 && y<=x.pointers.length) {\n"
                + "  s" + (D - 2) + " = x.pointers[y-1];\n"
                + "} else { " + frontera + " }\n");
            return;
        case 17:    // at:put: — el resultado es el VALOR, no el receptor (jit.js:1072-1077)
            src.push("x = s" + (D - 3) + "; y = s" + (D - 2) + "; v = s" + (D - 1) + ";\n"
                + "if (x.sqClass === vm.specialObjects[7] && x.pointers && typeof y === 'number' && y>0 && y<=x.pointers.length) {\n"
                + "  x.pointers[y-1] = v; x.dirty = true; s" + (D - 3) + " = v;\n"
                + "} else { " + frontera + " }\n");
            return;
        case 18:    // size — Array y ByteString inline, el resto send (jit.js:1082-1086)
            src.push("x = s" + (D - 1) + ";\n"
                + "if (x.sqClass === vm.specialObjects[7]) s" + (D - 1) + " = x.pointersSize();\n"
                + "else if (x.sqClass === vm.specialObjects[6]) s" + (D - 1) + " = x.bytesSize();\n"
                + "else { " + frontera + " }\n");
            return;
        case 22:    // == : identidad pura de JS
            src.push("s" + (D - 2) + " = s" + (D - 2) + " === s" + (D - 1) + " ? vm.trueObj : vm.falseObj;\n");
            return;
        case 23:    // class
            src.push("x = s" + (D - 1) + ";\n"
                + "s" + (D - 1) + " = typeof x === 'number' ? vm.specialObjects[" + Squeak.splOb_ClassInteger + "] : x.sqClass;\n");
            return;
        default:
            src.push(frontera + "\n");
    }
}

function nombrederaro(s) { return s.replace(/[^A-Za-z0-9_]/g, "_"); }
function nombredirecto(vm, method) {
    // barato: sin allMethodsDo; el nombre es cosmético (perfiles)
    var sel = method._directoNombre;
    return "D_" + (sel ? nombrederaro(sel) : "m" + (method.hash & 0xFFFF));
}

// ---------------------------------------------------------------------------
// RT expuesto + integración
// ---------------------------------------------------------------------------
var RT = { mat: mat, VACIO: VACIO };

return {
    DEOPT: DEOPT,
    RT: RT,
    hook: hook,
    pase1: pase1,
    compilar: compilar,
    // instalar el estado en un vm recién creado
    config: function(o) { if (o.umbral !== undefined) UMBRAL = o.umbral; if (o.filtro !== undefined) FILTRO = o.filtro; if (o.traza !== undefined) TRAZA = o.traza; if (o.motivos !== undefined) MOTIVOS = o.motivos; },
    preparar: function(vm) {
        vm.deoptInner = null;
        vm.deoptOuter = null;
        vm.deoptPendiente = null;
        vm.deoptIniciador = null;
        vm.nDeoptEventosDirecto = 0;
        vm.nDeoptFramesDirecto = 0;
        vm.nDirectoCompilados = 0;
        vm.nDirectoRechazados = 0;
        vm.nDirectoVetados = 0;
        vm.nDirectoErroresCodegen = 0;
        vm.directoEncadenar = false;   // etapa 1b: llamadas directo→directo
        vm.directoDebug = false;
        vm.directo = Squeak.Directo;   // enciende el hook en executeNewMethod
    },
};

})() });
