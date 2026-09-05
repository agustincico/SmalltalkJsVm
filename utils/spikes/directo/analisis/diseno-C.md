DISEÑO C — "SWITCH LOCAL, EVALUADO HONESTAMENTE: BLOQUES ETIQUETADOS COMO EMISIÓN DEFAULT, EL SWITCH COMO FALLBACK UNIVERSAL"

========================================================================
0. VEREDICTO DE LA HIPÓTESIS (medido, no argumentado)
========================================================================
La pregunta del panel era: ¿un `for(;;) switch(bc)` con bc LOCAL y cases estáticos es
suficientemente barato en V8 como para no reconstruir estructura? Lo medí en Node 20.9
(V8 11.3) con un benchFib y un loop transcriptos bytecode-a-bytecode, guards IDÉNTICOS
en todas las variantes (typeof, cotas ±2^30, centinela de deopt, contador de
interrupciones), A/B intercalado con rotación de orden, 11 rondas, solo cocientes
(máquina compartida). Ambas formas verificadas TurboFan-optimizadas vía
--allow-natives-syntax (status 0b1010001 las dos) — el costo NO es tiering:

  - switch denso (cases = índices de bloque 0,1,2):        x1.33-1.66 en fib, x1.32-1.40 en loop puro
  - switch ralo (cases = pcs squeak 0,8,20):               x1.42-1.52
  - switch con un case POR BYTECODE (estilo single-step):  x2.1-2.4
  - bloques/loops ETIQUETADOS (break bT / continue LD):    x0.95-1.08 = indistinguible de nativo

(scripts: scratchpad/switch/micro-fib.js, micro-loop.js, micro-blk.js, estado-opt.js)

Conclusión comprobada-corriendo: V8 NO threadea `bc=K; continue` (el bc del header es un
phi de constantes, el dispatch por tabla queda, y TODAS las locales vivas se vuelven phis
del loop header), así que el switch-loop paga ~35-50% sobre control de flujo nativo, y
degrada más con más cases. PERO la hipótesis de fondo del enfoque C sobrevive: lo lento
del jit actual NO es su switch, es el estado en memoria (vm.pc/vm.sp/vm.stack — el commit
92c308f sp-en-local = 2.1x lo prueba), el trampolín por send y el contexto por activación
(el spike 97f15a0 = 15.7x lo prueba). Y hay una emisión que conserva TODO lo que hacía
atractivo al switch — transcripción 1:1 salto-por-salto, CERO reconstrucción de
estructura (nada de recuperar if/else ni relooper), loops gratis, mapa de deopt =
identidad de pcs — y cuesta lo mismo que nativo: bloques y loops etiquetados de JS.
`break bT` para todo salto hacia adelante, `continue LD` para todo back-jump.

El requisito estructural de esa emisión lo CENSÉ sobre las imágenes reales
(scratchpad/switch/censo-blk.js, reusa censo-lib del censo estático): sobre los
elegibles R1, (a) 0 saltos condicionales hacia atrás, (b) 0 pares de loops parcialmente
solapados, (c) 0 saltos que aterricen adentro de un loop desde afuera:
  Cuis 7.8:  12.768/12.768 BLK-ok (100.00%), 664 con loops
  Pharo:     83.956/83.956 BLK-ok (100.00%), 1.641 con loops
O sea: la forma etiquetada cubre el 100% de lo elegible en los dos dialectos, y el
for(;;) switch(bc) queda como FALLBACK universal siempre-correcto (bytecode raro, futuro
Sista optimizador, métodos parchados a mano) que hoy no usa ningún método. Un solo
emisor, dos impresiones de los saltos.

========================================================================
1. FORMA EMITIDA
========================================================================
Firma por método (aridades posicionales; numArgs<=2 cubre 91.8% de los elegibles):

  method.directo = function Cls_sel(vm, rcvr, t0..t{numArgs-1}, d) -> valor | DEOPT

- temps no-argumento: `var tK = NIL;` (locales de JS). Pila de operandos: locales
  s0..s{maxDepth-1} con slot fijo por profundidad estática (verificado imagen entera:
  0 inconsistencias, max 14). El código directo NO toca vm.stack/vm.sp/vm.pc salvo
  en deopt; solo vm.interruptCheckCounter y vm.sendCount (invariante A/B).
- constantes ligadas por closure al compilar (via formals de new Function): MET (el
  CompiledMethod), LITS, DEOPT, NIL/TRUE/FALSE, CLSI (clase SmallInteger), SELk y PENDk
  ({sel,argc,sup} congelado) por sitio de send. Cero unpacking por llamada.
- d = profundidad de frames directos; tope vm.dirTope (~1500; medido RangeError entre
  2.755 y 11.022 frames según gordura — margen 2x incluso para frames gordos; sondeable
  al boot por host). El RangeError NO materializa: el tope es obligatorio; try/catch en
  el hook queda como red de último recurso para no matar la imagen (comprobado que
  sobrevive), nunca como mecanismo.

EJEMPLO COMPLETO — Integer>>benchFib emitido en modo BLK (esto es lo que imprime el
codegen, no un esquema):

  'use strict';
  return function Integer_benchFib(vm, rcvr, d) {
    var s0, s1, s2, r, e;
    if (--vm.interruptCheckCounter <= 0 || d > vm.dirTope)
      return vm.matDirecto(MET, rcvr, [], 0, [], vm.interruptCheckCounter <= 0 ? 1 : 2);
    b20: { b8: {
      // pc 0-3: push self; pushConst 2; send <
      s0 = rcvr; s1 = 2;
      if (typeof s0 === "number" && typeof s1 === "number") s0 = s0 < s1 ? TRUE : FALSE;
      else { vm.dirPend = PEND_LT; return vm.matDirecto(MET, rcvr, [], 4, [s0, s1], 0); }
      // pc 4: jumpIfFalse 8
      if (s0 === FALSE) break b8;
      else if (s0 !== TRUE) { vm.dirPend = PEND_MBB; return vm.matDirecto(MET, rcvr, [], 5, [s0], 0); }
      // pc 5-6: pushConst 1; jumpTo 20
      s0 = 1; break b20;
    } // pc 8
      s0 = rcvr; s1 = 1;
      if (typeof s0 === "number") { r = s0 - s1; if (r < -1073741824 || r > 1073741823) r = vm.primHandler.signed32BitIntegerFor(r); s0 = r; }
      else { vm.dirPend = PEND_MINUS; return vm.matDirecto(MET, rcvr, [], 11, [s0, s1], 0); }
      // pc 11: send benchFib (0 args) — ver plantilla de send en §3
      e = vm.findMethodCacheEntry(SEL_FIB, typeof s0 === "number" ? CLSI : s0.sqClass);
      if (e.method !== null && e.primIndex === 0 && typeof e.method.directo === "function") {
        vm.sendCount++;
        r = e.method.directo(vm, s0, d + 1);
        if (r === DEOPT) return vm.matDirecto(MET, rcvr, [], 12, [], 3);   // frame EN ESPERA
        s0 = r;
      } else { vm.dirPend = PEND_FIB; return vm.matDirecto(MET, rcvr, [], 12, [s0], 0); } // FRONTERA
      s1 = rcvr; s2 = 2;
      if (typeof s1 === "number") { r = s1 - s2; ...idem resta...; s1 = r; }
      else { ...frontera pc 16 con [s0, s1, s2]... }
      e = vm.findMethodCacheEntry(SEL_FIB, typeof s1 === "number" ? CLSI : s1.sqClass);
      if (...) { vm.sendCount++; r = e.method.directo(vm, s1, d + 1);
        if (r === DEOPT) return vm.matDirecto(MET, rcvr, [], 17, [s0], 3);
        s1 = r;
      } else { vm.dirPend = PEND_FIB; return vm.matDirecto(MET, rcvr, [], 17, [s0, s1], 0); }
      if (typeof s0 === "number" && typeof s1 === "number") { r = s0 + s1; if (r < -1073741824 || r > 1073741823) r = vm.primHandler.signed32BitIntegerFor(r); s0 = r; }
      else { vm.dirPend = PEND_PLUS; return vm.matDirecto(MET, rcvr, [], 18, [s0, s1], 0); }
      s1 = 1;
      if (typeof s0 === "number") { r = s0 + 1; ...cotas...; s0 = r; }
      else { ...frontera pc 20 con [s0, s1]... }
    } // pc 20
    return s0;
  }

En modo SW (fallback) el MISMO contenido se imprime con `var bc = 0; loop: for (;;)
switch (bc) { case 0: ... case 1: ... case 2: return s0; }` — cases DENSOS por índice de
bloque (no por pc squeak: medido, la densidad importa y garantiza jump table en
TurboFan), saltos = `bc = K; continue loop;`, orden por pc para que el flujo secuencial
sea fallthrough. Solo los destinos de salto abren case (el case-por-bytecode medido x2.2
queda prohibido salvo en un futuro modo single-step).

========================================================================
2. ARQUITECTURA DEL CODEGEN (pseudocódigo completo)
========================================================================
GATE (idéntico al censo validado censo-lib.escanearMetodo, que ya corre O(bytes)):
  elegible(m):
    m.methodSignFlag() &&                    // solo Sista v1
    prim == 0 &&                             // sin primitiva (cubre ensure:/on:do:)
    sin 0xF9/0xFA/0xFB-FD/0x5D/0x5E &&       // closures / remote temps / blockReturn
    sin 0xE7 &&                              // newArray (v1.1: admitir la variante pop)
    sin 0x52 (extB 0 y 1) &&                 // thisContext / thisProcess
    sin raros (0x54-57, D9, DA-DF, E6, EC, F6-F7, FE-FF, callPrim en medio) &&
    sin 0xEB en v1                           // super (v1.1: ver §3)
  // fin de método: regla del jit — return con pc > endPC (endPC = destino más lejano);
  // NUNCA escanear hasta bytes.length (trailer del source pointer).

PASADA 1 — decode y modelo estático (una sola pasada lineal + worklist chica):
  instrs[] = { pc0 (arranque incl. prefijos E0/E1), pcFin, op, args, salto?{dest, cond} }
  depth[pc] por interpretación abstracta (worklist; ya verificado imagen entera:
    consistente, sin saltos al medio, max 14) -> slot fijo s{k}
  targets = set de destinos; backLoops = { D -> E } con E = pcFin del ÚLTIMO back-jump a D
  chequeos BLK (los del censo, 100% ok en Cuis y Pharo):
    (a) ningún salto condicional con dist <= 0
    (b) loops anidados o disjuntos: para D1<D2: E2<=E1 o D2>=E1
    (c) ningún forward con dest estrictamente adentro de un loop cuyo rango no
        contiene al src
  si falla algo -> modo = SW; si no -> modo = BLK

PASADA 2 — numeración y esqueleto:
  BLK: en cada posición pc emitir, en orden: cierres de bloques con T==pc (quedan
    anidados solos: se abren todos al inicio de su nivel con T mayor más afuera),
    cierres de loops con E==pc, apertura de loop `L{D}: for (;;) {` con D==pc,
    aperturas de bloques adosados a ese nivel (los bT cuyo loop-envolvente-mínimo es
    éste; a nivel función, tras el prólogo). Salto forward = `break b{T};`
    back-jump = chequeo de interrupciones + `continue L{D};`
  SW: bloques = targets ∪ {0} ordenados; blockIndex denso; `case K:` por bloque,
    fallthrough entre bloques contiguos; salto = `bc = K; continue loop;`

  prólogo común:
    "var s0..s{maxDepth-1}, r, e;" + "var t{numArgs}..t{numTemps-1} = NIL;"
    chequeo de entrada (interrupciones + profundidad) -> matDirecto(pc 0, pila [],
    motivo 1|2)   // materializa ESTA activación en pc 0: tiene rcvr+args, temps nil;
                  // el clásico reanuda desde pc 0 sin re-ejecutar nada (0 corrió)

TABLA DE EMISIÓN por familia (mismos emisores en ambos modos; k = depth[pc] antes):
  push self            s{k} = rcvr;
  push temp n          s{k} = t{n};
  push instVar i       s{k} = rcvr.pointers[i];
  push literal n       s{k} = LITS[1+n];
  push litVar n        s{k} = LITS[1+n].pointers[1];
  push true/false/nil/0/1/int/char   s{k} = TRUE|FALSE|NIL|const|CHR_x (char ligado al
                       compilar via image.getCharacter — cacheado, sin GC)
  dup                  s{k} = s{k-1};      pop: nada (baja k estático);   nop: nada
  store/popInto temp   t{n} = s{k-1};
  store/popInto inst   rcvr.pointers[i] = s{k-1}; rcvr.dirty = true;      // dirty SIEMPRE
  store/popInto litVar e = LITS[1+n]; e.pointers[1] = s{k-1}; e.dirty = true;
  return self/const/top   return rcvr | TRUE | FALSE | NIL | s{k-1};
  jump forward         break b{T};                    | bc = K; continue loop;
  back-jump            if (--vm.interruptCheckCounter <= 0)
                         return vm.matDirecto(MET, rcvr, [t...], D, [s0..s{depth[D]-1}], 1);
                       continue L{D};                 | bc = K(D); continue loop;
  jumpIfFalse T        if (s{k-1} === FALSE) break b{T};
                       else if (s{k-1} !== TRUE) { vm.dirPend = PEND_MBB;   // specialObjects[25], 0 args
                         return vm.matDirecto(MET, rcvr, [t...], pcFall, [pila..., s{k-1}], 0); }
                       // pila +1 (condición repuesta) = anomalía heredada del clásico, byte-idéntico
  specialNum + -       inline typeof-number con cotas EXACTAS ±2^30 y overflow via
                       vm.primHandler.signed32BitIntegerFor (whitelist: aloca sin GC);
                       no-number -> FRONTERA especial (pc post, operandos repuestos,
                       PEND = {specialSelectors[2i], specialSelectors[2i+1], false})
  specialNum < > <= >= = ~=   inline a TRUE/FALSE con los guards exactos del jit (incl.
                       fast identidad no-NaN de = ~=); no-number -> FRONTERA especial.
                       PEEPHOLE v1.1: cmp inmediatamente seguido de jumpIf en el mismo
                       bloque -> branch nativo sin materializar el booleano
  specialNum * / \\ @ bitShift // bitAnd bitOr    FRONTERA directa (el jit clásico
                       tampoco los inlinea; fidelidad bit a bit)
  == / class           inline puro: s = (a===b)?TRUE:FALSE (mismo criterio exacto del
                       jit para floats boxeados) / s = vm.getClass(s). Jamás send.
  at:/at:put:/size/next/nextPut:/atEnd/value*/do:/new*/x/y   v1: send común por el
                       selector especial (plantilla §3). v1.1: fast-paths de at:/size
                       copiados del jit con atCache SOLO-LECTURA, fallo -> frontera
  send literal/EA      plantilla §3
  super 0xEB           v1: frontera. v1.1: MISMA plantilla §3 pero cls = SUPERCLS
                       (constante ligada: methodClassForSuper().superclass() es estático
                       por método) — R2 casi gratis, invalidación cubierta por el flush
                       del methodCache. Directed super: frontera (reponer también la
                       clase dirigida)

========================================================================
3. SENDS, FRONTERA Y DEOPT
========================================================================
PLANTILLA DE SEND (selector SELx, m args; rcvr en s{k}, args s{k+1}..s{k+m}):
  e = vm.findMethodCacheEntry(SELx, typeof s{k} === "number" ? CLSI : s{k}.sqClass);
  // findMethodCacheEntry SOLO sondea (verificado); PROHIBIDO findSelectorInClass desde
  // código directo (su miss muta la pila para DNU/cannotInterpret)
  if (e.method !== null && e.primIndex === 0) {
    f = e.method.directo;
    if (f === undefined) f = vm.dirCompilar(e.method);  // compilar-al-primer-contacto:
        // solo genera JS (GC de V8, jamás del Squeak-GC) => seguro desde código directo;
        // evita tormentas de deopt de warmup en cadenas calientes
    if (f !== false) {
      vm.sendCount++;                                    // invariante A/B del proyecto
      r = f(vm, s{k}, ...args, d + 1);
      if (r === DEOPT)                                   // frame EN ESPERA: pc de RETORNO
        return vm.matDirecto(MET, rcvr, [t...], pcPost, [s0..s{k-1}], 3);
      s{k} = r;  -> sigue inline
    } else FRONTERA
  } else if (e.method !== null && e.primIndex >= 256 && e.primIndex <= 519) {
    // QUICK PRIM INLINE (v1: sube la continuación de cadena de Morphic 48%->66%):
    vm.sendCount++;
    s{k} = e.primIndex === 256 ? s{k}
         : e.primIndex < 264  ? QCONST[e.primIndex - 257]         // TRUE FALSE NIL -1 0 1 2
         : (typeof s{k} !== "number" ? s{k}.pointers[e.primIndex - 264] : FRONTERA);
    // no falla, no aloca, sin contexto — mismo efecto que tryPrimitive; y NO decrementa
    // el contador de interrupciones, igual que una primitiva exitosa clásica
  } else FRONTERA
  FRONTERA (miss de cache / primitiva real / no elegible / no-number en quick):
    vm.dirPend = PENDx;                                  // {sel: SELx, argc: m, sup: false}
    return vm.matDirecto(MET, rcvr, [t...], pcPost, [s0..s{k+m}], 0);  // operandos REPUESTOS

REGLA DE PC (la trampa censada): NUNCA materializar en el pc del bytecode del send (solo
24.4% tiene case en el clásico; el resto cae en default -> interpretOne(true) =
single-step para siempre + 'break' espurio al host). TODO frame se materializa en un pc
de RETORNO post-send / destino de salto / pc 0 — etiquetados por construcción en el jit
clásico — y el send de frontera lo re-emite el epílogo con vm.send(), que es idempotente
(methodCache = memoización pura; el DNU/cannotInterpret corre recién en el camino
clásico, donde la pila del contexto es real).

vm.matDirecto(method, rcvr, temps, pcSqueak, pila, motivo) — receta del spike, textual:
  ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame());
  method/closure=nil/sender=nil/receiver; temps a partir de tempFrameStart (args
  incluidos), resto nil; pila encima; encodeSqueakPC/encodeSqueakSP; ctx.dirty = true;
  encadenado de adentro hacia afuera via vm.deoptInner/deoptOuter (el primero es el más
  interno; cada nuevo completa el sender del anterior);
  contadores: si !vm.deoptInner y motivo==0 -> method.dirFront++ (para el veto);
  return DEOPT;
  // allocateOrRecycleContext NO dispara el GC propio (verificado): materializar durante
  // el desenrollado es seguro a cualquier profundidad

========================================================================
4. GANCHO DE ENTRADA Y EPÍLOGO (vm.interpreter.js, executeNewMethod)
========================================================================
Ubicación: DESPUÉS del bloque tryPrimitive (los sends con primitiva exitosa no pagan
nada; los quick los corta tryPrimitive antes de llegar) y ANTES del decode de header.
Es el embudo de TODOS los caminos (send, super, perform:, executeMethodArgsArray, DNU).

  if (this.dirOk) {
    var f = newMethod.directo;
    if (f === undefined) f = this.dirCompilar(newMethod);      // instala función o false
    if (f !== false && argumentCount === f.numArgs) {
      var b = this.sp - argumentCount, st = this.stack;
      var rc = st[b], a0 = st[b+1], ...;
      this.popN(argumentCount + 1);                            // como el spike: pop ANTES
      var r = (despacho por aridad 0..4; >4 no se compila en v1);  // f(this, rc, ..., 1)
      if (r !== this.__DEOPT) { this.push(r); return; }        // como primitiva exitosa:
          // el caller clásico jiteado sigue INLINE (su check context!==activeContext no
          // dispara) — un send a directo no viaja al trampolín
      // deopt: instalar la cadena (receta del spike, validada con 375 eventos exactos)
      this.deoptOuter.pointers[Squeak.Context_sender] = this.activeContext;
      this.storeContextRegisters();
      this.activeContext = this.deoptInner;
      this.fetchContextRegisters(this.deoptInner);
      this.deoptInner = this.deoptOuter = null;
      this.reclaimableContextCount = 0;
      this.activeContext.dirty = true;
      var pend = this.dirPend; this.dirPend = null;
      if (pend) this.send(pend.sel, pend.argc, pend.sup);      // re-emite el send frontera
      else if (this.interruptCheckCounter <= 0) this.checkForInterrupts();  // YA, con
          // estado consistente (la lección del bug de 1M deopts del spike)
      return;
    }
  }

vm.dirOk (booleano único, forma estable declarada en initVMState junto a deoptInner/
deoptOuter/dirPend/dirTope): false si logSends || logProcess || breakOn* || single-step.
Recalculado donde se setean esos flags (solo cambian entre slices, single-thread).

========================================================================
5. POLÍTICA, INVALIDACIÓN, VERIFICACIÓN
========================================================================
- Compilación: por el hook a la 2ª activación (protocolo undefined->false->función,
  idéntico a method.compiled, seteando ambos en la misma transición de hidden class);
  ADEMÁS compilar-al-primer-contacto desde un callsite directo (§3) para que las cadenas
  calientes no deoptimicen por callees fríos.
- Veto por método: matDirecto cuenta method.dirFront (solo motivo frontera/mustBeBoolean;
  interrupciones y profundidad no son culpa del método); el hook cuenta entradas. Si
  dirFront > 256 y supera a las entradas -> method.directo = false definitivo. Primera
  heurística: ajustar con A/B (Morphic va a vetar mucho y ESO ES CORRECTO: nunca peor).
- Invalidación: method.directo = null en los DOS sitios que anulan method.compiled
  (vm.interpreter.js:263 y 287); v1 no cachea .directo en las entradas del methodCache
  (se lee via e.method cada vez) así que become/flushes no necesitan nada nuevo; tapar
  el agujero preexistente de objectAtPut sobre CompiledMethod (anular .compiled y
  .directo) — dos líneas en vm.primitives.js.
- Profundidad: d por argumento (cero stores; nada que rebalancear en deopt), tope
  vm.dirTope=1500 default, sondeable por host al boot; try/catch de RangeError en el
  hook SOLO como red de último recurso (aborta limpio, no reanuda).
- Verificación (método del proyecto, no negociable): (1) invariantes semánticos ##CHK en
  cada corrida A/B DIRECTO=0/1; (2) fuzz de materialización: correr la suite con
  dirTope=4 y con interruptCheckCounter forzado bajo — deopt constante en TODOS los
  sitios de todos los métodos, los resultados deben ser exactos (así se cazó el bug de
  cadencia del spike); (3) los asserts ya probados del censo de deopt: patch de
  transferTo y de fullGC/partialGC que fallan si ven frames directos en new Error().stack;
  (4) compilador en modo censo: emitir los 12.768 elegibles de Cuis y verificar
  new Function() sin excepción + contadores de forma (bloques, sends, sitios de deopt).

========================================================================
6. POR QUÉ ESTA VARIANTE DEL ENFOQUE C Y NO OTRA
========================================================================
- vs switch puro: x1.35-1.5 medido de regalo en TODO método (y x2+ si crecen los cases);
  con 0/96.724 métodos necesitándolo, pagarlo siempre es indefendible. El switch queda
  exactamente donde es insustituible: fallback de cualquier CFG y base de un eventual
  single-step directo.
- vs reconstrucción estructurada (diseñador A): mismo output de perf (blk == nativo,
  medido), pero SIN recuperar ifs/whiles: los saltos del bytecode se imprimen 1:1
  (un branch condicional = `if (cond) break bT;`), el orden textual es el orden de pcs,
  el mapa pc->sitio de deopt es la identidad, y la generalidad no depende de que el
  pattern-matching cubra todos los casos — depende de 3 invariantes censados al 100% con
  fallback mecánico si algún día se rompen. Es el codegen con MENOS análisis posible por
  encima del decode que el jit ya hace.
- Plan de PRs: PR0 infra flag-off (hook, DEOPT, matDirecto, dirOk, contadores; ~2-3
  días). PR1 emisor R0 en ambos modos + verificación (1 semana). PR2 loops (back-edge +
  interrupciones), quick prims inline, veto, dirTope (1 semana). PR3 medición A/B seria
  y luego super estático / peephole cmp+jump / fusión entry.directo en methodCache / IC
  por sitio, cada uno con su A/B. Encendido default solo tras auditoría adversarial.


## Metadatos
- manejaLoops: True
- cobertura: v1 (R0+R1, sin super): 66,6% de los métodos de Cuis (12.768/19.162) y 67,3% de Pharo — y la emisión rápida (labeled blocks) cubre el 100,00% de esos elegibles en ambas imágenes (censado en esta sesión: 0 violaciones del invariante estructural en 96.724 métodos). Dinámico: tinyBenchmarks 99,3% de las activaciones; Morphic 52,3% de activaciones R1, 67,8% contando las quick prims inlineadas en el sitio de llamada (continuación de cadena 48%→66% con quick; ~95% recién con intrínsecos v2). v1.1 (+super estático +newArray-pop) suma ~3-4 puntos estáticos.
- riesgo: medio
- perf: Techo conocido: spike a mano 15,7x en benchFib (~115M sends/s). La emisión BLK reproduce esa forma (medido: x0,95-1,08 vs nativo), pero v1 agrega por send la sonda global del methodCache + getClass + carga de .directo (~10-20 ops sobre una activación de ~30-60): estimo retener 6-10x en workloads de sends (tiny), acercándose a 12-15x recién con IC por sitio (v3, a medir con A/B). Loops elegibles: locales de JS puras vs vm.stack — mejora adicional sobre la línea sp-en-local, magnitud no medida. Morphic: neutro a levemente positivo en v1 (cadenas de ~3 sends con quick inline; el veto por método garantiza nunca-peor); la ganancia real ahí depende de los intrínsecos v2. Si el panel exigiera switch puro como única emisión: descontar x1,33-1,66 medido en métodos tipo fib y x1,32-1,40 en loops.
- esfuerzo: semanas
- debilidades:
  - La hipotesis nominal del enfoque quedo REFUTADA por mi propio micro: el for(;;)switch(bc) local paga x1,33-1,66 (fib) / x1,32-1,40 (loop) vs control de flujo nativo con TurboFan confirmado en ambas formas, y x2,1-2,4 con un case por bytecode — la propuesta migra el default a labeled blocks y deja el switch de fallback; si se exige switch puro, ese costo es real y permanente
  - Los micros son 2-4 funciones sinteticas en Node 20.9 con guards monomorficos: no corri un metodo GENERADO dentro del VM real (el end-to-end sigue siendo el benchFib a mano del spike); el cociente puede moverse con ICs polimorficos reales, en browsers (JSC/SpiderMonkey sin medir) y con Maglev default en Nodes nuevos
  - El costo de la sonda global de findMethodCacheEntry por send directo es el dominante estimado y NO esta medido: sin IC por sitio la ganancia de sends puede quedar bastante abajo del 15,7x del spike (mi 6-10x es estimacion, no medicion)
  - Tier frio: Ignition compila switch como cadena de comparaciones y las funciones directas frias corren lentas hasta Maglev/TurboFan (leido-de-V8, no medido); ademas el costo en memoria/compile-time de V8 de miles de funciones generadas extra no esta dimensionado
  - En Morphic la continuacion de cadena es 48-66% aun con quick prims: v1 sera neutro alli y el veto por metodo va a apagar el modo directo en gran parte de la UI — la ganancia de Morphic depende del diseno v2 de intrinsecos de primitivas-que-no-fallan, que exige un camino de fallo por primitiva todavia no disenado en detalle
  - La mayor superficie de bugs nueva son los mapas de materializacion por sitio (pc de retorno + pila estatica + anomalia +1 de mustBeBoolean): el fuzz con dirTope=4 y el A/B con invariantes son obligatorios, no opcionales
  - El invariante BLK (sin saltos hacia adentro de loops) esta censado al 100% en Cuis y Pharo de HOY, pero es una propiedad del compilador Smalltalk, no del set de bytecodes: bytecode futuro u optimizado podria requerir el fallback SW y su x1,4
  - Politica de veto e invalidacion con heuristicas sin datos (umbral 256, ratio, backoff): requieren calibracion A/B; y el agujero preexistente de objectAtPut sobre CompiledMethod hay que taparlo en el repo para .directo
  - Fuera de v1: full closures de Pharo (0xF9), set V3 (imagenes viejas y el boilerplate de traits de Pharo), aridades >4, y los 8.206 metodos no-sista de Pharo