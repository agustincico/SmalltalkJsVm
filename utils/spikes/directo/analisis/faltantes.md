Tengo todo. Escribo el veredicto de completitud.

---

VEREDICTO DEL CRITICO DE COMPLETITUD — 2026-09-05

Nota de método: todo lo rotulado [CORRIDO HOY] lo ejecuté yo en esta sesión; artefactos en `/private/tmp/claude-501/-Users-agustin-SqueakJS/6765a590-7fe2-4fcb-9c3f-190369322e92/scratchpad/critico/`. Todo lo rotulado [VERIFICADO HOY] es lectura de primera mano del árbol actual con línea exacta. El repo no se tocó.

== 1. LO QUE CERRÉ YO (dejaba de ser "leído-en-código") ==

1.1 LA DEOPT DE FRONTERA NUNCA SE HABÍA EJECUTADO — AHORA SÍ [CORRIDO HOY]. Las 368 deopts del spike eran TODAS por interrupción (pend=null). Escribí `critico/spike-frontera.js` (extensión del spike: D5 en los dos sitios de send benchFib con operandos REPUESTOS + pend, D4 en el `+` de pc 17 con replay `vm.sendSpecial(0)`, epílogo con la regla "exactamente UNA acción terminal") y corrió verde: fcheck.st → ##F28 1028457 exacto con 517 eventos (104 D5-r1 + 30 D5-r2 + 12 D4 + 371 interrupt, ~10.6 frames/cadena = cadenas profundas D3+D5 mezcladas); estres.st (300 switches de proceso) → 1028457/150049 exactos con 529 eventos; 0 reentradas al hook con cadena a medio armar. Esto valida además la reentrada mixta: el vm.send del replay reentra al hook y vuelve a forma directa con el caller materializado clásico — exacto. La receta D4/D5 de la spec pasa de "leído" a "comprobado-corriendo". Portar este spike como test permanente de Etapa 0.

1.2 EL INVARIANTE (a) DE LA BATERÍA ES FALSO COMO ESTÁ FORMULADO [CORRIDO HOY]. "sendCount(DIRECTO=0) === sendCount(DIRECTO=1), EXACTO" es incomprobable en el arnés actual: dos corridas del MISMO modo difieren — DIRECTO=0: 1178415 vs 1178532; byteCodeCount 76335 vs 75537 (reloj real → cadencia de checkForInterrupts variable → trabajo de procesos de fondo variable). La varianza intra-modo (~120 sends) es del mismo orden que cualquier diferencia inter-modo: falsos positivos Y bugs enmascarados. El invariante solo vale bajo entorno determinista (ver 3.1).

1.3 OPERADOR DEL CONTADOR: POST-decremento [VERIFICADO HOY]. `vm.interpreter.js:1168` es `this.interruptCheckCounter-- <= 0`. El diseño B tenía razón; A y C no; el spike usa PRE (`--vm.interruptCheckCounter`, spike-directo.js:35). La spec debe copiar el post-decremento del archivo.

1.4 findMethodCacheEntry NO es sonda pura [VERIFICADO HOY]. En el miss DESALOJA una entrada (1382-1385: la reclama con selector/clase y method=null) y avanza methodCacheRandomish. Semánticamente inocuo (memoización pura; el vm.send del replay la repuebla — mi experimento lo confirma de facto), pero la spec dice "solo sondea": corregir la redacción y documentar que la sonda directa puede desalojar entradas calientes del clásico (costo de re-lookup, jamás de semántica).

1.5 Líneas load-bearing reverificadas contra ESTE árbol [VERIFICADO HOY]: sendCount++ primera línea de executeNewMethod (1116); tryPrimitive 1129-1131 y decode 1135 (el hook va entre ambos); logSends/breakOnMethod corren ANTES (1117-1128) — coherente con apagar directoOk ante logSends; two-stage del jit (jit.js:146-178, undefined→false→función); mustBeBoolean `vm.sp++; vm.pc=<post>; vm.send(specialObjects[25],0,false)` + needsLabel (jit.js:1044-1045); GC nilea >sp en fullGC (vm.image.js:582-585) Y partialGC (764-767); free-list encadena por pointers[0] (1481/1486) → sender SIEMPRE sobreescrito; encode/decodeSqueakPC/SP 1462-1476; sendSpecial:893 lee selector Y argc de this.specialSelectors → el replay D4 con solo el índice es correcto y es lo que emite el jit (jit.js:1059,1111,...); .compiled=null solo en 263 (neuter de hackImage) y 287 (single-step); checkForInterrupts:810 compila this.method; forceInterruptCheck:759 (=-1000); sp-en-local sincroniza alrededor de send/sendSpecial/sendSuperDirected/doReturn (jit.js:421-427, lista "inseguras").

== 2. AFIRMACIONES QUE SIGUEN SIN COMPROBAR CORRIENDO (con experimento mínimo) ==

2.1 D6 mustBeBoolean: ni el replay ni el ground-truth clásico se ejercitaron. Experimento: .st con `| x | x := 5. x ifTrue: [1] ifFalse: [2]` en clásico (fijar salida exacta), luego forzarlo estilo spike-frontera (materializar en fall-through con cond repuesta + send de specialObjects[25]). ~1h.

2.2 "tryPrimitive nunca falla en quick prims 256-519" (sostiene que el hook jamás ve hojas quick y que no necesitan cuerpo): leer quickPrimitiveResponse + un caso borde (quick instVar-return con receptor inmediato si es construible). ~30min.

2.3 Forma de pila cuando executeNewMethod llega vía primitivePerform / object:perform:withArgs / DNU: el hook está DENTRO de executeNewMethod, así que perform:→directo es camino real de día 1. Leer esos caminos + .st con perform: de un método elegible. ~30min.

2.4 GC pleno SOBRE frames materializados: mis corridas no gatillan fullGC. El cazador de deopt dejó sondas en `scratchpad/deopt/` (gc.st, gc2.st, sonda-gc.js) pero su informe llegó truncado (R0 del juez). Experimento: DIRECTO=2 (mi spike, fuerza fronteras) + proceso prioritario que hace `Smalltalk garbageCollect` en cada despertar — el nileado >sp del GC convierte sp inexacto/slot undefined en fallo INMEDIATO. ~1h. Esto además cierra R0 por la vía de auditar los scripts del cazador en vez de perseguir su texto perdido.

2.5 Caminata de pila estilo profiler sobre cadenas materializadas: proceso prioritario que camina `Processor activeProcess suspendedContext sender sender...` imprimiendo métodos/pcs, A/B contra clásico. Detecta senders/ips mal encadenados que hoy solo crashearían lejos de la causa. ~1h.

2.6 R2 del juez (profundidades en Pharo): la interpretación abstracta corrió solo sobre Cuis. Extender censo-lib a los 88.607 elegibles de Pharo y exigir 0 inconsistencias ANTES de habilitar Pharo. ~2h, base ya existe.

2.7 R3 (presión sobre V8): sin dato alguno. Censo (no benchmark): nº funciones generadas + RSS con umbral 8 en Morphic vivo. Puede esperar a Etapa 3, pero antes de encender default.

== 3. LA BATERÍA vs EL BUG HISTÓRICO ==

3.1 EL ORÁCULO DIFERENCIAL POR PASOS YA EXISTE Y ES EXACTAMENTE LO QUE FALTA: `perf/harness/difftrace.js` en la rama perf/stack-zone [VERIFICADO HOY con git show, 783 líneas; copia en scratchpad/difftrace-stackzone.js]. Entorno determinista (reloj virtual congelado hasta el loop, Date/performance/Math.random stubeados, WebSocket inerte, limpieza de .changes), hash FNV-1a de (sendCount, fingerprint-de-método POR CONTENIDO, pc) en checkpoints cada 4096 sends, ventana `--logfrom/--logto` por-send que biseca cualquier divergencia a ±4096 sends, modo --ui con inyección de eventos por umbral de sendCount y hash del display, y golden.json con exit 1. Un valor silenciosamente equivocado que desvíe UN send aparece en el hash y se biseca — es la respuesta directa al bug histórico, ya probada en el proyecto stack-zone.

3.2 Y ya resolvió el problema que el directo va a tener: `vm.jit2LeafHook` (difftrace:548-561) — los sends que NO pasan por executeNewMethod deben muestrear los MISMOS checkpoints o el hash diverge espuriamente. Los call sites directo→directo son ese caso. Consecuencia de diseño para el codegen DESDE EL DÍA 0: modo traza que emita el muestreo en cada sitio directo (o variante instrumentada compilada cuando el hook está instalado).

3.3 Tareas: (i) portar difftrace.js a main (~1 día: quitar los require de vm.stackzone.js/jit2.js y los contadores de zona; el resto es independiente de representación); (ii) redefinir el invariante (a): salida byte-idéntica SIEMPRE en el arnés común + hash idéntico BAJO difftrace; sendCount total solo bajo difftrace; (iii) sumar 2.4 y 2.5 a la batería; (iv) implementar el assert (c) del juez como chequeo debug de `case <pc>:` en method.compiled.toString() al materializar + vigilar nSingleStep (la sonda SSDBG de difftrace:331-341 ya muestra cómo).

== 4. CASOS SIN DECISIÓN Y ORDEN DE CONSTRUCCIÓN ==

4.1 El vocabulario está cerrado — no encontré bytecode sin decisión. Decisión operativa pendiente chica pero real: CUÁNDO se instala `.directo` en las hojas quick 256-519 — el hook nunca las ve (tryPrimitive corta en 1129-1131) y los sitios directos solo llaman lo ya instalado. Propuesta: instalarla al compilar el CALLER cuando la sonda encuentra un callee quick elegible.

4.2 Paso demasiado grande confirmado: Etapa 1. Partirla: **Etapa 0** valida RT.mat/hook/epílogo SIN codegen portando spike-frontera.js (ya escrito y verde; la Etapa 0 del juez — solo hojas quick — dejaba toda la maquinaria de deopt sin ejercitar, porque las hojas ni chequean interrupciones). **Etapa 1a**: emisión general con TODO send como frontera (cero directo→directo): cadenas de largo 1, sin D3, oráculo difftrace. **Etapa 1b**: encender directo→directo (D3, profundidad, tope). Recién ahí tiny.

4.3 Logística crítica: RESCATAR el scratchpad de sesión a lugar durable ANTES de empezar — la batería DEPENDE de censo-lib.js como gate y todo vive en un directorio de sesión: `censo/` (censo-lib, censo-elegibilidad, verificar-censo, censo-bytecodes, censo2, selectores, volcar-benchfib), `switch/censo-blk.js` (el gate BLK de Etapa 2 — existe, confirmado), `estructura/`, `trampas/` (escanear-heap.js, bordes.st), `deopt/` (las sondas GC del cazador), `critico/` (spike-frontera.js, correr-cuis-conteo.js). También: el bug upstream mod/div del desensamblador sista (0xFA) hay que parchearlo en el tooling de validación antes de usar InstructionPrinter. R8: las líneas quedaron reverificadas HOY sobre este árbol; si entran commits antes de implementar, repetir el grep (15 min).

VEREDICTO: con 1.1-1.5 cerrados hoy, no queda ninguna incógnita ESTRUCTURAL — las tareas 2.1-2.6 + 3.3 + 4.3 son pre-requisitos concretos y chicos (~2-3 días en total), y ninguna puede descubrir un problema de diseño, solo calibrar detalles. Implementable sin sorpresas después de ese lote, con difftrace portado como término del A/B.