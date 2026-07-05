# Diseño: Stack Zone con reificación perezosa de Contexts para SqueakJS

Estado: borrador v1 (2026-07-05). Basado en el concepto de "stack zone" de Cog
(OpenSmalltalk VM), rediseñado contra la semántica concreta de SqueakJS
(`vm.interpreter.js`, `vm.primitives.js`, `jit.js`) — no es una traducción del C.

## Qué ataca (datos del perfil de 2026-07-05, Cuis abriendo el class browser)

Sobre CPU activa (~12s de 23.3s grabados):

- Ciclo de vida de Context (executeNewMethod + doReturn + allocateOrRecycleContext): **14.0%**
- Dispatch de primitivos (doNamedPrimitive + doPrimitive): 7.0%
- Lookup de método (send; findMethodCacheEntry inlineado): 4.4% — la cache ya funciona,
  `lookupSelectorInDict` real midió 0.26ms/23s. NO atacar esto.
- Loop base + helpers de stack: 3.1%

El costo del Context no es la alocación (ya hay free-list: `freeContexts`/
`freeLargeContexts`) sino el protocolo completo por send/return:
`storeContextRegisters` (encode pc/sp), copia de receiver+args (`arrayCopy`),
nil-fill de temps, 4+ stores de punteros, y a la vuelta `fetchContextRegisters`
(decode), escaneo de unwind, nil de sender/ip, manejo de free-list.

## Idea central

Los Contexts existen como objetos heap **solo cuando algo los observa**. El caso
común (send → return sin que nadie capture el contexto) corre sobre **frames
planos en un stack manual** (memoria lineal WASM o Array JS), con push/pop de
~6 slots. El Context objeto se crea perezosamente ("marriage" en la jerga Cog)
solo en los puntos enumerados abajo, que son exactamente los puntos donde el
código actual de SqueakJS necesita `activeContext` como objeto.

Esto es independiente del lenguaje de implementación: funciona en JS puro
(reemplazo incremental dentro de jit.js/vm.interpreter.js) o en WASM (rewrite
del núcleo). El spike (fase 0) mide ambos para decidir.

## Layout del frame (stack crece hacia arriba; slots de 1 palabra)

```
   ... stack de operandos del caller ...
   receiver                @ fp - 1 - numArgs      ← lo pusheó el caller; NO se copia
   arg1 .. argN            @ fp - numArgs .. fp-1
   savedFp                 @ fp + 0    (fp del caller; 0 = frame base de página)
   savedPc                 @ fp + 1    (pc de reanudación del caller, entero crudo, SIN encode Squeak)
   method                  @ fp + 2    (oop/id del método del callee)
   flags                   @ fp + 3    (numArgs | isBlock<<16 | hasContext<<17)
   contextOop              @ fp + 4    (contexto casado, 0 si no hay)
   temp1 .. tempK          @ fp + 5 .. (nil-fill igual que hoy)
   ... stack de operandos del callee ...
```

- **Receiver y args no se copian**: quedan donde el caller los pusheó. Elimina el
  `arrayCopy` de executeNewMethod:1046.
- **savedPc es un int crudo**: elimina `encodeSqueakPC`/`decodeSqueakPC` del camino
  caliente. La forma "Squeak-visible" (offset por literales, 1-based) se computa
  solo al casar el frame.
- Return: `result → slot del receiver; sp := ese slot; fp := savedFp;
  method := mem[savedFp+2]; pc := savedPc`. ~5 loads/stores + 1 branch (hasContext).

## Reglas de reificación (marriage) — verificadas contra el código actual

Un frame se casa con un Context heap SOLO en:

1. **`thisContext`** — bytecode 0x89 (V3) / 0x52 (Sista) → `exportThisContext()`
   (vm.interpreter.js:1315).
2. **Creación de closure** — el closure guarda `outerContext`
   (vm.interpreter.js:850, 868, 912). Todo `[...]` casa su frame home.
   (Es también por qué hoy ponen `reclaimableContextCount = 0`.)
3. **Cambio de proceso** — `transferTo` guarda `activeContext` en
   `oldProc.suspendedContext` (vm.primitives.js:1773). Casa **solo el frame tope**;
   el resto de la cadena queda como frames vivos en la zona. El sender de un
   contexto casado se resuelve perezosamente (leerlo casa al frame caller).
4. **Evicción de página** (zona llena) → "flush": cada frame de la página víctima
   se serializa a un Context heap completo (pc/sp encodeados, temps+stack copiados,
   senders enlazados como oops). La página se libera.
5. **Acceso reflectivo** — primitivos que reciben un Context casado
   (instVarAt:, el debugger, etc.) leen/escriben "a través" al frame vivo.
   Chokepoint único en el VM; el código Smalltalk no puede saltearlo porque el
   acceso a slots de otro contexto siempre pasa por primitivos o por el VM.
6. **Unwind que entrega el contexto a Smalltalk** — `aboutToReturnThrough:` /
   `cannotReturn:` (vm.interpreter.js:1120-1132). El escaneo de unwind en sí
   (recorrer senders chequeando `isUnwindMarked`) camina frames sin reificar.

Ciclo de vida del contexto casado:
- **Casado**: objeto Context proxy; sus campos se leen/escriben vía el frame.
- **Viudo**: el frame retornó → el contexto queda muerto (pc=nil, sender=nil),
  igual que hoy hace doReturn:1103-1104.
- **Flusheado**: el frame se serializó completo al contexto (evicción o snapshot
  de imagen); el contexto pasa a ser un Context heap normal y reanudable, como
  los de hoy.

## Páginas y multiproceso

- Zona = N páginas (arranque: 64 × 8KB). Una cadena de frames de un proceso puede
  cruzar páginas: el frame base de cada página (savedFp=0) guarda el oop del
  contexto caller (casado al cruzar).
- Overflow al pushear → página nueva (evict LRU si no hay libre).
- Return desde frame base → el caller es un Context heap → "makeBaseFrame":
  inflarlo a frame en una página (camino frío; es el inverso del flush).
- `transferTo`: casar tope + guardar en suspendedContext. Al reanudar un proceso
  cuyo contexto casado todavía tiene frame vivo en la zona → cambiar fp/sp/pc y
  listo (cambio de proceso casi gratis, las páginas no se tocan).
- Snapshot de imagen: flush total de la zona (igual que Cog).

## Chequeo de interrupciones

Idéntico a hoy: `interruptCheckCounter` con feedback (vm.interpreter.js:674-726),
decrementado por send y por salto hacia atrás. `checkForInterrupts` solo necesita
contexto objeto si va a cambiar de proceso → regla 3.

## Qué NO cambia

- Formato de objetos (Spur / pre-Spur), imagen, GC del heap de objetos.
- Cache de métodos global (ya rinde: 0.26ms de lookup real en 23s).
- Semántica observable: mismos Contexts vistos desde Smalltalk (debugger,
  excepciones, `ensure:`, procesos), solo que materializados a demanda.

## Fases

- **Fase 0 (spike, hoy)**: fib sintético sobre la maquinaria de frames, 5 variantes
  (ver bench2). Decide: ¿el algoritmo gana en JS? ¿WASM suma sobre eso?
- **Fase 1**: según fase 0 —
  (a) si JS+frames gana fuerte: integrarlo en SqueakJS real (jit.js genera código
  que opera sobre frames; vm.interpreter.js mantiene el camino Context como
  fallback/oracle). Incremental, sin WASM.
  (b) si WASM suma claramente: intérprete WASM sobre heap Spur en memoria lineal;
  todo-o-nada por sesión, validado contra el VM JS como oráculo con imágenes de test.
- **Fase 2 (solo si fase 1 = WASM)**: "Cogit-para-WASM" — generar módulos WASM
  por método en runtime (JS puede compilar/instanciar bytes WASM al vuelo,
  compartiendo memoria y funcref table). Elimina el costo de dispatch de bytecodes
  que el intérprete WASM reintroduce (hoy jit.js ya lo elimina en JS — un
  intérprete WASM fase-1 parte con esa desventaja; medir).

## Riesgos principales

- Read-through de contextos casados: un acceso que no pase por el chokepoint =
  bug silencioso. Mitigación: build con aserciones + suite SUnit de tests/ como
  oráculo diferencial.
- El intérprete WASM reintroduce dispatch por bytecode que jit.js ya había
  eliminado — la fase 1(b) puede perder en código numérico aunque gane en sends.
  Por eso el spike mide dispatch por separado (V2 vs V3).
- Empezar solo con Spur 32-bit (cuis.image); pre-Spur y 64-bit después.
