"Morphic vivo: abrir un Browser y dejar el mundo bombeando (PULSO=1) un rato."
| out |
out := StdIOWriteStream stdout.
out nextPutAll: '##ABRO browser'; newLine; flush.
Browser open.
out nextPutAll: '##ABIERTO'; newLine; flush.
(Delay forSeconds: 20) wait.
out nextPutAll: '##FIN morphic'; newLine; flush.
Smalltalk quitPrimitive.
