"Benchmark SINTETICO y a proposito favorable: ejercita justo las primitivas de la
 lista blanca de la forma directa (Float 40/41/49/50/55, alocacion 70/71, tamano 62,
 movimiento de bytes 105). NO es un workload representativo — mide el TECHO del
 mecanismo, o sea cuanto puede dar cuando aplica. Para lo representativo, tinyBenchmarks
 y Morphic vivo."
| out t0 t1 s |
out := StdIOWriteStream stdout.
"calentar"
1 to: 20 do: [ :k | (1 to: 500) inject: 0.0 into: [ :a :b | a + b sqrt ] ].
t0 := Time localMillisecondClock.
s := 0.0.
1 to: 300 do: [ :k |
    s := s + ((1 to: 1500) inject: 0.0 into: [ :a :b | a + (b sqrt * 1.5) ]).
    (Array new: 400) size.
    (String new: 3000) replaceFrom: 1 to: 3000 with: (String new: 3000) startingAt: 1 ].
t1 := Time localMillisecondClock.
out nextPutAll: '##MS ', (t1 - t0) printString; newLine.
out nextPutAll: '##CHKF ', (s roundTo: 0.01) printString; newLine; flush.
Smalltalk quitPrimitive.
