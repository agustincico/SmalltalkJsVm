# Diseño B — Codegen de forma directa con RECONSTRUCCIÓN ESTRUCTURADA COMPLETA (if/else + while/for de JS)

## 0. Dato nuevo medido en esta sesión (la base empírica del diseño)

Escribí el corazón de este codegen (decoder Sista propio + profundidades por worklist + parser estructural recursivo, match-only sin emisión) y lo corrí sobre TODOS los métodos elegibles de las dos imágenes reales [comprobado-corriendo]:

- **Cuis 7.8: 13.442/13.442 métodos elegibles (criterio R2 del censo estático) reconstruyen estructura completa = 100,00%**. Subset con loops: 682/682.
- **Pharo AppRun: 88.607/88.607 = 100,00%**. Subset con loops: 1.674/1.674.
- Inventario: Cuis 855 loops / 3.389 diamantes if-else / 5.957 ifs planos / 848 breaks condicionales; Pharo 2.075 / 8.313 / 15.819 / 2.071.
- **Profundidad de pila en el header de CADA loop: 0 en el 97% (829/855 Cuis, 2.070/2.075 Pharo) y 1 en el resto. Máximo absoluto: 1.** (loops en posición de expresión, p.ej. AbstractVectorCanvas>>multiLineTo:points:).
- Anidamiento máximo de loops: 3. Breaks incondicionales: 0. Breaks a loop EXTERNO (labeled break): 0 en 144k métodos. Multi-latch (dos back-jumps al mismo header, emitibles como `continue`): 4 métodos en Cuis, 10 en Pharo — sin soportarlos el match baja a 99,97%.
- Spot-check de que acepta POR la estructura correcta y no por accidente: benchFib da exactamente {1 diamante, 0 loops}; Integer>>benchmark {3 loops anidados nivel 3}; SequenceableCollection>>do: {1 loop, 1 break condicional, header depth 0} [comprobado-corriendo].

Scripts y datos (reusables como arnés de regresión del codegen): `/private/tmp/claude-501/-Users-agustin-SqueakJS/6765a590-7fe2-4fcb-9c3f-190369322e92/scratchpad/estructura/{estructura-lib.js, censo-estructura.js, spot-check.js, cuis-estructura.json, pharo-estructura.json}`.

Conclusión que cambia el diseño: **el compilador de Smalltalk (Cuis y Pharo) emite SOLO código reducible y perfectamente estructurado**; el fallback patológico existe por disciplina, no por demanda — así que la v1 puede ser `bail → clásico` sin pérdida de cobertura medible, y el tier-2 (dispatch-loop) queda especificado pero no implementado.

## 1. Pipeline del codegen

```
compilarDirecto(method, optClass, optSel):
    if !method.methodSignFlag(): return false            # V3 → clásico (8.206 en Pharo, frías)
    r = escanearMetodo(method)                           # el gate O(bytes) ya validado (censo-lib)
    if motivos(r).length > 0: return false               # prim/closure/remoteTemp/thisContext/newArray/raro
    d = decodificar(method)                              # lista de instrs {pc, next, op, net, target}
    if d.raro: return false
    prof = profundidades(d)                              # worklist; valida joins y saltos a medio de instr
    if !prof.ok: return false                            # (0 casos en 144k métodos, pero defensa)
    arbol = parsear(d, prof.depth)                       # el parser de §4; BAIL → contar motivo y false
    if arbol == BAIL: return false                       # FALLBACK LIMPIO nivel 1 (§8)
    method.directo = emitir(method, arbol, prof.depth)   # §3-§7
    method.directo.numArgs = method.methodNumArgs()
    vm.flushMethodCacheForMethod(method)                 # protocolo de frescura (censo fronteras)
    return true
```

Se invoca desde `compileIfPossible` (vm.interpreter.js:1170), junto al jit clásico; `method.directo` sigue el protocolo de `method.compiled`: `undefined` = nunca visto, `false` = visto y no elegible (o vetado), función = compilado. Los dos sitios que anulan `.compiled` (vm.interpreter.js:263 y 287) anulan también `.directo`.

## 2. Representación

Firma generada (aridad posicional; numArgs≤2 cubre el 92% de los elegibles):
```
function D(vm, rcvr, a0..a{n-1}, prof) → valor | DEOPT
```
- **Pila de operandos = locales de JS indexados por profundidad estática** `s0..s{maxD-1}` (maxD por método; máximo real en la imagen: 14). La profundidad por pc es estática y consistente (verificado por los censos y re-verificado por método en `profundidades()`), así que cada bytecode lee/escribe locales con índice FIJO decidido en compile-time. En los joins de diamantes, ambos brazos asignan el MISMO local s_d: la indexación por profundidad ES la resolución de phi — no hace falta SSA.
- **Temps = locales** `t0..t{numTemps-1}` (t0..t{n-1} inicializados de los argumentos, el resto `vm.nilObj`). El 80% de los elegibles no usa temps extra.
- Literales, selectores, la referencia METODO, el centinela DEOPT y los helpers DX se cierran por closure al construir la función (patrón del jit clásico).
- `prof` = profundidad de la cadena directa, pasada como argumento (cero stores, nada que rebalancear en deopt).

## 3. Fragmentos por familia (el traductor compartido; `d` = profundidad estática ANTES del bytecode)

```
push self            → s{d} = rcvr
push temp i          → s{d} = t{i}
push instVar i       → s{d} = rcvr.pointers[i]
push literal n       → s{d} = LIT[n]                    (cerrado por closure)
push litVar n        → s{d} = ASSOC[n].pointers[1]
push true/false/nil  → s{d} = vm.trueObj / falseObj / nilObj
push int k (0xE8)    → s{d} = k                          (número JS crudo; SmallInt = number)
push char (0xE9)     → s{d} = CHAR_k                     (resuelto en compile-time vía image.getCharacter, cacheado)
dup                  → s{d} = s{d-1}
pop / nop            → (nada; solo mueve d)
popIntoTemp i        → t{i} = s{d-1}
storeTemp i          → t{i} = s{d-1}
popIntoInstVar i     → rcvr.pointers[i] = s{d-1}; rcvr.dirty = true          (dirty OBLIGATORIO)
storeInstVar i       → idem sin pop
pop/storeIntoLitVar  → ASSOC[n].pointers[1] = s{d-1}; ASSOC[n].dirty = true
return self/const    → return rcvr / vm.trueObj / falseObj / nilObj
return top           → return s{d-1}
specialNum + - < > <= >= = ~=  → plantilla inline de 2 niveles (§6.2): fast-path copiado BYTE A BYTE
                       de jit.js:1139-1236 (cotas ±2^30 exactas, signed32BitIntegerFor en overflow,
                       fast-path de identidad no-NaN en = y ~=); TODO fallo → FRONTERA (§6.1)
specialNum * / \\ @ bitShift: // bitAnd: bitOr:  → FRONTERA directa en v1 (los helpers del VM leen
                       la pila del contexto, que en directo no existe; el censo muestra que el
                       inline de + - < = domina el uso real)
specialQuick == / class → inline PURO, jamás send: s{d-2} = (s{d-2}===s{d-1})?trueObj:falseObj;
                       s{d-1} = vm.getClass(s{d-1})    (plantillas del jit clásico, sin nivel de fallo)
specialQuick at: at:put: size / value value: blockCopy:  → FRONTERA siempre en v1
specialQuick next nextPut: atEnd do: new new: x y  → sitio de SEND COMÚN (quickSendOther no los
                       implementa; el selector sale de specialSelectors)
send literal / 0xEA  → sitio de llamada directa con frontera (§6.1)
superSend (0xEB extB<64) → igual, con clase de lookup CONSTANTE (methodClassForSuper().superclass(),
                       resuelta en compile-time); frontera con esSuper=true
directed super (extB>=64) → FRONTERA SIEMPRE en v1 (0 casos en Cuis; en la materialización la clase
                       dirigida está en s{...} y se repone; el epílogo llama sendSuperDirected)
```

## 4. El parser estructural (validado 100% sobre las dos imágenes) y la emisión de control

Loops: header H = destino de back-jump incondicional (los back-jumps son SIEMPRE incondicionales — 0 condicionales hacia atrás en 144k métodos). Latch de cierre = el back-jump MÁS BAJO a H; otros back-jumps al mismo H son `continue`. Región del cuerpo = [H, latch); exit E = pc siguiente al latch.

```
parseSeq(lo, hi, loopsActivos):
  pc = lo
  mientras pc < hi:
    si pc es header de loop no consumido:
        L = max(latches(pc));  si L fuera de [pc,hi) → BAIL latch-fuera-de-region
        emitir "L{pc}: for (;;) {"
        parseSeq(pc, L, loopsActivos + {H:pc, E:despues(L)})
        emitir chequeo de interrupciones del back-edge (§5) ; emitir "}"
        pc = despues(L)
    si no, segun instr i:
      jumpIf(T):
        si T == E de un loop activo (el que sea, JS labeled break cubre externos):
            emitir "if (c===falseObj) break L{H}; else if (c!==trueObj) FRONTERA_BOOL" ; pc = next
        si no, si ultima instr antes de T es jump→M con T<M<=hi:   # diamante if/else (join M)
            emitir if/else con ambos brazos parseSeq recursivos + FRONTERA_BOOL; pc = M
        si no (T<=hi):                                             # if plano, cae a T
            emitir "if (c===trueObj) { brazo } else if (c!==falseObj) FRONTERA_BOOL"; pc = T
        si no → BAIL cond-target-fuera-de-region
      jump(T):
        T <= pc y T == H de loop activo mas interno → emitir "continue L{T}" + chequeo back-edge; pc = next
        T == E de loop activo → "break L{H}"; pc = next
        otro → BAIL (latch-suelto / jump-adelante-suelto / continue-a-loop-externo)
      ret: emitir return; pc = next
      otro: emitir fragmento; pc = next
  si pc != hi → BAIL region-desbordada
```
Todo BAIL es conservador: solo se acepta un método si CADA salto fue consumido con su target honrado exactamente y las regiones tejen sin huecos; la verificación global de profundidades es una segunda red. jumpIfTrue es simétrico (brazos invertidos).

## 5. INTERRUPCIONES Y DEOPT DESDE EL MEDIO DE UN LOOP (el punto crítico)

El jit clásico emite el chequeo en cada salto hacia atrás (jit.js:1024-1028, post-decremento, DESPUÉS de `vm.pc = destino`) además del de cada activación (vm.interpreter.js:1168). Sin ese chequeo un loop directo no solo retrasa interrupciones: nunca ve breakOutTick y cuelga el tab. Mi emisión, espejo exacto:

1) **Entrada del método** (espejo de executeNewMethod, misma cadencia post-decremento; es lo que el spike valida con 373 deopts/corrida):
```
if (vm.interruptCheckCounter-- <= 0) return DX.deopt(vm, MET, rcvr, 0, [], [a0..,nil..]);
if (prof > vm.directoProfMax)        return DX.deopt(vm, MET, rcvr, 0, [], [a0..,nil..]);   // tope ~1024
```
2) **Cada back-edge** (el cierre del `for(;;)` Y cada `continue` multi-latch):
```
if (vm.interruptCheckCounter-- <= 0)
    return DX.deopt(vm, MET, rcvr, H, [s0..s{dH-1}], [t0..tN]);   // y si era continue: "continue L{H};"
```
**Con qué pc**: pc = H, el DESTINO del salto — que por ser destino de salto tiene `case` garantizado en el código clásico (needsLabel[destination], jit.js:1032); es la misma elección que hace el clásico (`vm.pc = destino` ANTES de chequear). Jamás el pc del bytecode del salto (75,6% de los pcs de sends no tienen label; caerían en `default: interpretOne(true)` = single-step para siempre + 'break' espurio al host).

**Con qué valores vivos**: TODOS los temps t0..tN (van a los slots tempFrameStart+i del contexto — la variable del to:do: es un temp, queda capturada) y los operandos s0..s{d(H)-1} donde d(H) es la profundidad estática del header — **medida: ≤1 en el 100% de los 2.930 loops de las dos imágenes, 0 en el 97%** — así que la lista es casi siempre vacía y nunca más de un valor. El emisor conoce d(H) en compile-time: la lista se emite literal por sitio.

**Cómo sigue**: DX.deopt materializa ESTE frame (§7) y devuelve el centinela; cada caller directo en la pila de JS lo ve y materializa el suyo en su pc de RETORNO post-send con operandos consumidos (receta del spike); el hook de entrada cuelga el más externo del activeContext real, storeContextRegisters, activeContext = el más interno, fetchContextRegisters, reclaimableContextCount=0, dirty, y RECIÉN AHÍ checkForInterrupts (orden del spike — la versión que lo hacía mal deoptimizó 1.048.730 veces y aun así dio resultado exacto). El clásico reanuda el loop en el case H con los temps y la pila reconstruidos; si el proceso cambia, la cadena es fiel (validado: 67 transferTo bajo estrés, 0 con frames directos vivos).

Los saltos condicionales NO llevan chequeo (0 condicionales hacia atrás en toda la imagen — igual que el clásico).

## 6. Fronteras

### 6.1 Send común (y super)
```
// send #sel k args en pc P, retorno R (= pc post-send, SIEMPRE con label), profundidad antes d:
var e = DX.sonda(vm, vm.getClass(s{d-k-1}), SEL);        // findMethodCacheEntry: SOLO sondea.
if (e !== null && e.method !== null && typeof e.method.directo === "function"
    && e.method.directo.numArgs === k) {
    var r = e.method.directo(vm, s{d-k-1}, s{d-k}, .., s{d-1}, prof + 1);
    if (r === DEOPT) return DX.materializar(vm, MET, rcvr, R, [s0..s{d-k-2}], [t..]);  // frame "en espera": operandos CONSUMIDOS
    s{d-k-1} = r;                                        // el resultado sigue inline, sin trampolín
} else {
    vm.deoptPendiente = {sel: SEL, argc: k, esSuper: false};
    return DX.materializar(vm, MET, rcvr, R, [s0..s{d-1}], [t..]);   // rcvr+args REPUESTOS
}
```
PROHIBIDO findSelectorInClass desde código directo (su miss arma el DNU mutando la pila del VM). La sonda es findMethodCacheEntry: hit=puro; miss=reclama entrada con method=null → frontera, el send clásico hace el lookup real y puebla el cache; a la vuelta el sitio va directo (auto-calentamiento, DNU/cannotInterpret quedan cubiertos por frontera sin código propio). Super: idéntico con la clase constante y esSuper=true. En v2 se funde `directo` en la entrada del methodCache (protocolo de flush del censo de fronteras) y el costo del sitio baja a 1 branch.

### 6.2 specialNum inline con fallo
```
var a = s{d-2}, b = s{d-1};
if (typeof a === "number" && typeof b === "number") {
    var r = a + b;
    s{d-2} = (r >= -1073741824 && r <= 1073741823) ? r : vm.primHandler.signed32BitIntegerFor(r);
} else { vm.deoptPendiente = {sel: SPECIAL[0], argc: 1, esSuper: false};
         return DX.materializar(vm, MET, rcvr, R, [s0..s{d-1}], [t..]); }
```
(signed32BitIntegerFor está en la whitelist verificada de helpers sin GC/contextos.) El epílogo re-emite `vm.send(sel,argc,false)` = byte-idéntico al `vm.pc=R; vm.sendSpecial(...)` del clásico; re-ejecutar el send desde cero es idempotente (verificado en los censos).

### 6.3 Condición no-booleana (mustBeBoolean)
Réplica exacta del clásico (jit.js:1044: `vm.sp++; vm.pc = <post-salto>; vm.send(specialObjects[25],0,false)`, y needsLabel[post-salto] garantizado en jit.js:1045):
```
FRONTERA_BOOL: vm.deoptPendiente = {mustBeBoolean: true};
return DX.materializar(vm, MET, rcvr, R_postSalto, [s0..s{d-2}, c], [t..]);  // condición REPUESTA (+1, anomalía bug-compatible)
```

## 7. Materialización y epílogo (extensión mínima del spike, ya validado con 375 deopts/4.361 frames exactos)

```
DX.materializar(vm, method, rcvr, pcReanudar, pila, temps):
    ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame())   // no dispara GC (verificado)
    p = ctx.pointers
    p[Context_method]=method; p[BlockContext_initialIP]=vm.nilObj; p[Context_sender]=vm.nilObj
    p[Context_receiver]=rcvr
    para i<numTemps: p[TFS+i] = temps[i]              // ÚNICO delta vs spike: temps REALES, no nil
    base = TFS + numTemps
    para j<pila.length: p[base+j] = pila[j]
    p[Context_instructionPointer] = vm.encodeSqueakPC(pcReanudar, method)
    p[Context_stackPointer]       = vm.encodeSqueakSP(base + pila.length - 1)
    ctx.dirty = true
    encadenar de adentro hacia afuera (deoptInner/deoptOuter, como el spike)
    return DEOPT

// Hook en executeNewMethod, tras el bloque tryPrimitive (línea 1129-1131) y antes del decode de header:
var f = newMethod.directo;
if (typeof f === "function" && vm.directoOk && f.numArgs === argumentCount) {
    var rcvr = this.stack[this.sp - argumentCount]; var args = ...;
    this.popN(argumentCount + 1);                     // como executeNewMethod:1149; el estado queda "send en curso"
    var r; try { r = f(this, rcvr, ...args, 1); } catch (ex) { red RangeError último recurso }
    if (r !== DEOPT) { this.push(r); return; }        // el caller clásico sigue INLINE (activationCheck no dispara)
    this.deoptOuter.pointers[Context_sender] = this.activeContext;
    this.storeContextRegisters();
    this.activeContext = this.deoptInner; this.fetchContextRegisters(this.deoptInner);
    this.deoptInner = this.deoptOuter = null; this.reclaimableContextCount = 0; this.activeContext.dirty = true;
    var pend = this.deoptPendiente;
    if (pend) { this.deoptPendiente = null;
        if (pend.mustBeBoolean) this.send(this.specialObjects[25], 0, false);
        else this.send(pend.sel, pend.argc, pend.esSuper); }      // el send de frontera corre UNA vez, clásico
    else if (this.interruptCheckCounter <= 0) this.checkForInterrupts();
    return;
}
```

## 8. Caso patológico: fallback en cascada (limpio y medido)

1. **No-Sista (V3) / sin bytes** → gate → clásico. 2. **Bytecode descalificador** (prim, FA/F9, FB-FD, E7, 0x52, traps, blockReturn) → gate → clásico. 3. **Profundidad inconsistente / salto a medio de instrucción** → clásico (0 casos reales; sin profundidad estática no hay locales fijos, no se intenta nada). 4. **Patrón de saltos no estructurado** (multi-latch ya NO — se emite `continue`; quedan: continue-a-loop-externo, join fuera de región, latch cruzado/irreducible, jump-adelante-suelto) → `method.directo = false` → clásico, con contador por motivo como telemetría. **Medido: 0 de 102.049 elegibles en Cuis+Pharo caen acá.** Correcto siempre, nunca peor que hoy.

Tier-2 documentado (implementar SOLO si la telemetría muestra bails reales, p.ej. un compilador viejo/no estándar): forma directa con dispatch-loop — `var bb=0; ciclo: for(;;) switch(bb) { case pc: ...fragmentos idénticos...; bb=T; continue ciclo; }` — mismos locales por profundidad (solo requiere profundidad estática, no estructura), mismos puntos de deopt, chequeo de interrupciones antes de cada `bb=H` con H<pc. Costo estimado: 2-3 días sobre el traductor de fragmentos ya hecho. La estructura del tier-1 sigue siendo la apuesta de perf: V8 optimiza loops/ifs reales mejor que un switch-dispatch.

## 9. Integración (adopta el diseño del censo de fronteras)

- **Gate de debugging**: `vm.directoOk` (declarado en initVMState por forma estable) = false si logSends/breakOnMethod/breakOnContextChanged/breakOnMessageNotUnderstood/single-step; recalculado al inicio de cada slice de interpret().
- **Invalidación**: `.directo=false` junto a los dos `compiled=null`; flushMethodCacheForMethod al instalar; tapar también el agujero de objectAt:put: sobre métodos para `.directo`.
- **Tope de profundidad**: `prof > vm.directoProfMax (1024)` → deopt-por-profundidad en la entrada (materializa en pc=0, nada ejecutado, idempotente); try/catch de RangeError en el hook solo como red (comprobado que el proceso sobrevive).
- **Política de veto** (regla 4 del README): contadores por método {fronteras, bool, profundidad} incrementados por el frame INICIADOR en DX.materializar; si fronteras/activaciones supera umbral tras N activaciones → `.directo=false` + flush. En Morphic con la regla estricta las cadenas duran ~2 sends: el veto vuelve eso inocuo.
- **v1.1 — stubs quick-prim** (la palanca barata medida: continuación de cadena de Morphic 48%→66%): para métodos con prim 256-519 instalar `method.directo` sintético (`return rcvr` / constante / `rcvr.pointers[i]`), sin chequeo de interrupciones (paridad: el clásico tampoco lo hace en quick prims). El sitio de llamada no cambia: la uniformidad `entry.method.directo` los cubre gratis.

## 10. Ejemplo emitido completo (benchFib; el emisor reproduce EXACTAMENTE los pcs y pilas que el spike eligió a mano: espera en 12 con [] y en 17 con [r1])

```
function (vm, rcvr, prof) {
  if (vm.interruptCheckCounter-- <= 0) return DX.deopt(vm, MET, rcvr, 0, [], []);
  if (prof > vm.directoProfMax)        return DX.deopt(vm, MET, rcvr, 0, [], []);
  var s0, s1, c, r;
  s0 = rcvr; s1 = 2;                                          // pc 0,1
  if (typeof s0==="number" && typeof s1==="number") c = s0 < s1 ? vm.trueObj : vm.falseObj;
  else { vm.deoptPendiente={sel:SP_LT,argc:1}; return DX.materializar(vm,MET,rcvr,4,[s0,s1],[]); }
  if (c === vm.trueObj) {                                     // diamante pc4→(join 20)
      s0 = 1;                                                 // pc 5
  } else if (c === vm.falseObj) {
      s0 = rcvr; s1 = 1;                                      // pc 8,9
      if (typeof s0==="number"&&typeof s1==="number") { r=s0-s1; s0=(r>=-1073741824&&r<=1073741823)?r:vm.primHandler.signed32BitIntegerFor(r); }
      else { vm.deoptPendiente={sel:SP_MINUS,argc:1}; return DX.materializar(vm,MET,rcvr,11,[s0,s1],[]); }
      var e = DX.sonda(vm, vm.getClass(s0), SEL_benchFib);    // pc 11
      if (e && e.method && typeof e.method.directo==="function" && e.method.directo.numArgs===0) {
          var r1 = e.method.directo(vm, s0, prof+1);
          if (r1 === DEOPT) return DX.materializar(vm, MET, rcvr, 12, [], []);
          s0 = r1;
      } else { vm.deoptPendiente={sel:SEL_benchFib,argc:0}; return DX.materializar(vm,MET,rcvr,12,[s0],[]); }
      s1 = rcvr; var s2 = 2;                                  // pc 12,13; send - pc15 (plantilla, frontera R=16)
      ... idem resta → s1 ...
      var e2 = DX.sonda(vm, vm.getClass(s1), SEL_benchFib);   // pc 16
      if (e2 && ...) { var r2 = e2.method.directo(vm, s1, prof+1);
          if (r2 === DEOPT) return DX.materializar(vm, MET, rcvr, 17, [s0], []);   // == spike línea 40
          s1 = r2;
      } else { vm.deoptPendiente={sel:SEL_benchFib,argc:0}; return DX.materializar(vm,MET,rcvr,17,[s0,s1],[]); }
      ... + inline (pc17, R=18) → s0 ... ; s1 = 1; ... + inline (pc19, R=20) → s0 ...
  } else { vm.deoptPendiente={mustBeBoolean:true}; return DX.materializar(vm,MET,rcvr,5,[c],[]); }
  return s0;                                                  // pc 20
}
```
Y un loop (to:do: inlineado, `| s | s:=0. 1 to: n do: [:i| s:=s+i]. ^s`, temps t0=n,t1=s,t2=i):
```
  t1 = 0; t2 = 1;
  L6: for (;;) {
      s0 = t2; s1 = t0;
      if (typeof s0==="number"&&typeof s1==="number") c = s0<=s1 ? vm.trueObj : vm.falseObj;
      else { vm.deoptPendiente={sel:SP_LEQ,argc:1}; return DX.materializar(vm,MET,rcvr,R1,[s0,s1],[t0,t1,t2]); }
      if (c === vm.falseObj) break L6;
      else if (c !== vm.trueObj) { vm.deoptPendiente={mustBeBoolean:true}; return DX.materializar(vm,MET,rcvr,R2,[c],[t0,t1,t2]); }
      s0 = t1; s1 = t2; ...+ inline...; t1 = s0;
      s0 = t2; s1 = 1;  ...+ inline...; t2 = s0;
      if (vm.interruptCheckCounter-- <= 0) return DX.deopt(vm, MET, rcvr, 6, [], [t0, t1, t2]);  // BACK-EDGE: pc=H=6 (label garantizado), pila vacía (d(H)=0), temps vivos
  }
  return t1;
```

## 11. Plan y verificación (regla 5 del proyecto)

PR0: infra flag-off (DEOPT/DX/materializar/hook/deoptPendiente/directoOk, campos en initVMState). PR1: fragmentos + parser + emisor R0 (sin loops) con sonda global; arnés = fcheck.st/estres.st del spike + invariante de resultados exactos + el censo estructural como regresión del decoder. PR2: loops (R1) + multi-latch + tests dirigidos a los 26+5 loops con d(H)=1 y a los 4+10 multi-latch (lista nominal en los json). PR3: super (R2) + stubs quick-prim. PR4: fusión en methodCache + política de veto + A/B intercalado pareado antes de encender default. Asserts de desarrollo permanentes: patch de transferTo y de fullGC/partialGC que fallan si hay frames directos en new Error().stack (ya probados: 0 violaciones).

## Metadatos
- manejaLoops: True
- cobertura: Estática [comprobado-corriendo]: el 100,00% de los métodos elegibles R2 reconstruye estructura completa — Cuis 13.442/13.442 (70,1% de la imagen; 66,6% sin super), Pharo 88.607/88.607 (71,0% de lo escaneado); 0 bails en 102.049 métodos con multi-latch→continue. Dinámica (censo dinámico previo): ~99,3% de las activaciones en tinyBenchmarks; ~54% en Morphic con R2, ~68% sumando los stubs quick-prim de v1.1; la continuación de cadena en Morphic sube de 48% a 66% con esos stubs (a ~95% recién con intrínsecos v2, fuera de este diseño).
- riesgo: medio
- perf: En workloads sends-dominados con cadenas largas (tinyBenchmarks/benchFib): reproducir el ~15,7x del spike (~115M sends/s) es esperable porque el emisor genera esencialmente el mismo código que el spike a mano (mismos pcs de espera, mismas plantillas inline) [el spike es comprobado; la generalización es inferida]. En loops elegibles, los bytecodes pasan de stack-ops del jit clásico (2,1x actual) a locales de JS con control de flujo real — mejora esperable pero NO medida (no se corrieron benchmarks por regla de máquina compartida). En Morphic: neutro en v1 estricta (cadenas ~2 sends, el veto por método evita pagar deopts sin beneficio); modesto positivo con stubs quick-prim (v1.1). Todo A/B pareado antes de cualquier default.
- esfuerzo: semanas
- debilidades:
  - El parser está validado match-only sobre 102.049 métodos reales (100% match, 0 bails), pero la EMISIÓN nunca corrió: la equivalencia parse→código emitido se apoya en que benchFib reproduce los pcs/pilas del spike a mano y en el arnés A/B con invariantes exactos — un bug de plantilla en un caso raro (diamante con valor dentro de la condición de un loop, multi-exit) solo lo atrapan los invariantes en corrida, no el censo.
  - Perf de loops directos vs el jit clásico con sp-en-local: NO medida (regla de no-benchmarks en máquina compartida); en métodos loop-dominados sin sends el clásico ya es bueno y el directo podría no ganar — el A/B pareado de PR2 decide, no este diseño.
  - En Morphic la regla estricta de frontera da cadenas de ~2 sends: sin stubs quick-prim (v1.1) e intrínsecos de primitivas (v2, fuera de alcance) la ganancia allí es ~nula; el veto por método lo vuelve inocuo pero no positivo.
  - La sonda global findMethodCacheEntry por sitio de send puede ser el costo dominante del send directo (inferido en el censo de fronteras); la fusión en cache entry es v2 y el IC monomórfico v3, ambos requieren A/B propio.
  - Los casos raros medidos existen pero están poco ejercitados dinámicamente: 26+5 loops con profundidad 1 en el header y 4+10 métodos multi-latch — tests dirigidos nominales obligatorios (lista en los json del censo estructural).
  - El tope de profundidad (prof>1024 → deopt en entrada) replica la mecánica del spike pero nunca se ejercitó con temps y pila vivos en cadenas profundas con loops en el medio.
  - Dos reproducciones bug-compatibles deliberadas (anomalía +1 de mustBeBoolean, stubs quick-prim sin guard de tipo como tryPrimitive): correctas hoy, frágiles si upstream cambia esos caminos.
  - El censo dinámico que dimensiona Morphic/frontera es solo de Cuis; en Pharo la elegibilidad estática es casi idéntica pero el perfil dinámico de frontera (F9 full closures dominantes) no está censado.
  - El fallback tier-2 (dispatch-loop) está diseñado pero no implementado: si apareciera un compilador que emite código no estructurado, la v1 lo manda al clásico sin ganancia (correcto, nunca peor).