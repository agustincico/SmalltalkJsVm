"tinyBenchmarks + invariantes, para medir-tiny.js y A/B a mano.
 ##CHK: 28 benchFib debe dar 1028457 y 10 benchmark debe dar 1028 —
 si cambian, una optimizacion cambio la semantica, no la velocidad."
| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##TINY ', 1 tinyBenchmarks; newLine.
out nextPutAll: '##CHK ', 28 benchFib printString, ' ', 10 benchmark printString; newLine.
out flush.
Smalltalk quitPrimitive.
