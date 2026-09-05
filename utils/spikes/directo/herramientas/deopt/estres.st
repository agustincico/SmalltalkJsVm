"Estres del deopt: un proceso de MAYOR prioridad se despierta 300 veces durante la
 recursion directa. Cada despertar fuerza materializar la pila de JS como contextos
 y reanudarla despues del cambio de proceso. Si la cadena reconstruida no fuera fiel,
 el resultado cambiaria o la reanudacion se rompería."
| out r |
out := StdIOWriteStream stdout.
[ 1 to: 300 do: [ :i | (Delay forMilliseconds: 2) wait ] ] forkAt: Processor userInterruptPriority.
r := 28 benchFib.
out nextPutAll: '##ESTRES ', r printString; newLine; flush.
out nextPutAll: '##ESTRES2 ', 24 benchFib printString; newLine; flush.
Smalltalk quitPrimitive.
