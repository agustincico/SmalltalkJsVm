"Barrido de correccion sobre las primitivas de enteros grandes y la aritmetica mixta.
Es dialecto-neutro y NO compila metodos: todo va en doits, para no despertar el dialogo
de autor de Pharo. Cualquier variante del VM tiene que producir un bench.txt identico."!

Smalltalk at: #SqjR put: OrderedCollection new!

[ | a b c d big neg r add |
  add := [ :k :v | (Smalltalk at: #SqjR) add: k , '=' , v printString ].
  a := 123456789012345678901234567890123456789012345678901234567890.
  b := 98765432109876543210987654321.
  c := 2 raisedTo: 200.
  d := 3 raisedTo: 131.
  big := 2000 factorial.
  neg := a negated.
  add value: 'a' value: a.
  add value: 'aPlusB' value: a + b.
  add value: 'aMinusB' value: a - b.
  add value: 'bMinusA' value: b - a.
  add value: 'aTimesB' value: a * b.
  add value: 'aDivB' value: a // b.
  add value: 'aModB' value: a \\ b.
  add value: 'aRemB' value: (a rem: b).
  add value: 'aQuoB' value: (a quo: b).
  add value: 'negDivB' value: neg // b.
  add value: 'negModB' value: neg \\ b.
  add value: 'negRemB' value: (neg rem: b).
  add value: 'negQuoB' value: (neg quo: b).
  add value: 'cTimesD' value: c * d.
  add value: 'cPlusD' value: c + d.
  add value: 'cDivD' value: c // d.
  add value: 'bitAnd' value: (a bitAnd: b).
  add value: 'bitOr' value: (a bitOr: b).
  add value: 'bitXor' value: (a bitXor: b).
  add value: 'shiftL' value: (a bitShift: 61).
  add value: 'shiftR' value: (a bitShift: -61).
  add value: 'gcd' value: (a gcd: b).
  add value: 'sqrtFloor' value: a sqrtFloor.
  add value: 'bigDigits' value: big printString size.
  add value: 'bigMod' value: big \\ 1000000007.
  add value: 'bigDiv' value: (big // (10 raisedTo: 5000)) printString size.
  add value: 'cmpLT' value: (a < b).
  add value: 'cmpGT' value: (a > b).
  add value: 'cmpEQ' value: (a = a).
  add value: 'cmpNE' value: (a ~= b).
  add value: 'cmpLE' value: (b <= a).
  add value: 'cmpGE' value: (b >= a).
  "bordes de SmallInteger"
  add value: 'maxSmall' value: 1073741823 + 1.
  add value: 'minSmall' value: -1073741824 - 1.
  add value: 'maxSmall64' value: 4611686018427387903 + 1.
  add value: 'wrapMul' value: 1073741823 * 1073741823.
  "mezcla entero/float, que es el camino que toca el JIT"
  add value: 'intPlusFloat' value: 3 + 0.5.
  add value: 'floatPlusInt' value: 0.5 + 3.
  add value: 'intMinusFloat' value: 3 - 0.5.
  add value: 'floatTimesInt' value: 0.5 * 4.
  add value: 'intLtFloat' value: (3 < 3.5).
  add value: 'floatGeInt' value: (614.0 >= 0).
  add value: 'intEqFloat' value: (3 = 3.0).
  add value: 'floatNeInt' value: (3.0 ~= 4).
  add value: 'clsIntPlusFloat' value: (3 + 0.5) class name.
  add value: 'clsFloatPlusInt' value: (0.5 + 3) class name.
  "igualdad de ByteArray, que es la primitiva 156"
  add value: 'baEq' value: (#[1 2 3] = #[1 2 3]).
  add value: 'baNe' value: (#[1 2 3] = #[1 2 4]).
  "comparacion de strings, que es la primitiva 158"
  add value: 'strCmp1' value: ('abc' compare: 'abd').
  add value: 'strCmp2' value: ('abc' compare: 'abc').
  add value: 'strCmp3' value: ('abd' compare: 'abc') ]
    on: Error do: [ :e | (Smalltalk at: #SqjR) add: 'ERROR ' , e messageText printString ]!

[ | txt |
  txt := String streamContents: [ :st |
    (Smalltalk at: #SqjR) do: [ :each | st nextPutAll: each; nextPut: (Character value: 10) ] ].
  [ | s | s := 'bench.txt' asFileReference writeStream. s nextPutAll: txt; flush; close ]
    on: Error
    do: [ [ | s | s := (Smalltalk at: #FileStream ifAbsent: [ nil ]) fileNamed: 'bench.txt'.
            s nextPutAll: txt; close ] on: Error do: [ :e2 | nil ] ]
] on: Error do: [ :e | ]!
