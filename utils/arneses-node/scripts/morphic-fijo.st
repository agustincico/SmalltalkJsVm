"Trabajo FIJO de Morphic, cronometrado DESDE ADENTRO de la imagen (##MS), para
 medir la forma directa sin que el tiempo de carga de la imagen tape la señal.
 Ejercita justamente lo que domina las fronteras en Morphic: dibujo vectorial y
 tipografía (primitivas de Float y FloatArray 238/239/40), alocación (70/71) y
 movimiento de bytes (105)."
| out w t0 t1 |
out := StdIOWriteStream stdout.
w := UISupervisor ui.
(SystemWindow new) openInWorld.
"calentar: que el jit y la forma directa compilen antes de cronometrar"
1 to: 12 do: [ :i | w ifNotNil: [ w displayWorld ] ].
t0 := Time localMillisecondClock.
1 to: 80 do: [ :i |
    w ifNotNil: [ w displayWorld ].
    (String new: 2000) replaceFrom: 1 to: 2000 with: (String new: 2000) startingAt: 1.
    (1 to: 300) inject: 0.0 into: [ :a :b | a + (b sqrt) ] ].
t1 := Time localMillisecondClock.
out nextPutAll: '##MS ', (t1 - t0) printString; newLine; flush.
Smalltalk quitPrimitive.
