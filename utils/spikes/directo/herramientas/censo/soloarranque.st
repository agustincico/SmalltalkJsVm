"Solo arranque: quit inmediato al procesar el script."
| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##ARRANQUE listo'; newLine; flush.
Smalltalk quitPrimitive.
