| out s n basura |
out := StdIOWriteStream stdout.
s := Semaphore new.
n := Semaphore allInstances size.
out nextPutAll: '##ALLINST-CON-NUEVA ', n printString; newLine; flush.
basura := OrderedCollection new.
1 to: 200000 do: [ :i | basura add: (Array new: 20) ].
out nextPutAll: '##ALLOC 200k arrays ok, tam ', basura size printString; newLine; flush.
out nextPutAll: '##FIN'; newLine; flush.
Smalltalk quitPrimitive.
