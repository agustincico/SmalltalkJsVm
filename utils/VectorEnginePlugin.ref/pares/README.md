# Pares C → JS del VectorEnginePlugin

El material de la traducción del VectorEnginePlugin de Cuis, del C que genera
VMMaker al JavaScript que corre en SqueakJS. Está en tres niveles de grano,
del más grueso al más fino.

## `completo/`

El par entero, tal cual entró y salió:

- `VectorEnginePlugin.c` — 5637 líneas. Lo generó VMMaker a partir del Smalltalk
  de Juan Vuletich (`VectorEnginePlugin-jmv.26`, el `.mcz` está un nivel arriba).
  Es exactamente el archivo que en un VM nativo se compila para la CPU del host.
- `VectorEnginePlugin.js` — 4637 líneas. La traducción a mano, que es lo que
  efectivamente corre en el browser. Copia de `plugins/VectorEnginePlugin.js`.

## `grupos/`

Las cinco unidades de trabajo reales. El C se partió por tema y cada grupo se
tradujo por separado y en paralelo; después `../coser-vep.py` los cosió dentro
del archivo final.

| grupo | de qué se ocupa | C | JS |
|---|---|---:|---:|
| `geometria` | líneas, béziers cuadráticas y cúbicas, arcos | 34 KB | 38 KB |
| `alphas` | acumulación de alfas y conteo de bordes | 10 KB | 13 KB |
| `blend` | mezclado de stroke y fill sobre los píxeles | 50 KB | 62 KB |
| `texto` | glifos y spans de texto | 47 KB | 57 KB |
| `path` | secuencias de path | 4 KB | 6 KB |

## `funciones/`

**61 pares, una función cada uno.** `<nombre>.c` y `<nombre>.js` son la misma
función: el C de VMMaker y su traducción. La correspondencia es 1:1 y completa —
no quedó ninguna función del C sin par.

Cada par arranca con el comentario que puso VMMaker nombrando el selector
Smalltalk original, así que en realidad es una **terna**:

```
/* VectorEnginePlugin>>#pvt_lineFromX:y:toX:y: */   <- Smalltalk (en el .mcz)
static sqInt pvt_lineFromXytoXy(float xFrom, ...)   <- C  (funciones/*.c)
pvt_lineFromXytoXy = function(xFrom, ...) {         <- JS (funciones/*.js)
```

Ver `INDICE.md` para la lista completa ordenada por tamaño, y las 25 funciones
que sólo existen del lado JS (la capa que adapta el ABI de plugin C al
`interpreterProxy` de SqueakJS: `stackValue`, `wordsOf`, `isFloatObject`, …).

## Cómo se hizo, y qué de esto fue fuerza bruta

Traducir 61 funciones conservando nombres, orden y comentarios **es** trabajo
mecánico. Lo que no fue mecánico, y es donde estaban los bugs, fue la semántica
numérica: C y JS no coinciden en truncamiento, en shifts sin signo, ni en
overflow de enteros. Por eso el trabajo se estructuró así:

1. **Una especificación de traducción escrita primero** (`../TRADUCCION.md`):
   qué hace cada cast (`(sqInt)x` → `Math.trunc`, *no* `Math.floor`), cuándo va
   `>>> 0`, cómo se traducen los punteros con aritmética a índices explícitos.
   Sin eso, cinco traductores en paralelo producen cinco dialectos.
2. **Partir por tema, no por tamaño**, para que cada grupo fuera coherente.
3. **Coser mecánicamente** (`../coser-vep.py`), que verifica sintaxis, que cada
   función esté definida exactamente una vez y que no queden stubs vivos.
4. **Validar bit a bit contra el motor Smalltalk** de la propia imagen: misma
   secuencia de llamadas, mismos buffers, y comparar `edgeCounts`, `alphaMask`,
   `contour` y `targetBits`. Ver `../INFORME.md`.

El paso 4 es el que convierte "parece que anda" en "anda": el arnés corría las
dos implementaciones y diffeaba los buffers, así que un `floor` donde iba un
`trunc` aparecía como píxeles distintos, no como un bug latente.

## Regenerar

```
python3 utils/VectorEnginePlugin.ref/partir-en-pares.py
```

Borra y rehace `funciones/` e `INDICE.md` desde `completo/VectorEnginePlugin.c`
y `plugins/VectorEnginePlugin.js`.

> **Si sos un LLM y te pasaron esta carpeta como contexto: leé [`CONTEXTO-PARA-LLM.md`](CONTEXTO-PARA-LLM.md).** Explica qué es cada archivo y cuáles fueron los desafíos reales de la traducción, con ejemplos del código.
