"BATERIA: 20 errores de distinta procedencia + las operaciones que el debugger
 hace ADEMAS de mirar (reanudar, devolver un valor, reintentar, pasar al de
 afuera, ensure/ifCurtailed). Con la forma directa, cada contexto de la cadena
 se fabrica desde locales de JS; si algo estuviera mal se veria como una cadena
 distinta, un temporal cambiado, o una reanudacion que no vuelve al lugar."
| out ver caminar casos i |
out := StdIOWriteStream stdout.
ver := [ :v |
    (v isNil or: [ v isNumber or: [ v isSymbol or: [ v isString or:
        [ v isCharacter or: [ v == true or: [ v == false ] ] ] ] ] ])
        ifTrue: [ v printString size > 32
                    ifTrue: [ (v printString first: 32) , '...' ] ifFalse: [ v printString ] ]
        ifFalse: [ 'a' , v class name ] ].
caminar := [ :etiqueta :ctx0 :tope | | ctx n |
    n := 0. ctx := ctx0.
    [ ctx notNil and: [ n < tope ] ] whileTrue: [ | l |
        l := WriteStream on: String new.
        l nextPutAll: '##', etiqueta, ' '; print: n; nextPutAll: ' '; nextPutAll: ctx printString.
        l nextPutAll: ' pc='; print: ([ ctx pc ] on: Error do: [ :x | -1 ]).
        l nextPutAll: ' r='; nextPutAll: (ver value: ctx receiver).
        l nextPutAll: ' t='.
        [ | nn | nn := ctx tempNames.
          1 to: nn size do: [ :i2 |
            l nextPutAll: (nn at: i2); nextPutAll: '='.
            l nextPutAll: ([ ver value: (ctx namedTempAt: i2) ] on: Error do: [ :x | '<err>' ]);
              nextPutAll: ' ' ] ] on: Error do: [ :x | l nextPutAll: '<sn>' ].
        out nextPutAll: l contents; newLine.
        n := n + 1. ctx := ctx sender ].
    out nextPutAll: '##', etiqueta, 'T ', n printString; newLine ].

casos := OrderedCollection new.
casos add: [ 3 between: 1 and: nil ];   add: [ nil zorkA ];
     add: [ #() first ];                add: [ 1/0 ];
     add: [ Object new zorkB: 1 con: 2 ]; add: [ (Array new: 3) at: 99 ];
     add: [ Dictionary new at: #noEsta ]; add: [ (1 to: 10) detect: [ :x | x > 100 ] ];
     add: [ OrderedCollection new removeFirst ]; add: [ Set new anyOne ];
     add: [ $a zorkC ];                 add: [ Smalltalk at: #NoExisteEsto ];
     add: [ 3.5 sqrt zorkD ];           add: [ #(1 2 3) inject: nil into: [ :a :b | a + b ] ];
     add: [ 2 raisedTo: nil ];          add: [ 'abc' asNumber zorkE ];
     add: [ (1 to: 5) collect: [ :x | x zorkF ] ];
     add: [ ($a to: $e) detect: [ :c | c zorkG ] ];
     add: [ (OrderedCollection withAll: #(3 1 2)) sort: [ :a :b | a zorkH ] ];
     add: [ 100 factorial / nil ].
i := 0.
casos do: [ :blk |
    i := i + 1.
    [ blk value ] on: Error do: [ :e |
        out nextPutAll: '##CASO ', i printString, ' ', e class name; newLine.
        caminar value: 'C', i printString value: e signalerContext value: 12 ] ].

out nextPutAll: '##FIN ok'; newLine.
out flush.
Smalltalk quitPrimitive.
