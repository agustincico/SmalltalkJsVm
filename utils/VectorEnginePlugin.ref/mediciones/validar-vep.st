"Arnés de validación por operación: dibuja la misma escena con el motor Smalltalk
 y con el motor de plugin, sobre dos Forms iguales, y compara los bits.
 Con el plugin incompleto las operaciones no traducidas fallan: el arnés lo
 reporta como 'PRIMITIVA FALLO' en vez de comparar."
| lineas escribir escenas comparar |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'validacion.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
escenas := OrderedCollection new.
escenas add: { 'linea diagonal'. [ :e | e moveTo: 20.0@20.0; lineTo: 180.0@160.0 ] }.
escenas add: { 'rectangulo relleno'. [ :e | e moveTo: 40.0@40.0; lineTo: 160.0@40.0; lineTo: 160.0@120.0; lineTo: 40.0@120.0; lineTo: 40.0@40.0 ] }.
escenas add: { 'bezier cuadratica'. [ :e | e moveTo: 20.0@100.0; quadraticBezierTo: 180.0@100.0 control: 100.0@20.0 ] }.
escenas add: { 'bezier cubica'. [ :e | e moveTo: 20.0@150.0; cubicBezierTo: 180.0@150.0 control1: 60.0@20.0 control2: 140.0@180.0 ] }.
escenas add: { 'arco'. [ :e | e arcCenter: 100.0@100.0 radius: 70.0@50.0 rotationAngle: -0.2 start: 0.0 sweep: Float twoPi ] }.
comparar := [ :nombre :bloque |
	| f1 f2 dif maxd b1 b2 |
	f1 := Form extent: 200@200 depth: 32.
	f2 := Form extent: 200@200 depth: 32.
	f1 fillColor: Color white. f2 fillColor: Color white.
	[ ((Smalltalk at: #VectorEngineSubPixel) onForm: f1 subPixelAntiAliasing: true)
		strokeWidth: 3.0 color: Color black fillColor: Color red do: bloque ]
		on: Error do: [ :e2 | lineas add: nombre, ': ERROR motor Smalltalk: ', e2 messageText printString ].
	[ ((Smalltalk at: #VectorEngineWithPluginSubPixel) onForm: f2 subPixelAntiAliasing: true)
		strokeWidth: 3.0 color: Color black fillColor: Color red do: bloque.
	  b1 := f1 bits. b2 := f2 bits.
	  dif := 0. maxd := 0.
	  1 to: b1 size do: [ :i |
		(b1 at: i) = (b2 at: i) ifFalse: [
			| p1 p2 d |
			dif := dif + 1.
			p1 := b1 at: i. p2 := b2 at: i.
			0 to: 24 by: 8 do: [ :sh |
				d := (((p1 bitShift: sh negated) bitAnd: 255) - ((p2 bitShift: sh negated) bitAnd: 255)) abs.
				d > maxd ifTrue: [ maxd := d ] ] ] ].
	  lineas add: nombre, ': ', dif printString, ' pixeles distintos de ', b1 size printString, ', delta maximo por canal ', maxd printString ]
		on: Error do: [ :e2 | lineas add: nombre, ': PRIMITIVA FALLO (', e2 class name, ': ', e2 messageText printString, ')' ].
	escribir value ].
[ [
	lineas add: 'plugin disponible: ', (Smalltalk at: #VectorEngineWithPlugin) isPluginAvailable printString.
	escribir value.
	escenas do: [ :par | comparar value: (par at: 1) value: (par at: 2) ].
	lineas add: 'fin'. escribir value
  ] on: Warning do: [ :wa | wa resume: true ] ]
	on: Error do: [ :e | lineas add: 'ERROR GENERAL: ', e class name, ' / ', (e messageText ifNil: ['sin texto']). lineas add: 'fin'. escribir value ]
