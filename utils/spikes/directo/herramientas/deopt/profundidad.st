| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##D3000 ', 3000 benchFib printString; newLine; flush.
out nextPutAll: '##D5500 ', 5500 benchFib printString; newLine; flush.
out nextPutAll: '##D6000 ', 6000 benchFib printString; newLine; flush.
out nextPutAll: '##D6100 ', 6100 benchFib printString; newLine; flush.
out nextPutAll: '##D6200 ', 6200 benchFib printString; newLine; flush.
out nextPutAll: '##D8000 ', 8000 benchFib printString; newLine; flush.
out nextPutAll: '##D100000 ', 100000 benchFib printString; newLine; flush.
out nextPutAll: '##FIN'; newLine; flush.
Smalltalk quitPrimitive.
