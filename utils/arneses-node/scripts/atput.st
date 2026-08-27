"Reproductor del bug del template de at:put: del jit (c sin asignar en el else):
 String at:put: en un bucle caliente. Sin el arreglo, la VM muere con
 TypeError ... sqClass; con el arreglo, ##ATPUT OK."
| out s r |
out := StdIOWriteStream stdout.
s := String new: 64.
1 to: 20000 do: [ :k |
    1 to: 64 do: [ :i |
        r := s at: i put: (Character value: 97 + (i + k \\ 26)) ]].
(s first = s first) ifTrue: [
    out nextPutAll: '##ATPUT OK ', s first asString, ' ', (r == $a or: [r isCharacter]) printString; newLine ].
out flush.
Smalltalk quitPrimitive.
