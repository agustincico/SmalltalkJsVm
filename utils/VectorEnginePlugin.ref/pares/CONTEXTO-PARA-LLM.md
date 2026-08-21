# Contexto: los pares C → JS del VectorEnginePlugin

Documento pensado para que lo lea un modelo de lenguaje que vaya a usar estos
pares, como referencia para traducir código o como material de ejemplo. Explica
qué es cada archivo, de dónde viene, y —lo importante— **cuáles fueron los
desafíos reales**, que no son los que uno esperaría.

Todo lo afirmado acá está verificado contra los archivos de esta carpeta. Los
conteos son reproducibles con `grep` sobre `funciones/`.

---

## 1. Qué son estos archivos

Una cadena de tres representaciones del **mismo** programa: el rasterizador de
gráficos vectoriales de Cuis Smalltalk, escrito por Juan Vuletich.

```
Smalltalk  (VectorEnginePlugin-jmv.26.mcz, un nivel arriba)
    ↓  lo traduce VMMaker, automáticamente
C          (completo/VectorEnginePlugin.c — 5637 líneas)
    ↓  lo tradujo un humano+LLM, a mano, función por función
JavaScript (completo/VectorEnginePlugin.js — 4637 líneas)
```

El eslabón C→JS es el que documentan estos pares. Existe porque **SqueakJS es
una VM escrita en JavaScript: no tiene código nativo**. En una VM normal, ese
`.c` se compila para la CPU del host y se carga como binario. En el browser eso
no es posible, así que el mismo C se transcribió a JS.

### Los tres granos

| carpeta | qué contiene | para qué sirve |
|---|---|---|
| `completo/` | el par entero, 1 `.c` + 1 `.js` | ver el resultado global, diffear |
| `grupos/` | 5 pares temáticos | las unidades de trabajo reales |
| `funciones/` | **61 pares, una función cada uno** | ejemplos atómicos alineados |

### Cómo leer un par de `funciones/`

`<nombre>.c` y `<nombre>.js` son la misma función. Ambos empiezan con el
comentario que VMMaker dejó nombrando el **selector Smalltalk original**, así
que cada par es en realidad una terna:

```c
/* VectorEnginePlugin>>#pvt_lineFromX:y:toX:y: */     ← Smalltalk
static sqInt
pvt_lineFromXytoXy(float xFrom, float yFrom, ...)     ← C
```
```js
/* VectorEnginePlugin>>#pvt_lineFromX:y:toX:y: */
pvt_lineFromXytoXy = function(xFrom, yFrom, ...) {    ← JS
```

La correspondencia es **1:1 y completa: no quedó ninguna función del C sin
traducir** (61 en C, 61 en JS). Las 25 funciones que sólo existen del lado JS
son la capa de compatibilidad (`stackValue`, `wordsOf`, `isFloatObject`, …) que
adapta el ABI de plugin de C al `interpreterProxy` de SqueakJS, más un helper
extraído (ver §6).

---

## 2. El desafío que NO fue el problema

Conviene decirlo primero, porque es contraintuitivo: **el volumen no fue el
problema**. Traducir 5076 líneas de C a 4339 de JS conservando nombres de
función, nombres de variables locales, orden y comentarios es trabajo mecánico.
Un modelo lo hace bien y rápido.

El problema es que el código *parece* traducirse trivialmente y no es cierto.
C y JavaScript tienen sintaxis casi idéntica para aritmética y semántica
distinta. Un error de traducción no rompe nada: compila, corre, y devuelve
píxeles apenas distintos. Es el peor tipo de bug.

Los cuatro desafíos reales, entonces, son todos semánticos.

---

## 3. Desafío 1: en JavaScript los operadores de bits dan enteros CON signo

`&`, `|`, `^`, `<<` y `>>` en JS convierten sus operandos a **int32 con signo**.
En C, sobre `uint32_t`/`usqInt`, son sin signo. Cualquier valor con el bit 31
prendido —o sea, cualquier píxel ARGB con alfa alto, que son casi todos— sale
negativo en JS. Y como después se multiplica por un float, el resultado es
silenciosamente incorrecto.

La regla es: cada vez que un valor de 32 bits tiene que interpretarse sin signo,
va `>>> 0` (o `>>>` en lugar de `>>` para los shifts). En estos pares hay
**60 usos de `>>> 0`**.

Ejemplo real, la cola de `blendStrokeOnlyWPAtantiAliasAlphaByte`. Es el mejor
ejemplo del repositorio porque muestra **cuatro trampas distintas en ocho
líneas**:

```c
/* C */
targetAlphaBits = targetWord & 0xFF000000U;
...
resultR = (alpha * strokeR) + ((unAlpha * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlpha * 0xFF) + 0.5)))) << 24)));
targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
```
```js
/* JS */
targetAlphaBits = (targetWord & 0xFF000000) >>> 0;      // (1) el AND da negativo
...
resultR = (alpha * strokeR) + ((unAlpha * (resultRBits >>> 16)) * targetAlpha);  // (2) shift sin signo
resultAlphaBits = (Math.trunc((resultAlpha * 0xFF) + 0.5) << 24) >>> 0;          // (3) el shift a bit 31
targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;  // (4) el OR final
```

1. `targetWord & 0xFF000000` da negativo en JS; sin el `>>> 0`, `targetAlpha`
   sale negativo y todo el mezclado se va al demonio.
2. `((usqInt)x) >> 16` es un shift lógico: `>>>`, no `>>`.
3. `<< 24` sobre un byte de alfa prende el bit 31 → negativo.
4. El `|` de cuatro trozos vuelve a dar signo aunque cada trozo esté bien.

Un traductor que "simplifique" cualquiera de estos cuatro `>>> 0` produce código
que funciona para los píxeles oscuros y falla para los claros.

---

## 4. Desafío 2: `(sqInt)` trunca hacia cero, no hacia abajo

El cast `(sqInt)x` de C sobre un float **trunca hacia cero**. `Math.floor`
redondea hacia `-∞`. Para valores positivos son idénticos; para negativos
difieren en 1. Y en un rasterizador las coordenadas **sí** son negativas: todo
lo que cae arriba o a la izquierda del área de recorte.

Por eso la regla es `(sqInt)x` → `Math.trunc(x)`, nunca `Math.floor`. Verificable
en los pares: **135 casts `(sqInt)` en el C, 125 `Math.trunc` en el JS, y cero
`Math.floor`** (la diferencia son casts sobre expresiones ya enteras, donde
truncar es no-op y se omitió). El C original tampoco usa `floorf` ni una vez.

El caso donde importa, en `updateEdgeCountAtXy` — y notar que el C **trae un
comentario avisando** que la semántica de truncado es parte del contrato con el
Smalltalk:

```c
/* truncated, both in C and Smalltalk */
thisYTruncated = ((sqInt)y);
```
```js
/* truncated, both in C and Smalltalk */
thisYTruncated = Math.trunc(y);
```

---

## 5. Desafío 3: el tipo del puntero se pierde en el camino

En C, el tipo vive en la **declaración de la variable local**, y el compilador
lo propaga. La misma llamada `firstIndexableField(...)` devuelve algo distinto
según a qué variable se asigne:

```c
float *contourData;          /* la declaración es la que decide */
int   *contourDataIndexes;
...
contourData        = firstIndexableField(stackValue(1));
contourDataIndexes = firstIndexableField(stackValue(0));
```

En JS no hay declaración con tipo, así que esa información **hay que recuperarla
y moverla al sitio de la llamada**:

```js
contourData        = float32Of(stackValue(1));
contourDataIndexes = int32Of(stackValue(0));
```

El mapeo es `uint32_t*`→`wordsOf`, `uint8_t*`/`unsigned char*`→`bytesOf`,
`int*`→`int32Of`, `float*`→`float32Of`. Equivocarse no da error: se leen los
mismos bytes con la interpretación equivocada y salen números absurdos.

Sutileza que hace que esto funcione: en SqueakJS los datos indexables viven en
`.words` (un `Uint32Array`), y `wordsAsFloat32Array()` devuelve
`new Float32Array(this.words.buffer)` — una **vista sobre el mismo buffer**, no
una copia, y memoizada. Por eso escribir por cualquiera de las dos vistas se ve
desde la otra, igual que el aliasing de punteros en C. Si fuese una copia, todas
las escrituras se perderían en silencio.

---

## 6. Desafío 4: las familias casi-duplicadas que NO hay que fusionar

**20 de las 61 funciones son variantes `WP`** (`primArc`/`primArcWP`,
`primBlendStrokeOnly`/`primBlendStrokeOnlyWP`, …). Son casi idénticas: difieren
en que una trabaja con alfas sub-pixel empaquetados en una palabra y la otra con
un byte de alfa por píxel.

La tentación de un traductor —humano o modelo— es unificarlas en una función
parametrizada. **Es un error**, por dos razones. Primero, las diferencias son
justamente las líneas delicadas de aritmética de bits, que es donde estarían los
bugs. Segundo, y más importante: el criterio de validación es *diffear el JS
contra el C función por función*. Una función fusionada ya no tiene contra qué
diffearse, y se pierde la única red de seguridad que hay.

La regla explícita en `../TRADUCCION.md` es: *"no 'mejorar' ni fusionar las
variantes WP con las sub-pixel aunque se parezcan"*.

**Única desviación estructural en todo el port**, y conviene conocerla: el JS
extrajo el cuerpo de `primUpdateContourLastLine` a un helper
`updateContourLastLine` (que en el C no existe como función; el nombre viene del
selector Smalltalk). Semántica idéntica, un solo llamador. Es la excepción que
confirma la regla.

---

## 7. La decisión de criterio: qué se traduce bit a bit y qué no

Esto no es una regla mecánica sino un juicio, y es la parte más interesante del
port. Del encabezado de `completo/VectorEnginePlugin.js`:

> C float state is kept as JS doubles — the Smalltalk engine computes in 64-bit
> floats too, so doubles keep us inside the difference band Cuis already accepts
> between native plugin and Smalltalk engine. Integer pixel work (edgeCounts /
> alphaMask packing, blending) is translated bit-exactly with `>>>`, `&` and `|0`.

O sea, **dos políticas distintas dentro del mismo archivo**:

- **Los floats NO son bit-exactos, a propósito.** El C usa `float` de 32 bits;
  JS sólo tiene doubles de 64. Se podría forzar con `Math.fround` en cada
  operación, y se decidió no hacerlo: el motor Smalltalk de Cuis también calcula
  en 64 bits, así que los doubles caen *dentro* de la banda de diferencia que
  Cuis ya tolera entre su plugin nativo y su motor Smalltalk. Forzar `fround`
  habría acercado el JS al C nativo alejándolo del Smalltalk, que es el oráculo.
- **Los enteros SÍ son bit-exactos.** Todo el empaquetado de píxeles, conteo de
  bordes y máscaras de alfa se traduce exactamente, con `>>>`, `&` y `|0`.

La lección general: *"traducir fielmente" no es una sola cosa*. Hay que elegir
contra qué implementación se define la fidelidad. Acá el oráculo no era el C
sino el Smalltalk, y eso cambió la decisión.

---

## 8. El método, y por qué importa el orden

1. **Primero se escribió la especificación de traducción** (`../TRADUCCION.md`),
   antes de traducir una sola línea: qué hace cada cast, cuándo va `>>> 0`, cómo
   se eligen los accesores de buffer, qué formas de definir funciones valen.
   Sin eso, cinco traductores en paralelo devuelven cinco dialectos y el
   resultado no es diffeable ni mantenible.
2. **Partir por tema, no por tamaño**: `geometria`, `alphas`, `blend`, `texto`,
   `path`. Cada grupo es coherente y se tradujo en paralelo.
3. **Coser mecánicamente** (`../coser-vep.py`), con verificación automática:
   sintaxis (`node --check`), cada función definida exactamente una vez, y
   ningún stub `notYetTranslated` vivo.
4. **Validación diferencial contra el oráculo**: correr la misma secuencia de
   llamadas contra el motor Smalltalk *de la misma imagen* y comparar los
   buffers `edgeCounts`, `alphaMask`, `contour` y `targetBits`. Ver
   `../INFORME.md`.

El paso 4 es el que convierte "parece que anda" en "anda". Sin diff de buffers,
un `floor` donde iba un `trunc` es indetectable hasta que alguien mira un borde
con lupa seis meses después.

### Restricción arquitectónica que forzó todo esto

La imagen decide si usa el plugin con **una sola pregunta**: si la primitiva
`pluginApiVersion` contesta exactamente `7`. **No hay fallback por primitiva.**
Si contesta 7 y una sola primitiva falta o está mal, el renderizado se rompe
entero en vez de degradarse.

Por eso el port no se podía publicar por partes. Se shippeó inerte, con una
guarda (`COMPLETE = false` más un flag `Squeak.enableVectorEnginePlugin` para el
arnés de pruebas), y recién se encendió cuando las 61 funciones estaban
traducidas y validadas. Si tu traducción tiene una puerta todo-o-nada parecida,
esta es la estructura a copiar: traducir con stubs que fallan, validar, encender.

---

## 9. Resumen para un traductor automático

Si vas a traducir C generado por VMMaker (o C de bajo nivel en general) a
JavaScript, en orden de cuánto daño hacen:

1. Todo operador de bits en JS da **int32 con signo** → `>>> 0` donde el C usa
   `uint32_t`; `>>>` en lugar de `>>` cuando el C castea a `usqInt`.
2. `(int)float` **trunca hacia cero** → `Math.trunc`, *nunca* `Math.floor`.
3. El **tipo del puntero** está en la declaración del C y hay que moverlo al
   sitio de la llamada en JS; verificá que la vista tipada comparta el buffer y
   no lo copie.
4. **No fusiones** funciones parecidas: perdés la capacidad de diffear contra el
   original, que es la única validación real que vas a tener.
5. Decidí explícitamente **contra qué implementación** definís la fidelidad
   antes de empezar, y escribilo. Puede no ser el C.
6. Conservá nombres, orden y comentarios. No es prolijidad: es lo que hace
   posible el diff.

### Datos verificables

| | |
|---|---|
| pares 1:1 | 61 |
| funciones del C sin traducir | 0 |
| funciones sólo en JS (shim + 1 helper) | 25 |
| líneas (61 funciones) | 5076 C → 4339 JS |
| variantes `WP` | 20 de 61 |
| `(sqInt)` en C / `Math.trunc` en JS / `Math.floor` en JS | 135 / 125 / 0 |
| usos de `>>> 0` en JS | 60 |
