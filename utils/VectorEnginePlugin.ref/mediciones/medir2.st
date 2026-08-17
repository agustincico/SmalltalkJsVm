"¿el redibujo con Browser gasta en el motor vectorial o en otra cosa?
 Cronometro por separado el fullDraw del Browser sobre un canvas de memoria."
| lineas escribir w canvas ms ventana |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'medicion2.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
[ [
	w := UISupervisor ui.
	canvas := w mainCanvas.
	ventana := (BrowserWindow new model: Browser new; buildMorphicWindow) openInWorld.
	w fullRepaintNeeded. w displayWorldOn: canvas.
	"medir el fullDraw de la ventana sola, sin el resto del mundo"
	ms := Time millisecondsToRun: [ 10 timesRepeat: [ canvas fullDraw: ventana ] ].
	lineas add: 'fullDraw del Browser solo: ', (ms/10.0) printString, ' ms'.
	escribir value.
	lineas add: 'clase de la ventana: ', ventana class name.
	lineas add: 'fin'. escribir value
  ] on: Warning do: [ :wa | wa resume: true ] ]
	on: Error do: [ :e | lineas add: 'ERROR: ', e class name, ' / ', (e messageText ifNil: ['sin texto']). lineas add: 'fin'. escribir value ]
