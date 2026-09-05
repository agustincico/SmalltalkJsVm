# Estado del proyecto — reconstrucción de la sesión larga (5 jul → 17 ago 2026)

Este documento reconstruye TODO lo que pasó en la sesión de Claude Code que corrió seis
semanas y murió el 17-ago ~02:39 (transcript: sesión `8ee00768` en `~/.claude/projects/`).
Reemplaza y supera al `ESTADO.md` viejo que quedó en la rama `perf/stack-zone` (ese quedó
congelado el 28-jul; le faltan las tres semanas más productivas).

**Estado neto: no se perdió nada.** El working tree está limpio, main == origin/main, y el
último trabajo (port del VectorEnginePlugin) quedó commiteado, pusheado y validado. La sesión
murió esperando dos http-servers en background, no trabajo pendiente.

---

## 1. Dónde quedó la pelota (lo único urgente de leer)

**El frente activo era el VectorEnginePlugin de Cuis, y quedó TERMINADO pero APAGADO.**

Contexto: Juan Vuletich mandó un mail (16-ago) probando SqueakJS: notó que el
VectorGraphicsPlugin no estaba (sin handles de escala en los halos) y que los DoIt fallaban.
Lo segundo se arregló ese mismo día (bug del header Sista en 64 bits, ver §3). Lo primero
disparó el port:

- `plugins/VectorEnginePlugin.js` — 4635 líneas, 44 primitivas, port a mano del C generado
  (jmv.26, API 7). Commits `6b32ff3` (baseline) → `02c7b0d` (esqueleto) → `0b89fef` (port
  completo) → `2eb4dbd` (resultados en el informe). Todo en main y pusheado.
- **Validación**: formas/béziers/arcos/punteado/stroke+fill BIT-IDÉNTICOS al motor Smalltalk
  (0 de 40.000 píxeles distintos en 5 escenas); texto TrueType estructuralmente idéntico
  (peor delta 1 px por columna, igual que en nativo).
- **El síntoma de Juan, resuelto y fotografiado**: halo pasa de 16 a 19 blobs (aparecen los
  3 handles). Evidencia visual A/B en
  `utils/VectorEnginePlugin.ref/mediciones/halo-sinplugin.png` y `halo-conplugin.png`
  (rescatadas de /tmp; la sesión murió antes de poder mostrarlas). El arnés que las genera:
  `mediciones/halo.js` (puppeteer).
- **Perf ago-2026, línea tinyBenchmarks** (26-ago): el jit ahora mantiene `vm.sp` en una
  local del código generado (`Compiler>>spLocalize`, jit.js) — **bytecodes 2.1x** (A/B
  pareado 328→688 M/s; absoluto en máquina libre: mediana 782M, mejor 811M "Dorados").
  Encendido por defecto tras auditoría adversarial (gramática estricta sobre el codegen,
  SharedQueue stress, GC en bucles jiteados, humos de Pharo 64 y Squeak 3.8 V3). Escapes:
  `SPLOCAL=0` (arnés), `#nosplocal` (run/), `JITSP=`/`JITSPNOT=` (bisección). Regla de oro
  del diseño: vm.sp viejo-ALTO es seguro, viejo-BAJO corrompe (GC nilea sobre el sp
  registrado); el GC solo dispara desde primitivas → sends → ya son puntos de sync. De
  paso: bug upstream (2021) del template at:put: arreglado (String at:put: en bucle
  jiteado mataba la VM). Scripts de validación en `utils/arneses-node/scripts/`
  (tiny/veri/dif/atput). benchFib NO cambia: el hueco de sends (activación+lookup+retorno,
  ~44% del tiempo) sigue siendo la línea abierta — atacarlo en serio es el trampolín
  (2 entradas JS por send), que colinda con la stack zone cerrada.
- **Perf 5-sep (4): sends 146,5 M/s (19,4x) — y el censo REFUTÓ que los bloques sean
  el techo** (2aee7db). Censo nuevo `DIRECTOFRONTERA=1`: dice por qué se rompe cada
  cadena en Morphic vivo. Resultado que cambia el plan: **los bloques son el 0,6%**, no
  el techo (R7 del análisis, refutado con datos — nos ahorró semanas). Los motivos
  reales eran hojas quick-prim (18,5%) e inline cache (18,6%), ambos ya implementados:
  las primitivas 256-519 reciben un `.directo` sintético instalado desde el camino de
  frontera, y cada sitio de send cachea (clase→función) en el closure con invalidación
  por época, en vez de sondear el cache global (que además desalojaba entradas: nos
  hacíamos las roturas solos). Fronteras 17.605→15.979, vetados 189→137, cadenas de
  1,4→2,2 frames. Traza idéntica en los dos modos. **Pero en Morphic sigue ~7% más
  lento** (4/4 pares): lo que queda es estructural (40,8% vetados, 23,4% fríos). La
  decisión no cambia: opt-in, no por defecto.
- **Perf 5-sep (3): la forma directa NO ayuda a la performance SENTIDA** (82a0dd9).
  Medido con difftrace --ui --until-stable (Morphic offscreen real): 3 pares
  intercalados 8507→8813 ms (~4% peor) y corrida completa 13676→25007 ms (1,8x peor),
  mismo trabajo. Causa medida: **76,6% de las deopts son fronteras de send** — Morphic
  está saturado de bloques, los métodos con bloques son inelegibles, y cada rotura de
  cadena cuesta más que el send clásico (riesgo R7 del análisis, confirmado). Bajar el
  veto de 32 a 4 empeora (9,4→22,9 s): vetar un método hace deoptimizar a sus
  llamadores y se produce una cascada. **Decisión: queda opt-in, no va por defecto ni
  al browser.** Sigue siendo 7-8x real en código send-heavy y traza-idéntica. El único
  camino para que ayude a lo sentido es soportar BLOQUES (v2): proyecto grande, rédito
  incierto. Censo nuevo: DIRECTODEOPT=1 (deopts por tipo), DIRECTOCOSTO=1 (costo de
  compilar: 96 ms/45 s, y sólo el 36% sería delegable a otro worker).
- **Perf 5-sep (2): etapa 2 — LOOPS** (commit 3d0a801). Cobertura 476 → 534 métodos
  en Cuis (1928 en Pharo), con el gate BLK del censo implementado: back-jumps siempre
  incondicionales, loops anidados o disjuntos, ningún salto de afuera aterrizando
  adentro. Emisión con `L{H}: for(;;)` y bloques anidados por región; back-edge con
  chequeo de interrupciones y deopt D2 en el pc del destino. **La traza sigue idéntica
  al clásico** sobre 3,0 M sends. Dos bugs propios en el camino: el decoder perdía el
  pc de las instrucciones con prefijos de extensión (la pista fue que rechazaba 40
  métodos por un motivo que el censo decía imposible), y un destino que es el header
  de un loop no está adentro del loop (el bloque cierra antes del for(;;)). Censo de
  motivos nuevo: `DIRECTOMOTIVOS=1`.
- **Perf 5-sep: EL CODEGEN DE FORMA DIRECTA EXISTE — sends 7,94 → 60-85 M/s**
  (`jit.directo.js`, commits 07e0287 y ce1af06). Compila métodos reales de la imagen
  a funciones JS con args posicionales y frames en la pila de JS; deopt al
  desenrollar (D1 entrada, D3 callee, D4 aritmética, D5 frontera de send, D6
  mustBeBoolean), todas materializando en pc etiquetado. benchFib A/B 5/5 sin
  solaparse: 344 → 43 ms = 8,0x. **Traza idéntica al clásico sobre 3,0 M sends**
  en los dos modos, verificada con el oráculo portado de perf/stack-zone.
  El oráculo encontró 3 infidelidades que ninguna batería de resultados detectaba
  (replay del 2º nivel de las especiales; fast paths de at:/at:put:/size; y que el
  código directo no puede escribir vm.pc). Pharo 64: 1808 métodos, 0 errores.
  Morphic vivo 45 s: 0 errores. Análisis completo y herramientas en
  utils/spikes/directo/. Falta: loops (etapa 2), browser, auditoría, default.
  OJO: el oráculo BORRA el .changes al lado de la imagen — usar dir propio.
- **Perf 4-sep (3): SPIKE DE FORMA DIRECTA — 15,7x en benchFib, validado** (commit
  97f15a0, `utils/spikes/directo/`). Es el camino estructural para el hueco de sends
  (50x contra Cog, mientras bytecodes está a 7x): métodos que reciben receptor y args
  como argumentos de JS, frames en la pila de JS, cero MethodContext en el caso común,
  y **deoptimización al desenrollar** — cada frame materializa su contexto mientras la
  pila se desenrolla, y el VM sigue con el jit clásico, que ya sabe reanudar. benchFib
  compilado A MANO: valida el diseño, no un codegen. A/B 6/6 pares sin solaparse
  (355-418 → 19-39 ms) = ~115 M sends/s, del 2% al 28% de Cog. Deopt ejercitada 368
  veces/corrida (y 1.048.730 en una versión con bug de cadencia, siempre exacta), y
  bajo 300 cambios de proceso forzados los dos modos dan resultados idénticos.
  **NO es la stack zone**: ahí el trabajo se re-representaba y los closures la hacían
  PEOR; acá se elimina, y ante un closure se deoptimiza ese frame — nunca peor que hoy.
  El proyecto que sigue (codegen general, reglas de frontera y de GC) está escrito en
  el README del spike.
- **Perf 4-sep (2): MIRILLA EN EL CODEGEN — bytecodes +13%, 905 Dorados** (commit
  5f18808). El jit transcribía bytecode a bytecode, así que todo valor iba y volvía por
  el array de pila aunque naciera y muriera dos instrucciones después. La mirilla fusiona
  pares adyacentes: push+popInto → asignación, y push(es)+plantilla → operandos por
  locales de JS (binarias de SmallInteger, at: y at:put: con sus tres operandos). Seguridad
  por construcción: adyacencia textual (un `case N:` sobreviviente = un salto aterriza ahí
  = no se toca), lista blanca de operandos puros, el camino lento repone y queda
  byte-idéntico, sólo `else` plano, y fallback por método. Medido: criba 8/8 pares,
  293→259 ms; tiny 777→877 M/s. Escapes: PEEPHOLE=0 / #nopeephole.
- **TECHO DE LA MIRILLA, documentado**: las fusiones que faltan en el bucle de la criba
  (at:put:→descarte, +→popInto, comparación→salto) están TODAS bloqueadas por labels
  `case N:`, que existen porque el camino lento de cada instrucción puede retornar al
  trampolín. Post-mirilla la criba es 88% código generado y el VM ~2%: para seguir hay que
  cambiar la FORMA del código generado (camino rápido lineal + continuaciones frías
  fuera de línea con su propia tabla de resume), no agregar patrones. Eso es un rediseño
  de varias sesiones, no un parche.
- **Perf 4-sep, máquina quieta — números oficiales y dos cierres**: tinyBenchmarks
  mediana 815 Mbc/s / 8,16 Msends/s, **839 Dorados** de mejor corrida. Cierres con
  números: (a) activadores por método retesteados en quieto = +3,5%, 7/10, solapado →
  NO aterriza, definitivo (parche y autopsia en utils/arneses-node/estacionados/);
  (b) guardas indexOf en spLocalize (3,9% del boot) = +1,4% dentro del ruido con salida
  byte-idéntica probada → revertido: no paga su complejidad. Post-oopMap el boot headless
  de Cuis es ~0,8 s y lo que queda es difuso (interpret frío 10%, GC de carga 7%,
  readFromBuffer residual 7%): sin palanca clara.
- **Perf 3-sep (2): CARGA DE IMAGEN -32/-42%** (commit 3d25597): el oopMap del loader
  era un Map con claves oldBaseAddr+oop > 2^31 → V8 hasheaba doubles millones de veces;
  ahora Uint32Array de índices + tabla (derrame a Map para claves fuera de rango). Pharo
  46MB: 3,1→1,8 s de mediana; Cuis: 390→265 ms. Es perf *sentida* en cada arranque del
  sitio. Sonda: CARGA=1 en el arnés. Pendiente natural: mismo tratamiento para
  loadImageSegment (proyectos) si algún día pesa. Lo estructural de sends quedó
  estacionado con números en utils/arneses-node/estacionados/ (activadores por método:
  +2-4% solapado, retestear en máquina quieta).
- **Perf 3-sep: la línea tinyBenchmarks quedó MINADA — no re-excavar sin idea estructural
  nueva.** Post sp-en-local, perfiles limpios (procesar-cpuprof.js, ventana estacionaria):
  la criba es 88% código generado (solo mejor codegen ayudaría; semanas para migajas) y
  benchFib es 36% cuerpo + 58% maquinaria de send cuyos micro-caminos ya fueron acotados
  adversarialmente a ≤2% cada uno (activación magra, retorno magro, cache, IC). Dos
  experimentos nulos documentados hoy: (1) predeclarar el slot `compiled` en el
  constructor compartido = 0% (A/B 5+5 intercalado, medianas 345 vs 352 ms) — el "43% en
  una línea" del perfil era ATRIBUCIÓN FANTASMA de positionTicks sobre código optimizado
  de V8: jamás creer ticks por línea sin A/B; (2) el único estructural restante para
  sends es el trampolín/stack-zone, cerrado con números. Lo que sigue en perf real:
  workloads de imagen (carga ~1,4s del boot de Pharo, línea abierta de siempre).
- **Performance**: redibujos 1,7–2,1x (1 Browser: 169→101 ms; 3 Browsers: 474→229 ms), el
  rasterizador pasó a <1% del perfil. El arrastre sigue 5–10 fps porque ahora manda Morphic
  interpretado (44% maquinaria de sends) — ese es otro problema.

**RESUELTO (17-ago): Agustín dio el OK y el plugin quedó ENCENDIDO por defecto y
deployado a producción** — `COMPLETE=true` (commit `6971fad`), import agregado en
`squeak.js`, dist regenerado, sitio regenerado y deployado; verificado con el arnés de
rotación (`mediciones/rotar.js`) en worker y main-thread, local y en
smalltalkjsvm.com.ar, con Cuis 7.8 y Cuis University: los morphs ROTAN, cero errores.
Queda solo contestarle a Juan (con las capturas del halo). Lo que sigue describe cómo
estaba antes del encendido:** Hoy está apagado (`COMPLETE=false` adentro del
plugin), se activa solo con `#vectorPlugin` en la URL y **solo en modo worker** (el import
está en `squeak_worker.js:48`; `squeak.js` NO lo importa — el informe dice que sí, está mal).
Checklist del encendido, si das el OK:

1. `COMPLETE=true` en `plugins/VectorEnginePlugin.js`.
2. Agregar el import también en `squeak.js` (para main-thread / Safari sin OffscreenCanvas).
3. `npm run build` (dist/ quedó pre-plugin).
4. Regenerar el sitio con `utils/mk-site.py` (el deployado no contiene el plugin) — ojo que
   su `examples()` PISA la lista de `run/index.html`, editar ambos.
5. Humo de los 5 ejemplos + deploy:
   `cd ~/smalltalkjsvm && npx wrangler@3 pages deploy . --project-name=smalltalkjsvm --commit-dirty=true`
6. Contestarle a Juan (con las dos capturas del halo). Pendiente no bloqueante: confirmar
   licencia del mcz con él.

Pendientes menores del plugin: prueba dedicada de picking por morphIds y del ciclo
snapshot/reload; si sale jmv.27, re-portar (la herencia dotless-i/diacríticos difiere igual
que en nativo, es deliberada).

Referencia completa en `utils/VectorEnginePlugin.ref/`: INFORME.md (decisión + baseline +
resultados), TRADUCCION.md (reglas C→JS), el .mcz, el C de 5637 líneas, `coser-vep.py` (el
cosedor que normaliza las dos formas de definir funciones), `vso/VectorEnginePlugin.so` (el
binario nativo con DWARF, "oráculo de última instancia") y `mediciones/` (arneses).

---

## 2. Mapa de lo construido en las seis semanas

### El modo worker (la victoria de UX: chau ruedita)
La VM corre en un Web Worker con OffscreenCanvas (`squeak_worker.js`); el main thread nunca
se congela. Benchmark: worker 0 frames con jank / peor 18 ms vs main-thread 4 janks / peor
83 ms (y en operaciones pesadas el main se congela segundos). Incluye: JPEG worker-safe
(createImageBitmap), cursor manejado por la imagen (CSS cursor:url), audio streameado, sync
localStorage↔worker (los workers no tienen localStorage y ahí vive la ESTRUCTURA del FS
virtual), clipboard, zips, drag&drop, botón 📂 móvil, download-on-save a Downloads, resize,
headRoom 512 MB, JIT-fallback automático. Es el default en `run/` y en el sitio. Doc:
`WORKER.md`.

### Compatibilidad de dialectos (la matriz completa anda)
- **Squeak 6.0**: anda.
- **Cuis 7.8**: anda CON JIT (ver bug del nop abajo). Arrays 16/64-bit implementados
  (formatos Spur 9 y 12–15). Cuis University en el sitio, servido por rangos HTTP desde el
  zip de GitHub (baja ~11 MB de un bundle de 215).
- **Pharo 10-32, 10-64, 11, 12 y 13**: todos bootean interactivos. La saga completa está en
  `pharo/README.md`. Piezas: FileAttributesPlugin nuevo (~180 líneas, 16 primitivas),
  `hackImage` con el fix de WordSize (Pharo cachea wordSize en una class var de
  VirtualMachine — ESE era el bug entero del 64-bit), `neuter` de LGitLibrary (mata el
  debugger FFI/git; en Spur se sobreescribe el primer bytecode con 0x58), compat64 (restaura
  DisplayScreen/InputEventSensor que los builds 64-bit eliminaron) y compat13 (porta
  DisplayScreen entero, 57 métodos, generado por `utils/mk-compat13.py`). El launcher
  detecta la versión de una imagen arrojada en 132 ms (header ≥68000 = 64-bit; string
  'DisplayScreen' standalone separa 10/11 de 12/13).
- **Pharo 14/15**: NO andan (compat13 falla en InputEventFetcher, pantalla blanca). Pendiente.
- **Dialogo.image** (Cuis 4507): anda; fue el banco de pruebas de todo el worker. Primitivas
  Stream 65/66/67 implementadas (SmartRefStream las usa al deserializar).

### Bugs de VM con causa raíz (los que costaría redescubrir)
- **El nop Sista (jit.js:562)**: el bytecode 0x5F era el único sin `generateLabel()` → saltos
  al PC siguiente caían a "invalid PC" → **toda la familia Cuis 7 corrió sin JIT durante 11
  años y nadie lo había diagnosticado** (ni upstream). Fix de 1 línea (`752cf82`): arranque
  de Cuis 4,7s → 2,7s.
- **Header de método en 64 bits Sista** (el bug de Juan): el flag Sista es el SIGNO de un
  SmallInteger de 61 bits → llega como LargeNegativeInteger. Dos mitades: la primitiva
  `newMethod:header:` Y la reescritura vía `objectAt: 1 put:`. Arreglar solo la primera es
  PEOR (métodos Sista despachados como V3). Memoria: `squeakjs-header-64bits.md`.
- **JIT solo inlineaba comparaciones de SmallInteger**: con un Float mandaba send real, y
  Pharo guarda bounds de morphs como Float → cada comparación de redibujado terminaba en
  `Float>>asTrueFraction`. Banco de morphs de Pharo 9482→3630 ms.
- **Primitiva 158**: Pharo y Squeak esperan -1/0/1; el plugin generado devuelve 1/2/3.
  Conectarla directo rompe TODA comparación de strings en silencio.
- **Primitiva 578** (suspend con backup del PC): rebobinar el PC no alcanza, hay que reponer
  la variable de condición en el tope de pila, si no un proceso resumido se cuela en un Mutex
  ajeno (Pharo/Squeak lo pisan; Cuis no porque su Mutex es un Semaphore). vmParameterAt: 65
  bit 5 encendido. OJO: la 578 NO arregla el debugger de Cuis (ese A/B estaba mal, era
  artefacto del arnés).
- **Enteros grandes O(n²)**: bigIntFromStackInt copiaba el BigInt entero por shift. Política
  final por forma ("lopsided"): BigInt solo para grande×grande multiply (gana 29x); suma y
  grande×chico van a la imagen. Pharo aritmética 1842→67 ms (quedó más rápido que Squeak).
- **Adler-32 (ZipPlugin)**: módulo dos veces por byte = 23,9% de los freezes de Dialogo;
  diferido por bloque de 5552 bytes como zlib = 11x.
- **Write barrier**: doStringReplace escribía punteros sin `dirty=true`; y `initInstanceOf`
  no crea `pointers` para tamaño cero → `Array new: 0` sucio mataba el GC parcial.
- **Archivos fantasma** (`vm.files.browser.js`): filePut escribía el directorio en
  localStorage (sync) antes de saber si el contenido llegaba a IndexedDB (async, falla por
  cuota) → archivo listado pero ilegible para siempre. Y `fileGet` llama al callback de
  ÉXITO con undefined si el archivo no existe.
- **Objeto Squeak en dictionary-mode de V8**: 155 propiedades agregadas de a una lo sacan del
  fast-mode para siempre. Izadas 10 constantes en el intérprete: 9,6%. (El fromEntries global
  daría ~4% más pero con riesgo de aliasing — medido y NO aplicado.)

### Performance: REABIERTA con datos nuevos (26-ago-2026) — la línea tinyBenchmarks
- El análisis de tinyBenchmarks (perfil por escalón del send: 39% cuerpo jiteado, 20%
  activación, 16% lookup, 8% aritmética fuera de línea, 8% retorno, 6% trampolín; method
  cache 100.00% de aciertos; contextos 99.997% reciclados) localizó grasa NO cubierta por
  el cierre anterior. Aterrizado en main (commit e313639, A/B intercalado vs worktree,
  invariantes verificados): + y - inline en el jit (solo el overflow paga la llamada a
  signed32BitIntegerFor) + segundo lote de constantes izadas (getClass, canBeSmallInt,
  isMethodContext, recycleIfPossible). **sends 3.27→4.24 M/s (+29%), bytecodes 209→232
  M/s (+11%)** con carga 6-7; en máquina tranquila la base era 358 Mbc/s / 5.3 Msends/s.
- **Próxima de la lista, medida y NO implementada: sp en una local del código generado.**
  El verificador adversarial la midió transformando solo la función caliente: criba
  **+24.9% de mediana (12/12 pares a favor, rango 1.11-1.52)**, benchFib 0%, placebo
  descartado. PERO: dos intentos de hacerlo en las plantillas del jit terminaron en
  corrupción silenciosa (cascada de DNU sin excepción en el punto del bug) y V8 OOM; su
  verificador automático rechazó 768 de 2839 métodos. Es un proyecto con gating por
  método y verificador, no un parche de una tarde. Los datos: tasks/w9tsflgv3.output.
- El propio benchmark tiene ruido incorporado: el method cache instala la entrada en una
  ranura al azar (methodCacheRandomish, vm.interpreter.js:~1356) — el MISMO benchmark paga
  1-4 sondeos según la corrida y findSelectorInClass oscila 4.6-9.4% del perfil.
- La medición headless ahora es confiable: ver el commit 4ca1305 (nombre de imagen con
  .image, bomba de eventos, medir-tiny.js con invariantes). La receta completa está
  comentada en utils/arneses-node/medir-tiny.js.

### La forma directa y el DEBUGGER: probado que no lo rompe (5-sep-2026)
La pregunta natural: la forma directa guarda receptor, argumentos, temporales y pila de
operandos en LOCALES DE JAVASCRIPT, sin MethodContext — y el debugger de Smalltalk trabaja
recorriendo la cadena de contextos. ¿Sigue funcionando? **Sí, y está medido.**

La razón de fondo: nada puede *mirar* un contexto sin mandar un mensaje, y todo mensaje que
sale de código directo es una frontera que materializa la cadena entera antes de soltar el
control. Para cuando el debugger llega, la pila ya es de verdad. Además el gate rechaza de
entrada cualquier método que use `thisContext` (bytecode 0x52).

Arnés permanente: `utils/arneses-node/probar-debugger.js` + `scripts/debug-mirar.st` (mirar) y
`scripts/debug-mutar.st` (mutar/reanudar). Corre el mismo guión con `DIRECTO=0` y `DIRECTO=3`
y exige marcas `##` idénticas línea por línea; el modo clásico es el oráculo.

Resultado, Cuis 7.8:
- **281 marcas idénticas** en `debug-mirar.st`: 20 errores de 20 lugares distintos, y de cada
  frame de cada cadena se leen las tres cosas que muestra el debugger — `pc`, receptor y
  **temporales con nombre** (`tempNames` + `namedTempAt:`, que es lo que usa el panel de Cuis).
- **7 marcas idénticas** en `debug-mutar.st`: orden de `ensure:`/`ifCurtailed:` al desenrollar,
  reinicio de frame (`retry`), paso a paso (`ContextPart>>step`), y pila de OTRO proceso
  suspendido adentro de código directo.
- La prueba más dura: preemptar código directo cientos de veces con un proceso de mayor
  prioridad da `25 benchFib = 242785` exacto en los dos modos.

**Trampa que casi invalida todo**: la primera versión de la prueba usaba `do:`, `detect:ifNone:`
e `inject:into:` — y esos métodos corrían en CLÁSICO, así que la coincidencia era trivial. De ahí
salieron dos sondas nuevas en `correr-cuis.js`, obligatorias para que una prueba del modo directo
no sea vacía: `DIRECTOQUIEN=Clase>>sel,...` dice si esos métodos quedaron directos y, si no, por
qué (usa `Squeak.Directo.porQueNo`); `DIRECTOTOP=N` lista los directos más llamados.
Con eso se confirmó que la cadena probada incluye `Magnitude>>between:and:` en forma directa.

Hallazgo de paso: **`SequenceableCollection>>do:` se auto-vetó** ("deoptimizaba de más"). Compila
bien, pero llama a `aBlock value:` y un bloque nunca es directo, así que cada vuelta era una
frontera. El veto hizo exactamente su trabajo — pero explica parte del techo en Morphic.

### Primitivas reales desde código directo (5-sep-2026): anda, es correcto, y no gana
Idea de Agustín: si la primitiva ya es código compilado adentro del VM, el código directo
debería poder llamarla en vez de cruzar la frontera. Eran el **57% de las roturas de cadena**
en Morphic, así que parecía la palanca grande.

Implementado en dos diseños, los dos **trace-idénticos al clásico sobre 20.041.859 sends**
(hash 847d43b9): (A) genérico, prestándole al VM una "pila de andamio" porque `doPrimitive`
lee sus operandos de `vm.stack`; (B) "primitiva-directa", una función JS a mano que recibe
receptor y argumentos de verdad. El camino de fallo devuelve el centinela `PRIMFALLO` y el
sitio rehace el send clásico — y la sonda `PRIMFALLA=1` midió que casi no se recorre:
**71 de 93 primitivas no fallaron nunca** en 1,6M de llamadas (78,7% del total).

**El mecanismo funciona: las roturas de cadena en Morphic bajan −64%** (154.245 → 55.773).
**Pero el reloj no se mueve**: tinyBenchmarks, 5 pares intercalados con la máquina quieta,
da −0,1% en bytecodes y +0,4% en sends. Saqué dos tercios de las fronteras y no pasó nada:
la frontera no era lo que limitaba. Tercera vez en esta línea (PIC 1,5%, bloques 1,8%, esto).
Queda OPT-IN y apagado (`DIRECTOPRIM`). Para cerrarlo falta medir en el BROWSER: headless la
imagen entra en reposo y el contador de sends lo marca el reloj virtual, no la velocidad.

Tres bugs reales que salieron de la auditoría y del oráculo, todos vale la pena recordar:
(1) el hook hacía `vm.push(v)` con lo que devolviera la hoja, así que empujaba el CENTINELA a
la pila de Smalltalk — si el hook ve una hoja de primitiva es porque `tryPrimitive` ya falló;
(2) **envenenamiento del at-cache**: `makeAtCacheInfo` decide si cachea mirando
`vm.verifyAtSelector`/`verifyAtClass`, que **solo escribe `vm.send`** — desde el andamio quedan
rancios y se podía instalar una entrada con el sabor equivocado (un entero donde va un
Character, en silencio); (3) faltaba el gate de `oldPrims` (en imágenes pre-closures 238/239
son SerialPlugin).

### Performance: qué se cerró con números (NO reabrir sin datos nuevos)
- **Stack zone estilo Cog**: rechazada DOS veces. +21% en bench Node pero ~0% percibido
  (Morphic satura de closures, ~1,05M marriages; solo 1% necesita el contexto real). Techo
  medido en agosto: 3–11%, menor que el ruido. La rama `perf/stack-zone` (99 commits) queda
  archivada con `vm.stackzone.js` y `jit2.js` — jamás mergear a main (sus imports rompieron
  un deploy entero una vez: un worker ES-module con UN import 404 no carga NADA en silencio).
- **WASM memoria lineal**: empate exacto con JS monomórfico (spike
  `perf/spikes/linmem-vs-jsobj.js` en la rama perf: A_mono≈C_wasm≈63 ms vs A_mega=31373 ms).
  El único costo real era el megamorfismo, ya arreglado con sharedInstProto (+6,6%).
- **Experimentos negativos medidos** (no repetir): Map para become 5–29% peor; `new Array(n)`
  15% peor (holey); push en decodePointers 64% peor; method cache 1024→4096 = 0 CPU;
  FLATOBJ ~7% peor.
- **Línea abierta con volumen**: la carga de imagen (~1650 ms de los 3800 del boot de la
  app; decodePointers polimórfico). Y el techo general es Morphic interpretado (44% sends).

### El sitio: smalltalkjsvm.com.ar
- Online y verificado: los 5 ejemplos (Squeak, Pharo 13, Pharo app, Cuis 7.8, Cuis
  University) con 0 errores. Generado con `utils/mk-site.py` a `~/smalltalkjsvm`, deploy
  manual a Cloudflare Pages (comando en §1). Proxy CORS propio en
  cors.smalltalkjsvm.com.ar (`utils/cors-worker.js`, doble allowlist) porque files.squeak.org
  y files.pharo.org no mandan CORS. Las imágenes se bajan de los repos oficiales (no hay
  espejos, salvo zips compat de 12–17 KB).
- La Pharo app (burbujas con drag + onda expansiva) es una imagen snapshoteada que abre
  directo: `pharo/app-snapshot.st` (el machinery de `launchSnapshot:andQuit:` desarmado a
  mano). 0 avisos y 4,4s de arranque (la clave: soltar el `.sources` antes del snapshot, si
  no cada pedido de fuente corre un Full GC de 140 ms — eran 133).
- **Pendiente**: `~/smalltalkjsvm` no tiene remote — subirlo a GitHub y conectar Pages para
  auto-deploy. Wrangler quedó logueado con agustincico (el proyecto archivo-po de
  hacha.rafael va a necesitar relogin). El deploy viejo en `dialog.ar/SmalltalkJsVm/`
  (ProfeFuturo/profefuturo.github.io, copia manual) quedó congelado pre-migración: decidir
  baja o redirect.
- El repo es ahora `github.com/agustincico/SmalltalkJsVm` (renombrado; el redirect viejo
  muere si alguien crea otro repo "SqueakJS").

---

## 3. Pendientes consolidados

1. **Decisión de encendido del VectorEnginePlugin** (checklist en §1) + contestarle a Juan.
2. Subir `~/smalltalkjsvm` a GitHub + auto-deploy de Pages (hoy es deploy manual).
3. Pharo 14/15 con compat (InputEventFetcher).
4. Carga de imagen como línea de perf abierta (~1,4s del boot de Pharo).
5. File-in lento de Cuis University 1ª vez (storm de `Symbol>>=` de CodePackage, 53M sends;
   es de la imagen — ¿reportar a Cuis?).
6. Morphs de Pharo: `remnants removeAll:` lineal + `Rectangle>>=` por elemento = 27,8% del
   banco — reporte río arriba a Pharo (confirmar si se llegó a enviar).
7. Del mail de Juan quedó sin explicar su primitive failure ORIGINAL en Mac (el
   MessageNotUnderstood del ejercicio se atribuyó a error del ejercicio, verificado).
8. La VM nativa de Cuis del zip de University no arranca en esta Mac (para el multiplicador
   nativo del plugin; no bloqueante).
9. `CLAUDE.md` sigue untracked a propósito (decisión vieja: no commitearlo sin preguntar).
10. Dos http-servers de la sesión muerta siguen vivos: PID 3363 (:8091) y PID 51334 (:8095).
    Matarlos cuando no molesten (`kill 3363 51334`) o dejarlos si se están usando.

---

## 4. Reglas operativas que la sesión aprendió (costaron caro)

- **Servir siempre con `http-server -c-1`** — cachea 1 hora por default; tres traces A/B de
  Agustín fueron TODOS baseline por esto.
- **Medir presencia del resultado, no ausencia del síntoma** (`=> 7`), y ventanas ≥40–55s
  (a 16s la imagen ni arrancó). Las dos veces que se reportó algo mal fue por esto.
- **El oráculo BORRA el `.changes` que esté al lado de la imagen, y resuelve `--image`
  contra la RAÍZ DEL REPO, no contra el cwd.** Combinado: se comió
  `/Users/agustin/SqueakJS/Cuis7.8.changes` (gitignoreado, no se recupera con git) y a partir
  de ahí TODA medición copiaba un par roto, Cuis descarrilaba en el arranque y el guion nunca
  corría — con el arnés reportando tiempos plausibles de ~3,5 s que eran solo el boot. El
  síntoma que lo delata: faltan las marcas `##` y el wall es sospechosamente corto. Pasarle
  siempre RUTA ABSOLUTA a una copia propia, y tener un backup del `.changes` original (226
  bytes para Cuis 7.8).
- **Un benchmark sintético con `inject:into:`/`detect:`/`collect:` NO mide el código directo.**
  Esos mandan a un BLOQUE, y un bloque nunca es directo: se está midiendo el camino clásico.
  Me costó dos rondas de "es 8% más lento" que en realidad no medían nada de lo que creía.
  Para ejercitar código directo hacen falta bucles `to:do:` (que el compilador inlinea) o
  métodos reales de la imagen que ya salgan directos (verificar con `DIRECTOQUIEN`).
- **Una prueba de una optimización tiene que verificar que la optimización ESTABA ACTIVA en
  el código que probó.** Corolario de la trampa del 5-sep: la prueba del debugger daba
  idéntico… porque los tres métodos elegidos corrían en modo clásico. Dos modos que no se
  diferencian porque uno nunca se activó parecen exactamente iguales a dos modos correctos.
  Para el modo directo: `DIRECTOQUIEN=Clase>>sel,...` (dice sí/no y por qué no) y
  `DIRECTOTOP=N`. La misma familia que "no confiar en ticks por línea sin A/B".
- **Disco al 97–98%**: jamás full-clone de profefuturo (~415 MB) — `--depth 1
  --filter=blob:none --sparse`; borrar `isolate-*.log` de node --prof; los zips grandes se
  re-descargan, no se guardan.
- **No adjuntar traces/profiles crudos al chat** (un adjunto de 72 MB fue lo que mató esta
  sesión): dejarlos en disco y pedir que se lean con Read/Bash.
- Scripts .st por chunks: las 6 trampas están en `pharo/README.md`; detector
  `utils/check-chunks.py`. La mortal: `compile:` abre el modal de Author y cuelga en
  silencio — `Author uniqueInstance fullName:` primero.
- Al inyectar métodos en clases existentes, declarar pools/class vars en ESA clase (el
  compilador de Pharo liga nombres desconocidos a nil en silencio).
- Commitear tras cada cambio verificado (los buffers de VS Code pisaron ediciones 2 veces).
- Tokens de API jamás en el chat; wrangler guarda UNA credencial global (ojo con las dos
  cuentas Cloudflare).

---

## 5. Fuera de este repo pero de la misma época

- **`~/parallel-smalltalk`** — proyecto aparte (futures con barricada para la StackVM nativa
  de Pharo, TLABs en eden, 2–3x medido). Su `INFORME.md` es autocontenido y es 15 minutos
  MÁS NUEVO que el último commit de acá. No se toca desde este repo.
- `~/informe-estilo-smalltalkjsvm.pdf` — informe de estilo pedido por Agustín (las 37
  funciones nuevas son más chicas que la mediana original; regla adoptada: el porqué medido
  va en el código, la crónica en el commit).
- Backup del transcript completo de la sesión: `~/Downloads/8ee00768-transcript-original-BACKUP.jsonl`
  (borrable cuando este documento esté commiteado; libera 171 MB).
- Utilidades rescatadas del scratchpad efímero: `utils/arneses-node/` (correr-cuis.js con
  argv, y los arneses de mutex/prioridades que validaron la primitiva 578).
