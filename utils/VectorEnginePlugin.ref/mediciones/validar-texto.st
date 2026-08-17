"¿La divergencia de texto es estructural o de bordes? Compara por columnas:
 cuenta de píxeles con tinta por columna en ambos motores, y además vuelca
 los dos renders como bytes crudos para inspección visual."
| lineas escribir f1 f2 fuente b1 b2 col1 col2 peor sumd |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'texto-analisis.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
[ [
	fuente := FontFamily familyName: FontFamily defaultFamilyName pointSize: 24.
	f1 := Form extent: 220@120 depth: 32. f1 fillColor: Color white.
	f2 := Form extent: 220@120 depth: 32. f2 fillColor: Color white.
	'Hola VectorGraphics 123' asUnicodeString
		drawOnVectorEngine: ((Smalltalk at: #VectorEngineSubPixel) onForm: f1 subPixelAntiAliasing: true)
		from: 1 to: 23 at: 10@60 font: fuente color: Color black.
	'Hola VectorGraphics 123' asUnicodeString
		drawOnVectorEngine: ((Smalltalk at: #VectorEngineWithPluginSubPixel) onForm: f2 subPixelAntiAliasing: true)
		from: 1 to: 23 at: 10@60 font: fuente color: Color black.
	b1 := f1 bits. b2 := f2 bits.
	col1 := Array new: 220 withAll: 0. col2 := Array new: 220 withAll: 0.
	0 to: 119 do: [ :y | 0 to: 219 do: [ :x |
		| p |
		p := b1 at: y * 220 + x + 1.
		(p bitAnd: 255) < 128 ifTrue: [ col1 at: x + 1 put: (col1 at: x + 1) + 1 ].
		p := b2 at: y * 220 + x + 1.
		(p bitAnd: 255) < 128 ifTrue: [ col2 at: x + 1 put: (col2 at: x + 1) + 1 ] ] ].
	peor := 0. sumd := 0.
	1 to: 220 do: [ :x |
		| dd | dd := ((col1 at: x) - (col2 at: x)) abs.
		sumd := sumd + dd. dd > peor ifTrue: [ peor := dd ] ].
	lineas add: 'tinta total ST: ', (col1 inject: 0 into: [ :a :b | a + b ]) printString,
		' | plugin: ', (col2 inject: 0 into: [ :a :b | a + b ]) printString.
	lineas add: 'peor delta por columna: ', peor printString, ' | suma de deltas: ', sumd printString.
	lineas add: 'columnas con tinta ST: ', (col1 count: [ :c | c > 0 ]) printString,
		' | plugin: ', (col2 count: [ :c | c > 0 ]) printString.
	"primera y última columna con tinta (posición del texto)"
	lineas add: 'rango ST: ', (col1 findFirst: [ :c | c > 0 ]) printString, '-', (col1 findLast: [ :c | c > 0 ]) printString,
		' | plugin: ', (col2 findFirst: [ :c | c > 0 ]) printString, '-', (col2 findLast: [ :c | c > 0 ]) printString.
	"volcar crudo para mirar"
	(DirectoryEntry currentDirectory // 'texto-st.raw') forceWriteStreamDo: [ :s |
		s binary. b1 do: [ :w | s nextUnsignedInt32Put: w bigEndian: false ] ].
	(DirectoryEntry currentDirectory // 'texto-plugin.raw') forceWriteStreamDo: [ :s |
		s binary. b2 do: [ :w | s nextUnsignedInt32Put: w bigEndian: false ] ].
	lineas add: 'fin'. escribir value
  ] on: Warning do: [ :wa | wa resume: true ] ]
	on: Error do: [ :e | lineas add: 'ERROR: ', e class name, ' / ', (e messageText ifNil: ['sin texto']). lineas add: 'fin'. escribir value ]
