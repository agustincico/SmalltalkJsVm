| out x y n |
out := StdIOWriteStream stdout.
Smalltalk garbageCollect.
out nextPutAll: '##GC-FULL ok'; newLine; flush.
Smalltalk garbageCollectMost.
out nextPutAll: '##GC-PARCIAL ok'; newLine; flush.
x := Array with: 1 with: 2.
y := Array with: 3 with: 4.
x become: y.
out nextPutAll: '##BECOME ', x printString; newLine; flush.
n := Semaphore allInstances size.
out nextPutAll: '##ALLINST ', n printString; newLine; flush.
n := 0.
Semaphore allInstancesDo: [ :s | n := n + 1 ].
out nextPutAll: '##ALLINSTDO ', n printString; newLine; flush.
out nextPutAll: '##FIN'; newLine; flush.
Smalltalk quitPrimitive.
