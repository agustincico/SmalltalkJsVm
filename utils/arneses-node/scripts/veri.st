"Bordes de la aritmetica de SmallInteger (rango 31 bits: -1073741824..1073741823).
 Cubre el camino inline de + y - del jit y el desborde a LargeInteger,
 y los bordes del sp-en-local (comparaciones, negativos, bitOps)."
| out casos fallas |
out := StdIOWriteStream stdout.
casos := OrderedCollection new.
casos add: [ (1073741823 + 1) = 1073741824 ].                 "MaxSmallInt+1 -> Large"
casos add: [ (1073741823 + 1) class == LargePositiveInteger ].
casos add: [ (-1073741824 - 1) = -1073741825 ].               "MinSmallInt-1 -> Large"
casos add: [ (-1073741824 - 1) class == LargeNegativeInteger ].
casos add: [ (1073741824 - 1) class == SmallInteger ].        "vuelta al rango"
casos add: [ (1073741823 + 1073741823) = 2147483646 ].        "suma de dos maximos"
casos add: [ (-1073741824 + -1073741824) = -2147483648 ].
casos add: [ (0 - -1073741824) = 1073741824 ].                "resta que desborda"
casos add: [ (1073741823 < 1073741824) and: [ -1073741825 < -1073741824 ] ].
casos add: [ ((2 raisedTo: 40) - (2 raisedTo: 40)) = 0 ].     "Larges puros"
fallas := 0.
casos withIndexDo: [ :c :i |
    c value ifFalse: [ fallas := fallas + 1.
        out nextPutAll: '##VERI FALLA caso ', i printString; newLine ]].
fallas = 0 ifTrue: [ out nextPutAll: '##VERI TODO OK (', casos size printString, ' casos de borde)'; newLine ].
out flush.
Smalltalk quitPrimitive.
