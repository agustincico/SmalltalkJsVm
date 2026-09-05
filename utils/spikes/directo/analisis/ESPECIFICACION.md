VEREDICTO DEL PANEL — CODEGEN DE FORMA DIRECTA

Confianza: este veredicto es síntesis de material ajeno (censos y diseños, con su confianza declarada) más lectura directa de primera mano de `utils/spikes/directo/README.md` y `spike-directo.js` en esta sesión. Todo lo que abajo digo "medido" lo midió otro agente y lo etiqueto como tal. Nota de integridad: los textos de los diseños A y C y el informe del cazador de deopt me llegaron TRUNCADOS (A se corta en el hook §8, B en el ejemplo §10, C en invalidación §5, y el resumen de deopt se corta en "hay dos puntos que el c…"). Juzgué con lo que hay; las dos trampas del cazador que sí llegaron enteras por la lista de TRAMPAS (GC-nilea-más-allá-de-sp y sendCount-es-semántico) están incorporadas a la spec. El tramo perdido del informe de deopt es un riesgo abierto listado al final (R0).

====================================================================
1. EVALUACIÓN DE LOS TRES DISEÑOS
====================================================================

Los tres convergen en el 80% del diseño (locales por profundidad estática, args posicionales, centinela DEOPT, materialización en pc de RETORNO etiquetado, epílogo que re-emite el send, hook post-tryPrimitive, findMethodCacheEntry como única sonda, veto por método). La decisión real es (i) cómo se emite el control de flujo y (ii) qué entra en v1.

DISEÑO A (sin loops, bloques etiquetados):
- Correción: el riesgo más bajo del panel. Sin back-edges no hay deopt en medio de loop, y su construcción de bloques ("todos abren al inicio, anidados por destino decreciente, cierran en T") es trivialmente correcta dado 0 back-jumps [C: comprobado en imagen entera]. Único diseño con verificador post-generación como gate de instalación (§11, truncado pero la intención es correcta) y con la regla become-safe de literales (lit = METH.pointers por activación, litIdx en TAGs — respaldada por el censo de bytecodes).
- Cobertura dinámica: suficiente para reproducir la victoria del spike (tiny R0=99,22%) y única propuesta v1 con hojas quick-prim como callees directos — la palanca medida de 48%→66% de continuación de cadena en Morphic. Pero sin loops, `SequenceableCollection>>do:`/`scanFor:`/`from:to:put:` (el corazón del residuo elegible de Morphic, +3,4pt) quedan clásicos Y ROMPEN CADENA como callers.
- Camino incremental: A NO es subconjunto de B (B reconstruye if/else; A emite bloques etiquetados — emisiones distintas). A SÍ es subconjunto estricto del modo BLK de C (C-BLK menos loops = A). Esto decide la síntesis.

DISEÑO B (reconstrucción estructurada completa):
- Su aporte empírico es valiosísimo y sobrevive al diseño: match estructural 100,00% en Cuis Y Pharo [medido], profundidad de pila en header de loop ≤1 (0 en el 97%) [medido], multi-latch = 4+10 métodos resolubles con `continue`, back-jumps siempre incondicionales, y la receta de deopt de back-edge en pc=H (destino, siempre etiquetado) con temps VIVOS.
- Pero su pieza central — el parser estructural recursivo con regiones, diamantes y BAILs — es la superficie de corrección más grande del panel, y la medición de C le quita la razón de ser: bloques/loops etiquetados rinden x0,95-1,08 vs nativo [medido por C en Node 20 con TurboFan verificado], así que reconstruir if/else no compra performance medible y sí compra un parser que hay que verificar. El tier-2 switch de B queda igualmente muerto por la medición de C (x1,33-2,4).
- En la síntesis, el parser de B es código que se tira. Sus datos y su receta de loops, no.

DISEÑO C (switch evaluado honestamente → bloques etiquetados + switch fallback):
- El aporte decisivo del panel: MIDIÓ su propia hipótesis y la refutó (V8 no threadea el dispatch; switch paga 35-50%+ y degrada con más cases; bloques/loops etiquetados ≈ nativo). Y censó el requisito estructural de la emisión etiquetada: 100,00% BLK-ok sobre los elegibles R1 de las DOS imágenes (0 condicionales hacia atrás, 0 loops parcialmente solapados, 0 saltos que entren a un loop desde afuera) [comprobado-corriendo].
- Su emisión es transcripción 1:1 salto-por-salto sin reconstrucción: `break bT` forward, `L{H}: for(;;)` + `continue L{H}` backward. Menos transformación que B = menos riesgo, misma perf.
- Debilidades que corrijo en la spec: liga literales/selectores/chars por closure al compilar (stale tras become — el censo de bytecodes manda leer METH.pointers por activación); compilar-al-primer-contacto desde código directo es innecesario en v1 (el warmup ocurre solo vía las deopts de frontera → hook → contador); el switch fallback universal no lo necesita NINGÚN método real de ninguna de las dos imágenes [medido] — implementarlo en v1 es superficie de bugs sin cobertura; su inline de quick prims EN el call site es más rápido pero menos uniforme que las hojas .directo de A (queda para etapa 4).

GANADOR: SÍNTESIS C-BLK + A + datos de B.
Emisión de C en modo BLK (bloques y loops etiquetados, 1:1, sin parser estructural y SIN implementar el modo SW — todo lo no-BLK cae a clásico, que hoy es el 0,00% de los elegibles). Etapas, gates, política, verificador y régimen de seguridad de A. Loops según la receta y los datos de B (deopt en pc=H con temps vivos y ops ≤1). Hojas quick-prim de A en v1; palancas de C (super estático, inline de quick en call site, peephole cmp+jump) en etapa 4.

Adjudicaciones de conflictos fácticos:
1. 0xE7 brace-array (censos se contradicen): RECHAZA en v1. Ambas opciones son seguras, pero 0,13% dinámico no paga ni una línea de riesgo. Documentado como decisión, revisable.
2. Literales/selectores: por activación/litIdx (A), nunca por closure (C). Chars: `vm.image.getCharacter(c)` en runtime, como el clásico.
3. Replay de frontera de special-sends: NO `vm.send(specialSelectors[2i],...)` (B/C) sino `vm.sendSpecial(idx)` — es lo que emite el jit clásico y preserva quickSendOther para value/value:/at:. A lo tenía bien.
4. Pre vs post-decremento del interruptCheckCounter (A/C usan `--x <= 0`, B usa `x-- <= 0`): copiar EXACTAMENTE el operador de executeNewMethod:1168 al implementar (verificarlo contra el archivo, no contra los diseños). El spike validó pre-decremento; la diferencia es 1 activación de sesgo, pero el A/B de conteo de deopts agradece el espejo exacto.
5. Warmup: umbral en el hook (A, UMBRAL=8), sin compilar-al-contacto (C) en v1 — las deopts de frontera ya calientan el contador del callee vía el hook, es auto-limitante y el veto (≥32) acota el costo.

====================================================================
2. ESPECIFICACIÓN FINAL
====================================================================

2.1 ELEGIBILIDAD (gate, O(bytes), = censo-lib validado 19.162/19.162 + reglas extra)

Precondiciones del método:
- methodSignFlag() === true (solo Sista; V3 → clásico).
- !vm.useStackZone.
- primitiveIndex === 0, O primitiveIndex ∈ [256..519] (hoja quick, sin cuerpo, §2.5).
- tamaño ≤ 400 bytes de bytecode.
- numArgs ≤ 4 en v1 (despacho por aridad en el hook; cubre >97% [C]).

Bytecodes PERMITIDOS en el cuerpo:
0x00-0x4F (pushInstVar/pushLitVar/pushLiteral/pushTemp/self/true/false/nil), 0x50-0x51 (0,1), 0x53 dup, 0x58-0x5C returns, 0x5F nop, 0x60-0x7F special sends (todos, con plantillas §2.3), 0x80-0xAF sends, 0xB0-0xC7 saltos cortos, 0xC8-0xD7 popInto cortos, 0xD8 pop, 0xE0/0xE1 prefijos, 0xE2-0xE5 pushes extendidos, 0xE8 pushInt, 0xE9 pushChar, 0xEA send ext, 0xEB super NORMAL (extB<64: el sitio es frontera en etapas 1-3, llamada directa estática en etapa 4) y DIRECTED (extB≥64: frontera siempre), 0xED/0xEE/0xEF saltos largos, 0xF0-0xF5 stores.

Bytecodes que DESCALIFICAN el método (→ clásico):
0x52 (thisContext Y thisProcess), 0x54-0x57, 0x5D/0x5E blockReturn, 0xD9, 0xDA-0xDF, 0xE6, 0xE7 (AMBAS variantes), 0xEC, 0xF6/0xF7, 0xF8 en el cuerpo, 0xF9, 0xFA, 0xFB-0xFD, 0xFE/0xFF.

Reglas estructurales (pase 1, POR MÉTODO, también en Pharo — el modelo de profundidades NO está verificado exhaustivamente ahí):
- Fin de método: return con pc > endPC (endPC = destino de salto más lejano). JAMÁS escanear hasta bytes.length (trailer).
- Decode limpio; profundidad única y consistente en cada pc (worklist); ningún salto al medio de instrucción; profundidad nunca negativa.
- Capacidad de frame: TFS + numTemps + maxD ≤ 22 (small) / 62 (large) según methodNeedsLargeFrame(); si no alcanza → rechazar (red que el clásico no tiene; los arrays JS crecen en silencio).
- ETAPA 1: ningún salto con destino ≤ pc del salto (sin loops).
- ETAPA 2 (loops): back-jumps solo incondicionales; condiciones BLK del censo de C: (a) 0 condicionales hacia atrás, (b) loops anidados o disjuntos (para D1<D2: E2≤E1 o D2≥E1), (c) ningún forward desde afuera de un loop aterrizando adentro. Multi-latch → `continue` (permitido). Cualquier violación → clásico (medido: 0 métodos en 144k).

2.2 FORMA EMITIDA Y MODELO DE PILA

```
method.directo = function Cls_sel(vm, r, a0..a{n-1}, d) -> valor | DEOPT
```
- Pila de operandos = locales s0..s{maxD-1}, slot fijo por profundidad estática del pc (los joins asignan el mismo local: no hay phis que resolver). maxD real ≤ 14 [C].
- Temps no-argumento = locales t{numArgs}..t{numTemps-1}, init vm.nilObj. Args asignables (storeTemp sobre arg → a{k}=).
- d = profundidad de cadena directa, pasada como argumento (+1 por llamada directa; el hook pasa 1). Tope vm.directoTope = 1000 (medido RangeError 2.755-11.022 en Node; margen para browsers; sondeable al boot en etapa 5). try/catch de RangeError en el hook SOLO como red de último recurso, jamás como mecanismo.
- Cerrado por closure: METH (el CompiledMethod), RT, DEOPT, TAGs (que llevan litIdx/specialIdx/argc, NUNCA objetos selector). Literales SIEMPRE `var lit = METH.pointers;` leído por activación; inst vars `var inst = r.pointers;` (emitir solo si se usan). El código directo NO toca vm.pc/vm.sp/vm.stack; solo vm.interruptCheckCounter y vm.sendCount.
- Centinela: objeto único congelado; retornos: `return <valor JS o objeto Squeak>`.

PRÓLOGO (orden exacto):
```
if (<decremento espejo de executeNewMethod:1168> || d > vm.directoTope)
    return RT.mat(vm, METH, r, [a0..], RT.SIN, 0, RT.SIN, null);   // pc=0, nada corrió
var lit = METH.pointers;  var inst = r.pointers;    // solo si se usan
var t{k} = vm.nilObj; ...  var s0..s{maxD-1}, x, e;
<aperturas de bloques etiquetados del nivel función, §2.4>
```
Nota: las hojas quick-prim NO llevan chequeo de interrupciones (paridad con tryPrimitive). Los arrays de la deopt se alocan SOLO en la rama de deopt (literal inline en el return); RT.SIN = array vacío congelado.

2.3 EMISIÓN POR BYTECODE (D = profundidad antes; Q = pc post-instrucción)

Movimientos (sin deopt): como A §6 textual — pushes a s{D}; dup `s{D}=s{D-1}`; pop/nop nada; stores con DIRTY OBLIGATORIO (`inst[i]=v; r.dirty=true` / `g=lit[n]; g.pointers[1]=v; g.dirty=true`); returns terminales `return r|trueObj|falseObj|nilObj|s{D-1}`.

specialNum 0x60-0x67 (+ - < > <= >= = ~=): espejo BYTE A BYTE de jit.js:1139-1236 — typeof number ambos; +/- con cotas del RESULTADO -1073741824..1073741823 (asimétricas) y overflow vía vm.primHandler.signed32BitIntegerFor (whitelist: no GCea); comparaciones a trueObj/falseObj; = y ~= CON el fast-path de identidad no-NaN del jit (divergencia con interpretOne documentada: se copia AL JIT). Todo fallo → FRONTERA (deopt D4).

specialNum 0x68-0x6F (* / \\ @ bitShift: // bitAnd: bitOr:): FRONTERA SIEMPRE en v1 (los helpers leen vm.stack, usan vm.success global y devuelven el centinela in-band NonSmallInt=-0x50000000: PROHIBIDO llamarlos desde código directo). Etapa 4: inline de * (cota |r|≤0xFFFFFFFF de pop2AndPushNumResult) y bitAnd:/bitOr:.

specialQuick: == y class inline PUROS (=== / typeof→specialObjects[5]/.sqClass), jamás send ni deopt. at:/at:put:/size: v1 FRONTERA SIEMPRE (etapa 4: fast-path Array/ByteString del jit con atCache solo-lectura). blockCopy:/value/value: FRONTERA SIEMPRE. next/nextPut:/atEnd/do:/new/new:/x/y: sitio de SEND COMÚN con selector specialSelectors[2i] — pero su frontera materializa con pend {specialIdx} para que el replay sea vm.sendSpecial (preserva quickSendOther).

Sends 0x80-0xAF/0xEA: §2.5. Super 0xEB: frontera con pend {litIdx, argc, super:true} (directed: la clase dirigida es un valor más de la pila estática — la regla de ops-repuestos la cubre sola; pend {dirsuper}).

Saltos: §2.4. jumpIf no-booleano → deopt D6 (mustBeBoolean).

2.4 CONTROL DE FLUJO (emisión BLK de C, 1:1)

- Forward jump T → `break b{T}`. Bloques etiquetados abiertos al inicio de su región envolvente mínima (función o cuerpo de loop), anidados por destino DECRECIENTE (T mayor más afuera), cerrados exactamente en pc T. Correcto porque toda fuente < destino y dos destinos anidan siempre; la condición (c) del gate garantiza que ningún bloque cruza un límite de loop. Los `var` tienen scope de función: los s{i} sobreviven los límites.
- Loop con header H (etapa 2) → `L{H}: for(;;){ ... }`; back-jump de cierre = último latch; otros latches → `continue L{H}`; salto al exit E → `break L{H}`.
- Back-edge (cierre Y cada continue): chequeo de interrupciones ANTES del salto → deopt D2.
- jumpIfFalse T: `x=s{D-1}; if (x===vm.falseObj) break b{T}; else if (x!==vm.trueObj) <deopt D6>;` (jumpIfTrue simétrico). Fall-through sigue.

2.5 SENDS Y LLAMADA DIRECTA→DIRECTA

Sitio (rcvr=s{D-m-1}, args s{D-m}..s{D-1}, retorno Q):
```
var rx = s{D-m-1};
var cls = typeof rx === "number" ? vm.specialObjects[5] : rx.sqClass;
var e = vm.findMethodCacheEntry(lit[n], cls);
var g = e.method !== null && e.method.directo;
if (typeof g === "function" && g.numArgs === m) {
    vm.sendCount++;
    var v = g(vm, rx, s{D-m}, .., s{D-1}, d + 1);
    if (v === DEOPT) return RT.mat(vm, METH, r, [a..], [t..], Q, [s0..s{D-m-2}], null);  // D3
    s{D-m-1} = v;
} else {
    return RT.mat(vm, METH, r, [a..], [t..], Q, [s0..s{D-1}], TAG_send{litIdx:n, argc:m});  // D5
}
```
- PROHIBIDO findSelectorInClass desde código directo (su miss muta la pila para DNU/cannotInterpret). findMethodCacheEntry es la única sonda tolerada (miss → entry.method=null → frontera; el vm.send del replay puebla el cache = auto-calentamiento; DNU/cannotInterpret quedan cubiertos por frontera sin código propio).
- El certificado de seguridad ES `.directo` instalado: jamás chequear primIndex en el sitio. `g.numArgs === m` cubre objectAsMethod/aridades raras.
- HOJAS QUICK-PRIM (v1): a los métodos con primIndex 256-519 se les instala .directo sintético — `return r` / constante / `if (typeof r === "number") FRONTERA; return r.pointers[i]` — sin chequeo de interrupciones ni decremento (paridad con tryPrimitive). Los alcanza solo el sitio directo (el hook nunca los ve: tryPrimitive corta antes). El sitio cuenta sendCount++ igual (el clásico los cuenta en executeNewMethod:1116).

2.6 TABLA COMPLETA DE PUNTOS DE DEOPT (pc, ops, temps, pend, acción del epílogo)

Regla de oro [C, comprobado]: JAMÁS materializar en el pc del bytecode del send (solo 24,4% tiene case; el resto cae en `default: interpretOne(true)` = single-step para siempre + break espurio). Los pcs de abajo son TODOS etiquetados por construcción del jit clásico (pc 0, destinos de salto, pcs post-send/post-op).

D1 ENTRADA (interrupciones o d>tope): pc=0; ops=[]; temps=[] (mat nilea y pone args — único caso donde "temps nil" es válido: nada corrió); pend=null. Epílogo: si counter≤0 → checkForInterrupts; si fue por profundidad y counter>0 → nada (reanuda clásico desde pc 0, re-ejecución idempotente).

D2 BACK-EDGE (etapa 2): pc=H (destino, etiquetado); ops=[s0..s{depth(H)-1}] (medido ≤1, 0 en el 97% [B]); temps=TODOS los t vivos actuales; pend=null. Epílogo: checkForInterrupts.

D3 CALLEE DEVOLVIÓ DEOPT (frame en espera): pc=Q (retorno post-send); ops=pila DEBAJO del send (operandos CONSUMIDOS): [s0..s{D-m-2}]; temps vivos; pend=null (el iniciador interno ya lo dejó). Epílogo: nada extra para este frame; doReturn le pusheará el resultado.

D4 FALLO DE specialNum/specialQuick inline: pc=Q (post-op); ops=pila COMPLETA con los operandos REPUESTOS [s0..s{D-1}]; temps vivos; pend={specialIdx:i}. Epílogo: vm.sendSpecial(i) — byte-idéntico al fallback del jit clásico, preserva quickSendOther.

D5 FRONTERA DE SEND COMÚN/SUPER: pc=Q; ops=[s0..s{D-1}] (rcvr+args REPUESTOS; en directed super la clase dirigida está en su slot estático y queda repuesta también); temps vivos; pend={litIdx,argc,super}|{dirsuper:litIdx,argc}. Epílogo: vm.send(lit[litIdx], argc, super) / vm.sendSuperDirected(...). El send corre UNA vez, por la maquinaria normal (idempotencia verificada: methodCache=memoización, at-cache solo-lectura, verify* scratch).

D6 mustBeBoolean: pc=pc del FALL-THROUGH del jumpIf (etiquetado: needsLabel[this.pc] en el clásico); ops=[s0..s{D-2}, cond] (condición REPUESTA — anomalía +1 heredada, bug-compatible); temps vivos; pend={mbb:true}. Epílogo: vm.send(vm.specialObjects[25], 0, false).

Trampas del cazador incorporadas como INVARIANTES de materialización (§2.7): sp exacto o el GC nilea/corre slots; ningún slot undefined; sender siempre sobreescrito; temps VIVOS (no nil) en todo deopt no-D1.

2.7 MATERIALIZACIÓN (RT.mat, receta del spike + delta de temps de B + trampas)

```
RT.mat(vm, method, rcvr, args, temps, pc, ops, tag):
  ctx = vm.allocateOrRecycleContext(method.methodNeedsLargeFrame())   // no dispara GC [verificado]
  p = ctx.pointers
  p[Context_method]=method; p[BlockContext_initialIP]=vm.nilObj; p[Context_sender]=vm.nilObj  // SIEMPRE: pointers[0] trae el link de la free list
  p[Context_receiver]=rcvr
  nT = method.methodTempCount()
  para i<nT: p[TFS+i]=vm.nilObj                       // base limpia (contexto reciclado = 21/22 slots de basura)
  para i<args.length:  p[TFS+i]=args[i]
  para i<temps.length: p[TFS+args.length+i]=temps[i]  // temps VIVOS; vacío solo en D1
  base = TFS+nT
  para j<ops.length: p[base+j]=ops[j]
  p[Context_instructionPointer]=vm.encodeSqueakPC(pc, method)
  p[Context_stackPointer]=vm.encodeSqueakSP(base+ops.length-1)        // EXACTO: el GC nilea >sp y un sp de más corre el push de doReturn
  ctx.dirty = true
  vm.nDeoptFramesDirecto++
  si !vm.deoptInner: { vm.deoptInner=ctx; vm.deoptPendiente=tag||null; vm.deoptMetodoIniciador=method; vm.nDeoptEventosDirecto++ }
  sino: vm.deoptOuter.pointers[Context_sender]=ctx
  vm.deoptOuter = ctx
  return DEOPT
```
Assert de desarrollo (build de debug): recorrer el frame y verificar que todo slot ≤ sp es number u objeto Squeak (jamás undefined).

2.8 HOOK Y EPÍLOGO (executeNewMethod, DESPUÉS de tryPrimitive:1129-1131, ANTES del decode:1135)

```
var f = newMethod.directo;
if (f !== undefined && this.directoOk && !this.logSends && !this.breakOnMethod
    && !this.breakOnContextChanged && !this.breakOnContextReturned && !this.breakOnMessageNotUnderstood) {
  if (typeof f === "function") {
    if (argumentCount === f.numArgs) {
      var b = this.sp - argumentCount, st = this.stack;
      var rc = st[b], ...;
      this.popN(argumentCount + 1);                    // INCONDICIONAL (éxito o deopt)
      var v; try { v = f(this, rc, ..., 1); } catch (ex) { <red RangeError, último recurso> }
      if (v !== DEOPT) { this.push(v); return; }       // caller clásico sigue INLINE
      // epílogo de deopt — orden fijo:
      this.deoptOuter.pointers[Context_sender] = this.activeContext;
      this.storeContextRegisters();
      this.activeContext = this.deoptInner;
      this.fetchContextRegisters(this.deoptInner);
      this.deoptInner = this.deoptOuter = null;
      this.reclaimableContextCount = 0;
      this.activeContext.dirty = true;
      var pend = this.deoptPendiente; this.deoptPendiente = null;
      <contabilidad de veto sobre vm.deoptMetodoIniciador>
      if (pend) <UNA acción: send / sendSpecial / sendSuperDirected / mustBeBoolean según §2.6>;
      else if (this.interruptCheckCounter <= 0) this.checkForInterrupts();
      return;
    } // aridad desigual: cae al clásico (sin frontera: nunca entró)
  } else { <contador directoN++; en umbral 8: gate+pase1+emitir+verificar+instalar; fallo → directoVetado> }
}
```
Regla ABSOLUTA del epílogo (trampa 3 del cazador): exactamente UNA acción terminal — el send pendiente O checkForInterrupts, JAMÁS ambas ni checkForInterrupts antes del send (un transferTo ahí deja un send fantasma con operandos repuestos: estado irrepresentable). El executeNewMethod del send re-emitido hace su propio chequeo con estado consistente.

sendCount (semántico — el grabador de eventos lo usa como línea de tiempo del replay): la entrada ya la contó executeNewMethod:1116 (el hook está adentro — NO copiar el estilo del spike, que reemplazaba el método entero); el código directo cuenta SOLO call-sites directo→directo y hojas quick (antes de llamar); la frontera NO cuenta en el sitio (cuenta el vm.send del epílogo); la aritmética inline exitosa no cuenta. Invariante A/B: sendCount(DIRECTO=0) === sendCount(DIRECTO=1), EXACTO.

Protocolo .directo espejo de .compiled: undefined→(contador)→función|false; directoVetado definitivo. AL INSTALAR .directo, FORZAR que .compiled quede GENERADO (protocolo dos-fases de jit.js:145-178: si está undefined/false, llamar compile las veces necesarias) — si no, el método que fue directo desde su 1ª activación reanuda post-deopt interpretOne-por-bytecode (degradación silenciosa + byteCodeCount movido).

Invalidación: `.directo = false` (y directoVetado=false) en los DOS sitios que anulan .compiled (vm.interpreter.js:263, 287) + en el caso de mutación de CompiledMethod vía objectAtPut (agujero heredado, se tapa para .directo). No hay epoch en v1: la sonda lee entry.method.directo en el momento del send y los flushes del methodCache corren en frontera. vm.directoOk: true al arrancar (o flag), false PARA SIEMPRE si corre interpretOne / se activa cualquier breakOn*/logSends.

Veto (regla 4 del README): el epílogo atribuye al iniciador; cuentan D4/D5/D6 (frontera y bool), NO D1/D2 (cadencia normal ~1/slice) ni D3 (culpa del callee). Umbral inicial: nFronteras ≥ 32 && nFronteras*2 > nLlamadas → directo=false, directoVetado=true. Ajustar con A/B en etapa 3.

interruptCheckCounter: JAMÁS cachearlo en local (forceInterruptCheck=-1000 es el canal de TODOS los eventos asíncronos). Leer/escribir el campo del vm en cada entrada y back-edge.

2.9 PLAN POR ETAPAS CON BATERÍA DE VALIDACIÓN

Batería BASE (corre en TODAS las etapas, en el arnés, DIRECTO=0 vs DIRECTO=1):
(a) diferencial exacto: salida byte-idéntica de los .st + sendCount idéntico + invariantes ##CHK del spike (fcheck.st: 1028457);
(b) estrés de switches: estres.st (300 despertares de proceso prioritario; resultados 1028457/150049 idénticos) + sonda Error().stack en transferTo/fullGC asegurando 0 frames "ᐅ" vivos;
(c) censo de deopts por motivo (D1..D6) y assert de que NINGÚN pc materializado cae en default del switch clásico (sonda: en debug, chequear que method.compiled tiene `case <pc>:`);
(d) assert de frames materializados (todo slot ≤ sp definido, sp = profundidad estática del pc);
(e) imágenes: Pharo AppRun arranca con el gate encendido (F9/traits/V3 rechazados limpio, 0 crashes), Squeak 3.8 V3 arranca con 0 compilaciones directas.

ETAPA 0 — Infraestructura sin emisión general: gate + pase 1 + RT.mat + hook + epílogo + hojas quick-prim solamente. Valida: batería base + arranque Morphic (PULSO=1) sin crash.
ETAPA 1 — R0 completo sin loops (emisión §2.3-2.5, todas las fronteras D1/D3/D4/D5/D6): tiny reproduce la victoria del spike. Valida: batería base + tinyBenchmarks exacto + verificación cruzada del decoder del codegen contra censo-lib sobre las 19.162 clasificaciones + corrida del pase-1 (worklist) sobre TODOS los elegibles de Pharo ANTES de habilitar ahí (riesgo R2 abajo).
ETAPA 2 — Loops (gate BLK + D2): Integer>>benchmark exacto; .st de tortura de do:/detect:/scanFor:; estrés de interrupción-en-loop (loop caliente + switches forzados) A/B idéntico; censo confirmando depth(H) materializada ≤1.
ETAPA 3 — Política: tuning de umbral/veto con censo de deopts en Morphic vivo; pruebas de invalidación (redefinir método caliente por file-in mid-run, become, objectAtPut sobre CompiledMethod) A/B idéntico.
ETAPA 4 — Palancas medidas: super estático (clase constante por método, R2 casi gratis), inline de */bitAnd:/bitOr:, fast-paths at:/size con atCache solo-lectura, quick-prim inline en call site, peephole cmp+jumpIf. Cada una con la batería base ANTES de mergear la siguiente.
ETAPA 5 — Solo-si-la-telemetría-lo-pide: intrínsecos de primitivas que no fallan (la palanca 66%→95% de Morphic — exige camino de fallo por intrínseco, diseño aparte), compilar-al-contacto, sondeo de directoTope al boot, modo SW fallback (hoy: 0 métodos lo necesitan).
Encendido por default: recién tras auditoría adversarial (regla 5 del README) + A/B intercalado de perf en máquina quieta (no en esta).

====================================================================
3. RIESGOS ABIERTOS (ningún diseño los resuelve)
====================================================================

R0 — TRUNCAMIENTO DEL INFORME DE DEOPT: el resumen del cazador se corta en "hay dos puntos que el c…". Si esos dos puntos no son los dos primeros de su lista de hechos (GC-nilea y sendCount, ya incorporados), hay hallazgos sin foldear. Verificación: recuperar el informe completo del cazador ANTES de la etapa 0 y auditar la spec contra él.

R1 — CONSUMIDOR DE REPLAY: aun con sendCount exacto, la CADENCIA de checkForInterrupts difiere entre modos (menos activaciones clásicas = otros momentos de bomba de eventos) → una grabación hecha en un modo puede no replayar en el otro. Plan: correr el arnés de grabación/replay del worker en ambos modos; aceptar y documentar "replay con el mismo modo que la grabación" si difiere.

R2 — MODELO DE PROFUNDIDADES EN PHARO: verificado exhaustivamente solo en Cuis. El pase 1 por método es la defensa, pero un bug del pase 1 mismo solo está contrastado contra Cuis. Plan: correr la interpretación abstracta sobre los 88.607 elegibles de Pharo (extensión de censo-elegibilidad.js, ya existe la base) y exigir 0 inconsistencias antes de habilitar Pharo.

R3 — PRESIÓN SOBRE V8: miles de funciones generadas (hasta ~13k elegibles) = memoria de codegen, costo de new Function, ICs polimórficos en los call sites del hook. Ningún diseño lo midió. Plan: censo de {funciones compiladas, RSS, tiempo de codegen acumulado} en Morphic vivo con umbral 8; si duele, subir umbral/LRU.

R4 — TOPE DE PROFUNDIDAD EN BROWSERS: 1000 sale de mediciones en Node (mín 2.755); Safari/worker pueden ser más chicos y el RangeError como red NO materializa (pila perdida → el try/catch del hook solo salva el proceso, no la semántica… en realidad al no haber materializado nada re-ejecutar desde el contexto del caller clásico es correcto, pero los contadores de interrupciones ya movidos introducen sesgo). Plan: matriz de browsers en el worker de producción midiendo profundidad real antes de encender default; considerar sondeo al boot.

R5 — DIVERGENCIA =/~= JIT-vs-INTÉRPRETE (heredada): los tramos post-deopt que corran interpretados (no debería haber, con .compiled forzado — pero checkForInterrupts:810 y el trampolín tienen caminos interpretados) pueden diferir en clases perversas donde x=x no responde true. Igual que hoy entre jit e interpretOne. Plan: documentar; test con clase perversa confirmando que directo==jit clásico (el término del A/B).

R6 — LA DISCIPLINA DE PCs ETIQUETADOS ES CARGA-PORTANTE: un bug de emisión que materialice en un pc sin case degrada a single-step PARA SIEMPRE en silencio (más un break espurio al host). Plan: el assert (c) de la batería en TODA corrida de desarrollo + en producción un contador vm.nInterpretOne que la telemetría vigile (debería ser 0 con directoOk).

R7 — BLOQUES COMO TECHO ESTRUCTURAL: el residuo duro de Morphic (BlockClosure>>value/value: = arista #1 de ruptura, y ~5% aun con intrínsecos) no lo toca NINGÚN diseño; peor, Cuis (0xFA embebido) y Pharo (0xF9 full) exigen DOS diseños de "bloque directo" distintos. Sin eso, la ganancia en Morphic tiene techo bajo (el veto apagará gran parte — correcto pero sin ganancia). Plan: aceptar el techo en v1; medir con el censo dinámico qué home-methods concentran value: (do:/collect: con bloque no-capturante) para dimensionar la v2 ANTES de diseñarla.

R8 — LÍNEAS DE CÓDIGO CITADAS SOBRE ÁRBOL LOCAL MODIFICADO: este árbol tiene parches propios (sp-en-local 92c308f, signed32BitIntegerFor con fast-path). Todos los números de línea de la spec deben re-verificarse contra el árbol al implementar, y el A/B corre SIEMPRE sobre este árbol, no sobre upstream.