| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##F5 ', 5 benchFib printString; newLine.
out nextPutAll: '##F20 ', 20 benchFib printString; newLine.
out nextPutAll: '##F28 ', 28 benchFib printString; newLine; flush.
Smalltalk quitPrimitive.
