| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##HOLA'; newLine; flush.
Smalltalk quitPrimitive.
