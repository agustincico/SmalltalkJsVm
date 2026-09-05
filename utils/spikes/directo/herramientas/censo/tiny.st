"tinyBenchmarks completo + invariantes (mismo script que utils/arneses-node/scripts/tiny.st)"
| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##TINY ', 1 tinyBenchmarks; newLine.
out nextPutAll: '##CHK ', 28 benchFib printString, ' ', 10 benchmark printString; newLine.
out flush.
Smalltalk quitPrimitive.
