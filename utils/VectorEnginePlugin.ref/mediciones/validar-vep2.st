"Arnés extendido: texto TrueType, whole-pixel, punteado y clipping,
 comparando motor Smalltalk vs plugin bit a bit."
| lineas escribir comparar fuente |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'validacion2.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
fuente := FontFamily familyName: FontFamily defaultFamilyName pointSize: 24.
comparar := [ :nombre :claseST :clasePL :subpixel :bloque |
	| f1 f2 dif maxd b1 b2 |
	f1 := Form extent: 220@120 depth: 32.
	f2 := Form extent: 220@120 depth: 32.
	f1 fillColor: Color white. f2 fillColor: Color white.
	[ bloque value: ((Smalltalk at: claseST) onForm: f1 subPixelAntiAliasing: subpixel) ]
		on: Error do: [ :e2 | lineas add: nombre, ': ERROR Smalltalk: ', e2 messageText printString ].
	[ bloque value: ((Smalltalk at: clasePL) onForm: f2 subPixelAntiAliasing: subpixel).
	  b1 := f1 bits. b2 := f2 bits.
	  dif := 0. maxd := 0.
	  1 to: b1 size do: [ :i |
		(b1 at: i) = (b2 at: i) ifFalse: [
			| p1 p2 dd |
			dif := dif + 1. p1 := b1 at: i. p2 := b2 at: i.
			0 to: 24 by: 8 do: [ :sh |
				dd := (((p1 bitShift: sh negated) bitAnd: 255) - ((p2 bitShift: sh negated) bitAnd: 255)) abs.
				dd > maxd ifTrue: [ maxd := dd ] ] ] ].
	  lineas add: nombre, ': ', dif printString, ' pixeles distintos, delta max ', maxd printString ]
		on: Error do: [ :e2 | lineas add: nombre, ': PRIMITIVA FALLO (', e2 messageText printString, ')' ].
	escribir value ].
[ [
	lineas add: 'fuente: ', fuente printString. escribir value.
	"texto sub-pixel y whole-pixel"
	comparar valueWithArguments: { 'texto subpixel'. #VectorEngineSubPixel. #VectorEngineWithPluginSubPixel. true. [ :e |
		'Hola VectorGraphics 123' asUnicodeString drawOnVectorEngine: e from: 1 to: 23 at: 10@60 font: fuente color: Color black ] }.
	comparar valueWithArguments: { 'texto wholepixel'. #VectorEngineWholePixel. #VectorEngineWithPluginWholePixel. false. [ :e |
		'Hola VectorGraphics 123' asUnicodeString drawOnVectorEngine: e from: 1 to: 23 at: 10@60 font: fuente color: Color black ] }.
	"formas whole-pixel"
	comparar valueWithArguments: { 'arco wholepixel'. #VectorEngineWholePixel. #VectorEngineWithPluginWholePixel. false. [ :e |
		e strokeWidth: 3.0 color: Color black fillColor: Color red do: [ :ee |
			ee arcCenter: 110.0@60.0 radius: 80.0@40.0 rotationAngle: 0.3 start: 0.0 sweep: Float twoPi ] ] }.
	"punteado"
	comparar valueWithArguments: { 'trazo punteado'. #VectorEngineSubPixel. #VectorEngineWithPluginSubPixel. true. [ :e |
		e strokeWidth: 4.0 color: Color black dashedStrokeBits: 2r1100 dashBitLength: 6.0 dashBitOffset: 0 do: [ :ee |
			ee moveTo: 10.0@30.0; lineTo: 210.0@90.0 ] ] }.
	"relleno con borde (stroke+fill juntos)"
	comparar valueWithArguments: { 'stroke y fill'. #VectorEngineSubPixel. #VectorEngineWithPluginSubPixel. true. [ :e |
		e strokeWidth: 5.0 color: Color blue fillColor: (Color yellow alpha: 0.7) do: [ :ee |
			ee moveTo: 30.0@20.0; lineTo: 190.0@30.0; lineTo: 170.0@100.0; lineTo: 40.0@90.0; lineTo: 30.0@20.0 ] ] }.
	lineas add: 'fin'. escribir value
  ] on: Warning do: [ :wa | wa resume: true ] ]
	on: Error do: [ :e | lineas add: 'ERROR GENERAL: ', e class name, ' / ', (e messageText ifNil: ['sin texto']). lineas add: 'fin'. escribir value ]
