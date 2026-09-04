# Spike: forma directa + deoptimización al desenrollar

**Resultado: 15,7× en benchFib** (2692537 sends en 23 ms ≈ 115 M sends/s, contra
368 ms del VM actual). Es la validación del único camino estructural que quedaba
abierto para el hueco de sends. **No es código de producción**: es un `benchFib`
compilado A MANO. Lo que el spike prueba es que el DISEÑO funciona.

## El problema que ataca

De la tabla de Juan en `tinyBenchmarks`, Cog en un M3: 6,17 G bytecodes/s y 405 M
sends/s. Nosotros (M1, tras la mirilla): 877 M y 8,0 M. O sea 7× de brecha en
bytecodes pero **50× en sends**. Y el cociente lo dice más claro: Cog hace 15
bytecodes por send, nosotros 110 — relativo a nuestros propios bytecodes, nuestros
sends cuestan 7× más de lo que le cuestan a Cog. Eso no es física, es diseño.

El costo está en que cada send materializa un `MethodContext` (≈20 stores), guarda
y restaura registros del VM, y vuelve al trampolín para re-despachar por el switch.

## El diseño

El método compilado recibe receptor y argumentos como **argumentos reales de JS** y
devuelve con `return`. Los frames viven en la pila de JS. No se crea ningún contexto
en el caso común: lo hace la convención de llamada de V8.

La parte difícil es que Squeak puede reificar el contexto en cualquier momento
(`thisContext`, non-local return, cambio de proceso, debugger, GC) y la pila de JS
no se puede inspeccionar desde afuera. La respuesta es la de los JIT reales:
**cada frame materializa su propio `MethodContext` mientras la pila se desenrolla.**

- Señal de deopt: un centinela devuelto (no una excepción — más barato y predecible).
- Cada frame que recibe el centinela crea su contexto con su pc y su pila de
  operandos, lo encadena, y propaga el centinela.
- El desenrollado va de adentro hacia afuera, así que cada frame completa el
  `sender` del que se materializó antes.
- Abajo de todo, el frame más externo cuelga del contexto real que llamó, se hace
  `activeContext = <el más interno>`, y **el VM sigue con la maquinaria normal**:
  los contextos reconstruidos los ejecuta el jit clásico (switch), que ya sabe
  reanudar desde cualquier pc.

O sea: la forma directa y la forma clásica conviven, y la deopt es el puente.

## Por qué NO es la stack zone otra vez

La stack zone era otra *representación* del mismo trabajo: seguía materializando
frames y pasando por el trampolín, y los closures la mataban (crear un closure
obliga a reificar su contexto externo; Morphic hace 1,05 M de esos), quedando PEOR
que el modo contexts. Acá el trabajo se **elimina** en el caso común, y ante un
closure simplemente se deoptimiza ese frame: costo igual al de hoy, **nunca peor**.

## Qué está validado (y qué no)

Validado, corriendo:
- **Resultados exactos**: `5 benchFib`=15, `20`=21891, `28`=1028457, `30`=2692537.
- **La deopt se ejercita de verdad**: 368 eventos / 4321 frames materializados en
  una corrida de `28 benchFib`. En una versión intermedia con un bug de cadencia se
  ejercitó **1.048.730 veces** y el resultado siguió siendo exacto — la mejor
  prueba de estrés que podríamos haber pedido.
- **Cambios de proceso reales**: con un proceso de mayor prioridad despertando 300
  veces durante la recursión, `DIRECTO=0` y `DIRECTO=1` dan resultados idénticos
  (1028457 y 150049). La cadena de contextos reconstruida es fiel.
- **Perf**: A/B intercalado 6/6 pares, sin solaparse (base 355-418 ms, directo
  19-39 ms).

NO validado (es el trabajo que sigue):
- Un codegen general: acá `benchFib` está escrito a mano.
- Deopt disparada por otra cosa que no sea el chequeo de interrupciones
  (`thisContext`, non-local return, debugger, become:).
- Métodos con argumentos, temporales, bloques, o sends a métodos no-directos.

## Cómo correrlo

```
cd <dir con Cuis7.8.image>
DIRECTO=1 node utils/arneses-node/correr-cuis.js Cuis7.8.image -e -s fcheck.st   # correctitud
DIRECTO=1 node utils/arneses-node/correr-cuis.js Cuis7.8.image -e -s estres.st   # switches de proceso
```

## El proyecto que sigue

Un codegen que emita esta forma. Reglas de elegibilidad y de frontera:

1. **Elegible**: sin primitiva, sin bloques/closures, sin `thisContext`, sin
   non-local return. Temporales y argumentos van a locales de JS; la pila de
   operandos desaparece (compilación de expresiones); los saltos inlineados pasan a
   control de flujo real de JS.
2. **Frontera**: un frame directo sólo puede llamar a otro frame directo. Para
   cualquier otra cosa (send no-directo, primitiva, closure) hay que **deoptimizar
   la pila entera** y seguir por la maquinaria normal. Esto es correcto siempre y
   degrada a "lo de hoy + el costo de materializar", nunca peor.
3. **GC**: el GC propio de SqueakJS sólo dispara desde primitivas, que se alcanzan
   por sends — que en modo directo son punto de frontera y por lo tanto de deopt.
   Ese es el argumento de seguridad, y hay que mantenerlo invariante.
4. **Política**: desactivar la forma directa por método si deoptimiza demasiado
   seguido, para que el código que cruza la frontera todo el tiempo no pague el
   costo sin beneficio.
5. **Método de trabajo** (no negociable, el proyecto tiene historial de benchmarks
   engañosos): A/B intercalado, invariantes semánticos en cada corrida, verificador
   estructural con fallback por método, y auditoría adversarial antes de encender
   cualquier default.
