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
