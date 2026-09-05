# CODEGEN DIRECTO V1 — SIN LOOPS (Diseñador A)

Especificación implementable. Convención de honestidad: [S] = verificado por el spike corriendo; [C] = censo del panel comprobado-corriendo; [L] = leído en código en esta sesión (cito líneas); [R] = razonamiento mío, verificado en papel — lo cubre el verificador y la batería A/B, no es opcional.

## 0. Alcance

Compila a forma directa los métodos Sista SIN saltos hacia atrás. Los saltos adelante (ifTrue:/ifFalse:/and:/or:) se convierten en control de flujo JS real mediante **bloques etiquetados con break** (equivalente estructurado del if/else; ver §5 por qué es la construcción correcta y no la reconstrucción de if/else anidados, que no siempre existe). Incluye además **hojas quick-prim** (primitivas 256-519: return self/const/instVar) como callees directos — son los accessors, 1.507 métodos de Cuis [C], 3 plantillas triviales, y suben la continuación de cadena de Morphic de 48% a 66% [C].

Archivos nuevos: `vm.directo.js` (gate + generador + runtime RT + instalación del hook). Cambios al repo: 2 líneas de invalidación (vm.interpreter.js:263 y 287: agregar `.directo = false` junto a `.compiled = null` [L]) + declaración de campos nuevos en initVMState (patrón vm.interpreter.js:94-99 [L]) + el hook en executeNewMethod. Activación por flag (env DIRECTO en el arnés; default OFF hasta pasar la batería del §12).

## 1. Elegibilidad (gate, pase 0)

Escaneo lineal O(bytes) por método, es `escanearMetodo` de censo-lib.js del censo estático (ya validado 19.162/19.162 contra decoder independiente [C]) con una regla extra (backjump). Regla de fin de método NO negociable: cortar en un return con pc > endPC (endPC = destino de salto más lejano), como jit.js:1002 [C]; jamás escanear hasta bytes.length (trailer del source pointer).

ELEGIBLE si TODO esto:
- `method.methodSignFlag()` true (solo Sista; V3 rechazado — los 8.206 métodos de traits de Pharo caen acá [C]).
- `!vm.useStackZone` (la forma directa V1 solo convive con modo contexts) [L jit.js:203-208].
- primitiveIndex === 0, **o** primitiveIndex en 256..519 (hoja quick, §9; sin escaneo de cuerpo — no tiene).
- El cuerpo NO contiene: 0xF8 callPrimitive (defensivo), 0xFA closureCopy, 0xF9 pushFullClosure, 0x5D/0x5E blockReturn, 0xFB/0xFC/0xFD temps remotos, 0xE7 (AMBAS variantes: vector de indireccion Y brace-array — conservador, ver debilidad 7), 0x52 (thisContext y thisProcess), 0xD9/0xEC/unused.
- NINGÚN salto con destino <= pc de inicio de la instrucción del salto (sin loops). Los condicionales nunca son hacia atrás en toda la imagen [C], pero el gate lo chequea igual — la propiedad del censo es un dato, no un axioma.
- Decode sin errores, profundidad consistente en cada join (pase 1), ningún salto al medio de una instrucción.
- Tope de tamaño: <= 400 bytes de bytecode (acota costo de codegen; 12.862 de los 13.685 elegibles miden <=60 [C]).

Resultado esperado según censo estático: ~12.100 métodos de Cuis (63%) menos ~370 por E7-pop, más 1.507 hojas quick [C].

## 2. Protocolo de instalación y política

Sobre el CompiledMethod (lazy, mismo patrón que `.compiled` [L]):
- `method.directo`: undefined = nunca visto; false = visto, no compilado (o inelegible, o vetado); function = listo.
- `method.directoN`: contador de activaciones; `method.directoVetado`: true = no reintentar.

En el hook (§8): primera vez `directo=false, directoN=0`; al llegar `directoN >= UMBRAL_CALOR (=8)`, correr gate; si pasa, generar + **verificar (§11)** + instalar; si el gate falla o el verificador falla, `directoVetado=true` (el verificador que falla ADEMÁS loggea — es un bug del generador, nunca del método).

Antes de instalar `.directo`: si `method.compiled` no es función, forzar la compilación clásica (`vm.compiler.compile(method, cls, sel)` — ojo protocolo dos-fases de jit.js:145-178 [L]: si compiled===undefined setearlo llamando una vez, y llamar de nuevo). Garantiza que toda deopt reanude por el switch jiteado con labels, no por interpretOne.

Sobre la FUNCIÓN generada: `f.numArgs` (de methodNumArgs), `f.nLlamadas`, `f.nFronteras`, `f.nProfundidad`, `f.nBool`, `f.nInterrupciones` (contadores de veto y diagnóstico).

VETO: en el epílogo de deopt del hook, atribuir el evento al método iniciador (`vm.deoptMetodoIniciador`, lo setea matSend/mat). Si `f.nFronteras >= 32 && f.nFronteras * 2 > f.nLlamadas` → `method.directo = false; method.directoVetado = true`. (Deopts por interrupción NO cuentan para el veto: son cadencia normal, ~1 por slice [S].)

INVALIDACIÓN: `.directo=false` en vm.interpreter.js:263 y 287 (donde muere `.compiled` [L]). No hay caches derivados en V1 (la sonda lee `entry.method.directo` en el momento del send, y los 4 flushes del methodCache ya corren en frontera [C]) → no hace falta epoch. El agujero heredado de objectAtPut sobre métodos (no invalida .compiled, vm.primitives.js:1312-1350 [C]) se tapa para `.directo` con una línea en el caso de mutación de un CompiledMethod.

GATES DE DEBUGGING: el hook exige `vm.directoOk && !vm.logSends && !vm.breakOnMethod && !vm.breakOnContextChanged && !vm.breakOnContextReturned && !vm.breakOnMessageNotUnderstood` (los mismos loads que executeNewMethod ya hace en 1117-1128 [L] — costo ~0). `vm.directoOk` arranca true (o del flag) y `interpretOne` lo pone en false para siempre (una sesión que single-stepeó no vuelve a modo directo sola). Flags solo cambian entre slices → chequearlos en la entrada alcanza [C].

## 3. Firma y forma de la función generada

```
// factory al compilar (cierra sobre method, DEOPT, RT y los TAGs del método):
f = new Function("METH","RT","DEOPT","TAGS",
      "'use strict';\nreturn function " + nombre + "ᐅ(vm, r" + ", a0..a{n-1}" + ", d) {\n" + cuerpo + "}"
    )(method, RT, RT.DEOPT, tags);
```
- `vm`, receptor `r`, argumentos `a0..` como parámetros de JS, `d` = profundidad de cadena directa (se pasa `d+1` en cada llamada directa; el hook pasa 0). Cero stores para la profundidad, nada que rebalancear en deopt [C-fronteras].
- Sufijo `ᐅ` en el nombre: marcador para las sondas de invariante (Error().stack en transferTo/fullGC, §12).
- Literales SIEMPRE vía `var lit = METH.pointers;` leído por activación — become permuta referencias dentro de pointers [C], hoistear valores al closure sería stale tras un become. Los TAGs de frontera guardan `litIdx`, nunca el objeto selector, por la misma razón.
- Retorno: `return <valor>` (returnTop/self/const). Centinela: `return DEOPT` (objeto único congelado; jamás colisiona con un valor Smalltalk: esos son numbers u objetos Squeak [S]).

PRÓLOGO (en este orden):
```
if (--vm.interruptCheckCounter <= 0 || d > vm.directoTope)
    return RT.mat(vm, METH, r, [a0..], RT.sin, 0, RT.sin, null);
var lit = METH.pointers;            // solo si el cuerpo usa literales (needsVar)
var t{k} = vm.nilObj; ...           // un local por temp NO-argumento (numTemps-numArgs)
var s0, s1, ... s{maxD-1};          // locales de pila de operandos
L{Tn}: { L{Tn-1}: { ... L{T1}: {    // bloques etiquetados, §5
```
- El decremento del contador espejo del de executeNewMethod:1168 [L]; las hojas quick NO lo tienen (clásico tampoco lo decrementa: tryPrimitive retorna antes de 1168 [L]) — una sola bajada por activación con cuerpo, idéntico a hoy.
- `vm.directoTope = 1000` (medido: 2.755-11.022 frames según gordura en Node 20 [C-deopt]; margen 2-5x para browsers). Deopt-por-profundidad materializa en pc 0: nada corrió, re-ejecutar es exacto; una recursión de 100k profundiza en tandas de 1000 con un evento de deopt por tanda (lineal, correcto).
- `RT.sin` = array vacío congelado compartido (los arrays con contenido se alocan SOLO en la rama de deopt — literal de array dentro del `return RT.mat(...)`, nunca en el camino caliente).

## 4. Modelo de pila simbólico (pase 1)

Mapa fijo: el operando a profundidad i vive en el local `s{i}`. Con profundidad estática única por pc (verificado exhaustivamente: 0 inconsistencias en 17.655 métodos, max 14, promedio 2,56 [C]) los nombres cuadran solos en los joins.

```
pase1(method):
  D = 0; depthAt = {}; targets = {}; pendiente = {}   // pendiente[T] = profundidad exigida por saltos a T
  alcanzable = true
  para cada instrucción I en orden de pc (decode con prefijos E0/E1 consumidos; una
      "instrucción" arranca en su primer prefijo — depthAt se indexa por ese pc):
    si pendiente[I.pc] existe:
      si alcanzable y D != pendiente[I.pc] -> RECHAZAR (join inconsistente)
      si !alcanzable: D = pendiente[I.pc]; alcanzable = true
    si !alcanzable -> RECHAZAR (código muerto: conservador, esperado ~0 casos)
    depthAt[I.pc] = D
    efecto neto (tabla del censo [C]): push +1, dup +1, pop/popInto/jumpIf -1,
      store 0, specialNum -1, specialQuick -argc, send/super -argc, directed -(argc+1),
      returns terminales
    si I es jump(T):      targets[T]=1; anotar pendiente[T]=D (chequear consistencia si ya había); alcanzable=false
    si I es jumpIf(T):    D-=1; targets[T]=1; pendiente[T]=D (chequear)
    si I es return:       alcanzable=false
    maxD = max(maxD, D)
  salida: depthAt, targets (con profundidad), maxD, listaDeSitiosDeopt (se llena en pase 2)
```
Un solo pase lineal alcanza PORQUE no hay saltos hacia atrás (toda fuente < destino: al llegar a T ya vimos todos sus saltos). El pase 1 es también la segunda mitad del gate.

## 5. Control de flujo: bloques etiquetados desde arriba

Problema real: el diamante `a ifTrue:[x] ifFalse:[y]` genera rangos de salto que se SOLAPAN sin anidarse (jumpFalse p1→else, jump p2→end con p1<p2<else<end), así que "un bloque por salto" no anida y la reconstrucción if/else anidados no siempre existe sintácticamente. Construcción correcta y trivial [R]:

**Todos los bloques abren al inicio de la función, anidados en orden DECRECIENTE de destino; el bloque del destino T cierra exactamente en la posición T.**

```
L20: { L8: {   codigo[0..8)   }   codigo[8..20)   }   codigo[20..fin)
```
- `jump T`      => `break L{T};`
- `jumpIf T`    => `var c = s{D-1}; if (c === vm.{true|false}Obj) break L{T}; else if (c !== vm.{false|true}Obj) return RT.matSend(..., pcFall, [ops.., c], TAG_bool);` (fall-through sigue)
- Corrección: toda fuente es < destino ⇒ toda fuente está léxicamente dentro del bloque [0..T) ⇒ el break es siempre legal. Dos destinos T1<T2 ⇒ [0..T1) ⊂ [0..T2) ⇒ anidan siempre. Los `var` de JS tienen scope de función ⇒ los s{i} sobreviven los límites de bloque. pc 0 nunca es destino (no hay backjumps).
- Emisión: al llegar al pc T (en orden), cerrar un `}` por cada bloque cuyo destino sea T, antes de emitir la instrucción de T.
- (Opcional, no-V1: peephole que detecta el diamante simple y emite if/else literal — cero diferencia semántica, es cosmético.)

mustBeBoolean espejo exacto del clásico jit.js:1035-1048 [L]: la condición se REPONE en la pila materializada (por eso `[ops.., c]`), pc = pc del fall-through (etiquetado en el clásico por construcción, needsLabel[this.pc] [L]), y el replay del TAG_bool emite `vm.send(vm.specialObjects[25], 0, false)`. La anomalía de pila +1 queda en manos del camino clásico, idéntico a hoy.

## 6. Emisión por bytecode (pase 2)

D = profundidad ANTES de la instrucción (de depthAt). `Q` = pc de la instrucción siguiente (post-instrucción). Plantillas (espejo de jit.js:680-930, 1049-1256 [L]):

MOVIMIENTOS (sin deopt posible):
- 0x00-0F/0xE2 pushInstVar i:   `s{D} = inst[i];` (prólogo `var inst = r.pointers;` si se usa)
- 0x10-1F/0xE3 pushLitVar n:    `s{D} = lit[n].pointers[1];`
- 0x20-3F/0xE4 pushLiteral n:   `s{D} = lit[n];`
- 0x40-4B/0xE5 pushTemp k:      `s{D} = a{k};` si k<numArgs, sino `s{D} = t{k};`
- 0x4C self / 0x4D-4F / 0x50-51 / 0xE8 n / 0xE9 c: `s{D} = r | vm.trueObj | vm.falseObj | vm.nilObj | 0 | 1 | <n> | vm.image.getCharacter(<c>);`
- 0x53 dup: `s{D} = s{D-1};` — 0xD8 pop: nada (solo D--) — 0x5F nop: nada
- 0xC8-CF/0xF0 popIntoInst i / 0xF3 storeInst i: `inst[i] = s{D-1}; r.dirty = true;` (dirty OBLIGATORIO, GC generacional propio [C])
- 0xD0-D7/0xF2 popIntoTemp / 0xF5 storeTemp k: `t{k} = s{D-1};` (o `a{k} =` — args asignables)
- 0xF1 popIntoLitVar / 0xF4 storeLitVar n: `var g_ = lit[n]; g_.pointers[1] = s{D-1}; g_.dirty = true;`

RETORNOS (terminales): 0x58 `return r;` — 0x59/5A/5B `return vm.trueObj|falseObj|nilObj;` — 0x5C `return s{D-1};`

SALTOS 0xB0-B7/0xED, 0xB8-BF/0xEE, 0xC0-C7/0xEF: §5. (0xED con extB negativo no puede aparecer: el gate ya rechazó backjumps.)

SPECIALNUM 0x60-0x67 (+ - < > <= >= = ~=), operandos a=s{D-2}, b=s{D-1}, espejo EXACTO de jit.js:1146-1210 [L]:
```
if (typeof a === 'number' && typeof b === 'number') {
    // +/-: var r_ = a + b; s{D-2} = (r_ >= -1073741824 && r_ <= 1073741823) ? r_ : vm.primHandler.signed32BitIntegerFor(r_);
    // < > <= >= : s{D-2} = a < b ? vm.trueObj : vm.falseObj;
    // = : s{D-2} = a === b ? vm.trueObj : vm.falseObj;   ~= análogo
}
// = y ~= tienen la rama extra de identidad ANTES del else final:
// else if (a === b && a.float === a.float) s{D-2} = vm.trueObj;  (~=: falseObj)
else return RT.matSend(vm, METH, r, ARGS, TEMPS, Q, [s0..s{D-1}], TAG{kind:'num', op});
```
(signed32BitIntegerFor aloca sin GC — whitelist verificada [C-deopt].) El fallo repone TODO (los dos operandos incluidos) y el replay corre la rama else del clásico, byte-idéntica (§8).

SPECIALNUM 0x68-0x6F (* / \\ @ bitShift: // bitAnd: bitOr:): V1 = FRONTERA SIEMPRE (mismo matSend con TAG{kind:'num', op:8..15}); el replay ejecuta la plantilla clásica completa (helper + sendSpecial), así que la semántica es exacta y el veto gobierna los métodos donde estos sitios son calientes. V1.1 especificado aparte: inline entero para * (test |r|<=0xFFFFFFFF de pop2AndPushNumResult:1582 [L] — el producto JS pierde precisión >2^53 pero el test sigue siendo seguro [C]) y para bitAnd:/bitOr: (operandos number ⇒ SmallInt ±2^30 ⇒ & y | exactos).

SPECIALQUICK:
- 0x76 ==: `s{D-2} = s{D-2} === s{D-1} ? vm.trueObj : vm.falseObj;` — 0x77 class: `s{D-1} = typeof s{D-1} === 'number' ? vm.specialObjects[5] : s{D-1}.sqClass;` Inline puros, JAMÁS send, JAMÁS deopt [C] (y por eso son los únicos sitios post-op sin label en el clásico [L jit.js:1099-1106] — el verificador lo explota, §11).
- 0x70 at: (a=s{D-2}, b=s{D-1}): fast path clásico `a.sqClass === vm.specialObjects[7] && a.pointers && typeof b === 'number' && b>0 && b<=a.pointers.length  =>  s{D-2} = a.pointers[b-1];` sino FRONTERA TAG{kind:'at'}. (PROHIBIDO llamar objectAt desde código directo: lee operandos de la pila del VM, que acá no los tiene.)
- 0x71 at:put:: fast path Array análogo con `a.pointers[b-1] = c; a.dirty = true; s{D-3} = c;` sino FRONTERA TAG{kind:'atput'}.
- 0x72 size: Array→pointersSize() / ByteString (specialObjects[6])→bytesSize() inline; sino FRONTERA TAG{kind:'size'}.
- resto (next nextPut: atEnd blockCopy: value value: do: new new: x y): tratar como SEND del selector especial (sonda de cache §7 con selector `vm.specialSelectors[lobits*2]` y argc `vm.specialSelectors[lobits*2+1]` [L vm.interpreter.js:893-897]): si el callee tiene .directo (Point>>x = hoja quick: ¡llamada directa!) se llama; sino FRONTERA TAG{kind:'quick', lobits} cuyo replay imita al clásico: quickSendOther primero, sendSpecial si falla (preserva la activación rápida de bloques para value/value:).

SEND COMÚN 0x80-0xAF/0xEA (selector lit[n], m args) — §7. SUPER 0xEB: V1 = FRONTERA SIEMPRE, TAG{kind:'super', litIdx, argc} (871 casos estáticos, no amerita [C]); directed (extB>=64): TAG{kind:'dirsuper'} — la clase dirigida también se repone (ocupa el tope, sendSuperDirected la popea [L:1032-1042]); 0 casos en Cuis, Pharo sí [C].

## 7. Send directo→directo

En el sitio (rcvr = s{D-m-1}, args = s{D-m}..s{D-1}, post-send pc Q):
```
var rx = s{D-m-1};
var cls = typeof rx === 'number' ? vm.specialObjects[5] : rx.sqClass;
var e = vm.findMethodCacheEntry(lit[n], cls);
var g = e.method !== null && e.method.directo;
if (typeof g === 'function' && g.numArgs === {m}) {
    vm.sendCount++;                                   // espejo de executeNewMethod:1116
    var v = g(vm, rx, s{D-m}, .., s{D-1}, d + 1);
    if (v === DEOPT) return RT.mat(vm, METH, r, ARGS, TEMPS, Q, [s0..s{D-m-2}], null);
    s{D-m-1} = v;                                     // profundidad pasa a D-m
} else {
    return RT.matSend(vm, METH, r, ARGS, TEMPS, Q, [s0..s{D-1}], TAG{kind:'send', litIdx:n, argc:m});
}
```
- PROHIBIDO findSelectorInClass desde código directo: su camino de miss hace popNandPush sobre la pila del VM para DNU/cannotInterpret [L:1063,1091] y acá los operandos no están ahí. `findMethodCacheEntry` sí es tolerable (escribe methodCacheRandomish y en miss recicla una entrada con method=null [C]); con miss ⇒ frontera, y el vm.send del replay llena esa entrada.
- El certificado de seguridad ES la presencia de `.directo`: solo se instala en cuerpos elegibles sin primitiva o en hojas quick — nunca hay que chequear primIndex en el sitio. `g.numArgs === m` cubre aridades raras (objectAsMethod/prim 84 van por frontera).
- Contabilidad exacta de sendCount [R, verificado en papel]: hook-entrada ya contó en 1116; sitio directo cuenta antes de llamar; frontera NO cuenta (el send nunca empezó) y el replay cuenta una vez vía executeNewMethod; deopt por interrupción/profundidad no re-cuenta (la reanudación clásica no re-activa). ⇒ el invariante A/B `sendCount(DIRECTO=0) === sendCount(DIRECTO=1)` debe dar EXACTO y es el chequeo semántico más fino de la batería.

## 8. Deopt: materialización, epílogo, replay

RUNTIME (RT, escrito a mano una vez — generalización directa del spike [S]):
```
RT.mat = function(vm, method, rcvr, args, temps, pc, ops, tag) {
    var ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame());
    var p = ctx.pointers, TFS = Squeak.Context_tempFrameStart;
    p[Squeak.Context_method] = method;
    p[Squeak.BlockContext_initialIP] = vm.nilObj;   // slot 4 == Context_closure [L vm.js]
    p[Squeak.Context_sender] = vm.nilObj;           // lo completa el frame de afuera
    p[Squeak.Context_receiver] = rcvr;
    var nT = method.methodTempCount(), base = TFS + nT;
    for (var i = 0; i < nT; i++) p[TFS+i] = vm.nilObj;          // nil primero
    for (i = 0; i < args.length; i++) p[TFS+i] = args[i];       // después args
    for (i = 0; i < temps.length; i++) p[TFS+args.length+i] = temps[i];  // después temps vivos
    for (i = 0; i < ops.length; i++) p[base+i] = ops[i];
    p[Squeak.Context_instructionPointer] = vm.encodeSqueakPC(pc, method);
    p[Squeak.Context_stackPointer] = vm.encodeSqueakSP(base + ops.length - 1);
    ctx.dirty = true;
    vm.nDeoptFramesDirecto++;
    if (!vm.deoptInner) { vm.deoptInner = ctx; vm.deoptPendiente = tag || null;
        vm.deoptMetodoIniciador = method; vm.nDeoptEventosDirecto++; }
    else vm.deoptOuter.pointers[Squeak.Context_sender] = ctx;
    vm.deoptOuter = ctx;
    return RT.DEOPT;
};
RT.matSend = RT.mat;  // mismo código; el nombre distingue intención en los sitios
```
(El `if (!vm.deoptInner)` identifica al INICIADOR — el desenrollado va de adentro hacia afuera [S] — y solo él deja pendiente e iniciador. allocateOrRecycleContext no dispara GC [C-deopt:1490-1512].)

HOOK en executeNewMethod (vm.interpreter.js:1115), DESPUÉS del bloque tryPrimitive (1129-1131) y ANTES del decode de header (1135) [L] — embudo de send/sendSuperDirected/perform/executeMethodArgsArray/sendAsPrimitiveFailure [C], las primitivas exitosas no pagan nada, y el retorno normal deja al caller clásico seguir INLINE (su activationCheck `context !== vm.activeContext` jit.js:1252 no dispara [L]):
```
var f = newMethod.directo;
if (f !== undefined && this.directoOk && !this.logSends && !this.breakOnMethod
    && !this.breakOnContextChanged && !this.breakOnContextReturned
    && !this.breakOnMessageNotUnderstood) {
    if (typeof f === 'function') {
        if (f.numArgs === argumentCount) {
            f.nLlamadas++;
            var st = this.stack, sp = this.sp;
            this.popN(argumentCount + 1);            // ANTES de llamar: el sp guardado por
            var res;                                 // storeContextRegisters debe ser post-pop
            switch (argumentCount) {                 // spread por aridad, apply para >4
                case 0: res = f(this, st[sp], 0); break;
                case 1: res = f(this, st[sp-1], st[sp], 0); break;
                ...
            }
            if (res !== RT.DEOPT) { this.push(res); return; }
            // ---- epílogo de deopt (orden del spike, NO innovar [S]) ----
            this.deoptOuter.pointers[Squeak.Context_sender] = this.activeContext;
            this.storeContextRegisters();            // pc del caller ya es Q (el send clásico lo seteó)
            this.activeContext = this.deoptInner;
            this.fetchContextRegisters(this.deoptInner);
            this.deoptInner = this.deoptOuter = null;
            this.reclaimableContextCount = 0;
            this.activeContext.dirty = true;
            var tag = this.deoptPendiente; this.deoptPendiente = null;
            var ini = this.deoptMetodoIniciador; this.deoptMetodoIniciador = null;
            if (tag) { ini.directo.nFronteras++; RT.replay(this, tag, ini); vetar-si-corresponde(ini); }
            if (this.interruptCheckCounter <= 0) this.checkForInterrupts();  // YA, con estado
            return;                                  // consistente; si no: deopt-cascada [S: bug 1M]
        }
        // aridad rara: caer al camino clásico (sin tocar nada)
    } else if (f === false && !newMethod.directoVetado && ++newMethod.directoN >= 8) {
        compilarDirectoSiElegible(newMethod, optClass, optSel);   // gate+pases+verificador
    }
} else if (f === undefined) { newMethod.directo = false; newMethod.directoN = 1; }
```

RT.replay(vm, tag, metodoIniciador) — corre con la cadena instalada, vm.pc==Q, operandos repuestos; cada rama es la COPIA de la plantilla clásica del jit [L jit.js:1049-1256], por eso es byte-idéntica:
```
switch (tag.kind) {
  'send':     vm.send(metodoIniciador.pointers[tag.litIdx], tag.argc, false); break;
  'super':    vm.send(metodoIniciador.pointers[tag.litIdx], tag.argc, true); break;
  'dirsuper': vm.sendSuperDirected(metodoIniciador.pointers[tag.litIdx], tag.argc); break;
  'bool':     vm.send(vm.specialObjects[25], 0, false); break;
  'num':      // rama else clásica del op, p.ej. op 0:
              vm.success = true; vm.resultIsFloat = false;
              if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) + vm.stackIntOrFloat(0)))
                  vm.sendSpecial(0);
              // ops 2-7 con pop2AndPushBoolResult; 8 *; 9 / quickDivide; 10 \\ mod;
              // 11 @ primitiveMakePoint(1,true); 12 bitShift safeShift; 13 // div;
              // 14/15 & | — todas idénticas a jit.js:1211-1234
              break;
  'at':       var c = vm.primHandler.objectAt(true,true,false);
              if (vm.primHandler.success) vm.stack[--vm.sp] = c; else vm.sendSpecial(16); break;
  'atput':    var c = vm.stack[vm.sp]; vm.primHandler.objectAtPut(true,true,false);
              if (vm.primHandler.success) vm.stack[vm.sp -= 2] = c; else vm.sendSpecial(17); break;
  'size':     vm.sendSpecial(18); break;   // el fast path ya falló en directo; idéntico al else clásico
  'quick':    var r0 = vm.stackValue(vm.specialSelectors[tag.lobits*2+1]);
              if (!vm.primHandler.quickSendOther(r0, tag.lobits - 16)) vm.sendSpecial(tag.lobits); break;
}
```
(Nota de implementación: los índices exactos lobits/16 del quickSendOther se copian de jit.js:1107-1137 al escribirlo, con test de paridad — no confiar en esta transcripción de memoria.)

MAPEO pc/pila de cada tipo de sitio (la clave anti-trampa del censo: SOLO pcs etiquetados en el clásico [C]):
- Entrada (interrupción/profundidad): pc=0 (case 0 siempre existe [L jit.js:259]), ops=[], args=params, temps=[] (mat nilea).
- Espera-de-resultado (callee directo deoptó): pc=Q (post-send, needsLabel [L:1255]), ops = pila DEBAJO de rcvr+args (consumidos); doReturn pushea el resultado al reanudar [L:1217]. Es exactamente (12,[]) y (17,[r1]) del spike [S].
- Frontera send/quick/num: pc=Q (etiquetado: post-send/post-numericOp/post-quickPrim [L:1144,1255,1060...]), ops = pila CON rcvr+args (+clase dirigida si dirsuper) repuestos, tag con el pendiente.
- mustBeBoolean: pc=fall-through (etiquetado [L:1045]), ops incluye la condición repuesta.

## 9. Hojas quick-prim (V1.b)

Para primitiveIndex P en 256..519 (espejo de tryPrimitive:1252-1270 [L]): numArgs=0 y sin cuerpo. Plantillas:
- 256: `return r;` — 257/258/259: `return vm.trueObj|falseObj|nilObj;` — 260..263: `return P-261;` — >=264: `return r.pointers[P-264];`
Sin chequeo de interrupciones ni contador (clásico tampoco [L]); no pueden deoptar ni fallar [C-dinamico]. Se instalan con el mismo protocolo (§2) sin gate de cuerpo. Efecto medido en censo: continuación de cadena Morphic 48,4%→66,3% [C].

## 10. Ejemplo completo: benchFib generado (derivado a mano con esta spec)

```
function Integer_benchFibᐅ(vm, r, d) {
  if (--vm.interruptCheckCounter <= 0 || d > vm.directoTope)
      return RT.mat(vm, METH, r, RT.sin, RT.sin, 0, RT.sin, null);
  var lit = METH.pointers;
  var s0, s1;
  L20: { L8: {
    s0 = r; s1 = 2;                                     // 0 push self; 1 pushConst 2
    if (typeof s0 === 'number' && typeof s1 === 'number')    // 3 send <
         s0 = s0 < s1 ? vm.trueObj : vm.falseObj;
    else return RT.matSend(vm, METH, r, RT.sin, RT.sin, 4, [s0,s1], TAGS[0]);   // num op 2
    var c = s0;                                          // 4 jumpIfFalse 8
    if (c === vm.falseObj) break L8;
    else if (c !== vm.trueObj) return RT.matSend(vm, METH, r, RT.sin, RT.sin, 5, [c], TAGS[1]);
    s0 = 1; break L20;                                   // 5 pushConst 1; 6 jumpTo 20
  }
    s0 = r; s1 = 1;                                      // 8 push self; 9 pushConst 1
    if (typeof s0 === 'number' && typeof s1 === 'number') {  // 10 send -
        var r_ = s0 - s1;
        s0 = (r_ >= -1073741824 && r_ <= 1073741823) ? r_ : vm.primHandler.signed32BitIntegerFor(r_);
    } else return RT.matSend(vm, METH, r, RT.sin, RT.sin, 11, [s0,s1], TAGS[2]);
    var rx = s0, cls = typeof rx === 'number' ? vm.specialObjects[5] : rx.sqClass;  // 11 send benchFib
    var e = vm.findMethodCacheEntry(lit[1], cls), g = e.method !== null && e.method.directo;
    if (typeof g === 'function' && g.numArgs === 0) {
        vm.sendCount++;
        var v = g(vm, rx, d + 1);
        if (v === DEOPT) return RT.mat(vm, METH, r, RT.sin, RT.sin, 12, RT.sin, null);
        s0 = v;
    } else return RT.matSend(vm, METH, r, RT.sin, RT.sin, 12, [rx], TAGS[3]);
    // 12-16: push self; push 2; send -; send benchFib — igual, con deopt-espera (17, [s0])
    // 17 send +, 18 push 1, 19 send + : plantillas inline de suma
  }
  return s0;                                             // 20 return top
}
```
Los puntos de deopt (0, 12, 17) y sus pilas ([], [], [s0]) coinciden EXACTAMENTE con los del spike validado [S] — es el test de paridad número uno del generador.

## 11. Verificador estructural (obligatorio antes de instalar)

Corre sobre la salida del generador: {srcTexto, sitios:[{pc, nOps, tipo, tag}], targets, depthAt, maxD}.
1. Re-escanear el método con el decoder INDEPENDIENTE (censo-lib) y re-derivar: elegibilidad, postPcs de sends/numeric/quick, fall-throughs de jumpIf, targets con profundidad. Comparar contra lo que usó el generador (dos decoders, cero confianza en uno solo — el patrón que ya cazó el bug de mod/div del disassembler [C]).
2. Por cada sitio de deopt: assert pc ∈ {0} ∪ postPcs ∪ fallthroughs (⇒ etiquetado en el clásico [C: solo 24,4% de los pcs DE send tienen label — jamás materializar ahí]); assert que NO haya sitios post-== ni post-class (no tienen label y no deben existir); assert nOps == profundidad esperada: espera-resultado ⇒ depthAt[Q]-1; frontera ⇒ depthAt del pc del send (todo repuesto); bool ⇒ depthAt[fall]+... la condición repuesta = profundidad pre-pop; entrada ⇒ 0.
3. Frontera: nOps repuestos == resto + argc + 1 (+1 dirsuper); tag.litIdx dentro de rango de literales; tag válido en la tabla de replay.
4. `new Function(...)` compila (sintaxis V8); conteo textual: #labels abiertos == #cerrados, todo `break L` con su label emitido antes.
5. Frame: TFS-1 + methodTempCount + maxD cabe en small(16)/large(56) según methodNeedsLargeFrame (garantía clásica, assert barato; max real de la imagen: 14 [C]).
6. Cualquier assert que falla ⇒ NO instalar, directoVetado=true, log con el src — bug del generador por definición.

Sondas de desarrollo permanentes (ya probadas, 0 violaciones [C-deopt]): patch de transferTo y de fullGC/partialGC que revientan si `new Error().stack` contiene "ᐅ" (frames directos vivos donde no puede haberlos).

## 12. Batería A/B y plan (regla 5 del spike, no negociable)

Invariantes por corrida, DIRECTO=0 vs 1 pareados: resultados exactos de fcheck.st (15/21891/1028457) y estres.st (300 despertares, idénticos [S]); **sendCount exacto** (§7); contadores de deopt >0 (que la maquinaria se ejercite); sondas de stack limpias; tinyBenchmarks completo con verificación; arranque Morphic + PULSO=1 sin divergencias y con el veto observablemente apagando métodos (log).

Orden de implementación (cada PR con la batería):
- PR0 (0,5d): vm.directo.js esqueleto — RT.mat/replay, campos en initVMState, hook flag-off, invalidación (263/287), gates de debugging.
- PR1 (1d): gate + pase 1 + verificador (partes 1-3 y 5), corrido contra los 19.162 métodos de Cuis como censo (debe reproducir los números del panel: es el test del gate).
- PR2 (1,5d): emisor completo + paridad benchFib (el generado debe ser equivalente al §10) + fcheck/estres exactos.
- PR3 (0,5d): hojas quick + veto + contadores.
- PR4 (1d): batería completa, sondas, Morphic, y A/B de perf pareado (recién acá números).
- Buffer (0,5-1d): lo que la batería encuentre.

## Metadatos
- manejaLoops: False
- cobertura: Estática (censo comprobado): ~61-63% de los métodos de Cuis (12.104 R0 menos ~370 con brace-arrays E7 rechazados por conservadurismo) + 1.507 hojas quick-prim (7,9%) como callees directos; en Pharo proporciones casi idénticas (66% R0). Dinámica: tinyBenchmarks ~99,2% de las activaciones (benchFib es el 98,6%); Morphic ~49% elegible con continuación de cadena 48%→66% gracias a las hojas quick — cadenas de ~3 sends, o sea el veto apagará gran parte de Morphic y la ganancia real ahí es ~nula en V1.
- riesgo: medio
- perf: En benchFib/tiny-sends: reproducir el orden del spike (15,7x medido a mano en benchFib; esperable >10x en la línea de sends de tinyBenchmarks, misma forma y mismos inline; la sonda findMethodCacheEntry por send directo puede recortar algo — el spike no la pagaba). Línea de bytecodes de tiny: sin cambio (benchmark usa loops, fuera de V1). Morphic: neutro por diseño (veto + 'nunca peor'; costo de deopt cada ~3 sends si se dejara encendido). NADA de esto está medido con el codegen real: A/B intercalado pareado obligatorio antes de cualquier número, en máquina no compartida.
- esfuerzo: semana
- debilidades:
  - Sin loops: no cubre do:/whileTrue:/Integer>>benchmark ni los métodos R1 (+3-5pp); la línea de bytecodes de tinyBenchmarks no se mueve, solo la de sends.
  - Morphic gana ~nada: con hojas quick la cadena directa dura ~3 sends y el veto apaga casi todo; la palanca real ahí (intrínsecos de primitivas que no fallan, bloques directos) queda explícitamente fuera de V1.
  - Las 8 ops numéricas 0x68-0x6F (* / \\ @ bitShift: // bitAnd: bitOr:) son frontera-siempre: un método caliente con * se veta solo; el rescate V1.1 (inline entero de *, bitAnd:, bitOr:) está especificado pero no incluido.
  - Sonda global findMethodCacheEntry en cada send directo→directo (sin IC por sitio): costo no medido, puede recortar el 15,7x en métodos con muchos sends polimórficos; el IC con epoch es v3 y exige A/B propio.
  - La construcción de bloques etiquetados y la exactitud del invariante de sendCount son razonamiento verificado en papel, no corrido: el verificador estructural y la batería A/B son la red obligatoria, no un extra.
  - El replay byte-idéntico copia a mano ~10 plantillas de jit.js (numeric else-branches, at:/at:put:/size, quickSendOther): riesgo de drift si jit.js cambia; mitigación = tests de paridad por plantilla, pero es acople real.
  - Tope de profundidad 1000 calibrado en Node 20 (medido 2.755-11.022 frames según gordura de frame); browsers y el worker de producción requieren recalibración del número, no del mecanismo.
  - E7-pop (brace arrays {a. b. c}) rechazado por conservadurismo aunque el censo dice que la alocación no dispara el GC propio: pierde ~370 métodos elegibles.
  - Cero soporte de closures (0xFA en Cuis, 0xF9 en Pharo) y de super: son el descalificador dominante (18% de Cuis) y el residuo duro de la frontera (BlockClosure>>value); V1 solo los rechaza limpio.
  - Interacción con jitPeephole/sp-en-local del jit clásico leída como compatible (sync de vm.sp en jit.js:406/417) pero no corrida con DIRECTO encendido; PR0 debe incluir una corrida con ambos flags.