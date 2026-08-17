# Reglas de traducción C → JS del VectorEnginePlugin

El destino es `plugins/VectorEnginePlugin.js`, que ya trae la capa de
compatibilidad, las 72 variables de estado y las 28 primitivas cortas. Estas
reglas gobiernan la traducción del resto (las 16 primitivas grandes y los
helpers `pvt_*`/`updateAlphas*`/`updateEdgeCountAtXy`/`updateContour*`)
para que todo quede consistente venga de la mano que venga.

## Fidelidad

- Traducir **función por función, en el orden del C**, conservando nombres de
  funciones, de variables locales y comentarios. El C es la referencia contra
  la que se diffea; no "mejorar" ni fusionar las variantes WP con las sub-pixel
  aunque se parezcan.
- El estado global ya está declarado en el archivo JS con los mismos nombres
  que los `static` del C. No declarar estado nuevo.

## Números

- `float`/`double` del C → number de JS, sin `Math.fround` (política documentada
  en el encabezado del plugin). `fabsf`/`fabs` → `Math.abs`, `sqrtf`/`sqrt` →
  `Math.sqrt`, `sinf`/`cosf` → `Math.sin`/`Math.cos`, `floorf` → `Math.floor`.
- Casts del C, al pie de la letra:
  - `(sqInt) x` sobre un float → `Math.trunc(x)` (truncamiento hacia cero, NO floor).
  - `(uint32_t) x` → `x >>> 0` si x es entero; sobre un float, `Math.trunc(x) >>> 0`.
  - `(uint8_t) x` → `x & 0xFF`.
  - `(float) x` → dejar como está (política de dobles).
- Enteros: `((usqInt) x) >> n` → `x >>> n`. `x << n` → `(x << n) >>> 0` cuando
  el resultado alimenta un uint32 (escrituras a `edgeCounts`/`alphaMask`/
  `targetBits`, comparaciones sin signo). División entera entre enteros
  (`a / b` con ambos sqInt) → `(a / b) | 0`.
- Los buffers ya son typed arrays (`Uint32Array`/`Uint8Array`/`Int32Array`/
  `Float32Array`): la escritura recorta sola, pero las LECTURAS intermedias que
  el C acumula en `sqInt`/`usqInt` deben mantener el signo del C.
- `0x7FFFFFFF` y demás literales quedan igual.

## Estructura

- `if (!(...)) { return primitiveFailFor(PrimErrBadArgument); }` →
  `{ primitiveFailFor(PrimErrBadArgument); return false; }`
- `if (!(failed())) { pop(n); } return null;` → `if (!failed()) pop(n); return !failed();`
- `methodReturnValue(x)` → igual (el shim ya existe). `return null` al final de
  un helper `void`/interno → `return` pelado.
- Punteros con aritmética (`ptr += n`, `*ptr`): traducir a índice explícito
  (`base[idx]`, `idx += n`). Si el C camina un puntero local sobre un buffer
  global, declarar `var idx` local con el desplazamiento.
- `null` de punteros → `null`. Comparaciones `ptr == null` → `=== null`.
- Los helpers se definen ASIGNANDO a las variables ya declaradas en el archivo:
  `pvt_lineFromXytoXy = function(xFrom, yFrom, xTo, yTo) { ... };`
  (así reemplazan el stub `notYetTranslated` sin tocar el registro).

## Marshalling de argumentos

Igual al de las primitivas cortas ya traducidas (mirarlas como modelo):
`stackValue`, `isIntegerObject`/`isFloatObject`/`isWords`/`isBytes`,
`stackFloatValue` sólo tras validar `isFloatObject`, buffers con
`wordsOf`/`bytesOf`/`int32Of`/`float32Of` según el tipo del puntero C
(`uint32_t*`→wordsOf, `uint8_t*`/`unsigned char*`→bytesOf, `int*`→int32Of,
`float*`→float32Of).

## Validación

Cada función traducida debe poder compararse contra el motor Smalltalk de la
imagen (misma secuencia de llamadas, mismos buffers): no introducir ningún
estado o atajo que haga la comparación imposible. El arnés vive en
`mediciones/` y compara `edgeCounts`/`alphaMask`/`contour`/`targetBits`.
