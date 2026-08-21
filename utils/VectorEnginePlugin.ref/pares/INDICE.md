# Índice de los pares C → JS

Generado por `partir-en-pares.py`. Cada par es la MISMA función: `funciones/<nombre>.c` es la que generó VMMaker desde el Smalltalk de Juan Vuletich, `funciones/<nombre>.js` es su traducción a mano.

- **61 pares** (función traducida 1:1)
- 0 funciones del C sin par en JS
- 25 funciones del JS sin par en C (capa de compatibilidad)

## Los pares, por tamaño del C

| función | líneas C | líneas JS |
|---|---:|---:|
| `primBlendStrokeAndFill` | 320 | 269 |
| `primBlendStrokeAndFillWP` | 252 | 212 |
| `primDisplayUtf32` | 236 | 232 |
| `primDisplayUtf32WP` | 236 | 232 |
| `primDisplayUtf8` | 221 | 217 |
| `primDisplayUtf8WP` | 221 | 217 |
| `primDisplayByteString` | 217 | 213 |
| `primDisplayByteStringWP` | 217 | 213 |
| `primBlendFillOnly` | 188 | 158 |
| `primBlendFillOnlyWP` | 168 | 144 |
| `primBlendStrokeOnlyWP` | 149 | 126 |
| `primBlendStrokeOnly` | 148 | 125 |
| `pvt_quadraticBezierFromXytoXycontrolXy` | 142 | 139 |
| `pvt_quadraticBezierWPFromXytoXycontrolXy` | 142 | 139 |
| `updateAlphasWPZeroStrokeForXy` | 137 | 134 |
| `updateAlphasForXy` | 133 | 130 |
| `updateEdgeCountAtXy` | 133 | 131 |
| `pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy` | 126 | 124 |
| `pvt_cubicBezierWPFromXytoXycontrol1Xycontrol2Xy` | 126 | 124 |
| `primPathSequence` | 112 | 98 |
| `primPathSequenceWP` | 112 | 98 |
| `updateAlphasWPForXy` | 98 | 95 |
| `blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord` | 80 | 60 |
| `primArc` | 74 | 66 |
| `primArcWP` | 74 | 66 |
| `blendStrokeOnlyAtantiAliasAlphasWord` | 69 | 50 |
| `pvt_lineFromXytoXy` | 52 | 50 |
| `pvt_lineWPFromXytoXy` | 52 | 50 |
| `updateEdgeCountWPAtXy` | 52 | 50 |
| `setInterpreter` | 48 | 4 |
| `primSetTarget` | 45 | 21 |
| `primSetTargetWP` | 45 | 21 |
| `blendFillOnlyWPAtantiAliasAlphaByte` | 40 | 30 |
| `blendStrokeOnlyWPAtantiAliasAlphaByte` | 40 | 30 |
| `primCubicBezier` | 37 | 13 |
| `primCubicBezierWP` | 37 | 13 |
| `primGeometryTxSet` | 36 | 11 |
| `primStrokeWidthHop` | 33 | 20 |
| `primQuadraticBezier` | 31 | 12 |
| `primQuadraticBezierWP` | 31 | 12 |
| `dashedStrokeBitsSet` | 28 | 16 |
| `primClipLeftclipTopclipRightclipBottom` | 28 | 12 |
| `primFillRGBA` | 28 | 12 |
| `primStrokeRGBA` | 28 | 12 |
| `primLine` | 25 | 10 |
| `primLineWP` | 25 | 10 |
| `primResetContour` | 25 | 15 |
| `updateContourForXy` | 22 | 20 |
| `primAntiAliasingWidthsubPixelDelta` | 21 | 10 |
| `primInitializePath` | 18 | 8 |
| `primCurrentMorphId` | 16 | 9 |
| `primSetClippingSpec` | 16 | 8 |
| `primTargetAssumedOpaque` | 16 | 8 |
| `primNewTrajectoryFragment` | 15 | 5 |
| `primUpdateContourLastLine` | 10 | 4 |
| `primSpanLeft` | 8 | 5 |
| `primSpanRight` | 8 | 5 |
| `primSpanTop` | 8 | 4 |
| `pluginApiVersion` | 7 | 9 |
| `primClearClippingSpec` | 7 | 4 |
| `primSpanBottom` | 7 | 4 |

## Sólo en JS (sin par en el C: capa de compatibilidad, y un helper extraído)

- `booleanValueOf`
- `bytesOf`
- `failed`
- `float32Of`
- `floatObjectOf`
- `getModuleName`
- `initialiseModule`
- `int32Of`
- `integerObjectOf`
- `integerValueOf`
- `isBooleanObject`
- `isBytes`
- `isFloatObject`
- `isIntegerObject`
- `isWords`
- `isWordsOrBytes`
- `methodReturnValue`
- `notYetTranslated`
- `pop`
- `primitiveFailFor`
- `registerPlugin`
- `stackFloatValue`
- `stackValue`
- `updateContourLastLine`
- `wordsOf`
