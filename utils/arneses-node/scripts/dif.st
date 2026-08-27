"Diferencial de semantica: checksum determinista sobre colecciones, streams,
 sort, printString, bloques, excepciones, non-local return, ensure, floats,
 LargeInts. Correr con y sin la optimizacion a comparar: mismo ##DIF o rompio."
| out suma |
out := StdIOWriteStream stdout.
suma := 0.
1 to: 200 do: [ :i | suma := suma + (i * i // 3) ].
suma := suma + ((1 to: 500) asOrderedCollection inject: 0 into: [ :a :b | a + b ]).
suma := suma + ((1 to: 100) collect: [ :i | i printString size ]) sum.
suma := suma + ((500 to: 1 by: -1) asArray sort: [ :a :b | a < b ]) first.
suma := suma + ([ :x | x = 7 ifTrue: [ ^out nextPutAll: '##NUNCA'; flush ] ifFalse: [ x * 2 ] ] value: 9).
suma := suma + ([ 55 ] ensure: [ suma := suma + 1 ]) .
suma := suma + ([ 1/0 ] on: ZeroDivide do: [ :e | 77 ]).
suma := suma + (Dictionary new at: #x put: 3; at: #x) .
suma := suma + ('hola mundo' reversed asSymbol size).
suma := suma + (3.25 + 1.75) truncated.
suma := suma + (2 raisedTo: 80) printString size.
out nextPutAll: '##DIF ', suma printString; newLine; flush.
Smalltalk quitPrimitive.
