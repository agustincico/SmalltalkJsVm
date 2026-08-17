"Medición del motor vectorial Smalltalk: redibujos completos del mundo, cronometrados
 por la propia imagen, sobre la escena por defecto y sobre una escena con Browser."
| lineas escribir w canvas medir |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'medicion.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
[ [
	w := UISupervisor ui.
	canvas := w mainCanvas.
	lineas add: 'pantalla: ', Display extent printString.
	lineas add: 'canvas activo: ', canvas class name.
	lineas add: 'motor: ', (canvas respondsTo: #engine) printString.
	lineas add: 'plugin disponible: ', (Smalltalk at: #VectorEngineWithPlugin) isPluginAvailable printString.
	escribir value.
	medir := [ :nombre |
		| ms |
		"calentar una vez"
		w fullRepaintNeeded. w displayWorldOn: canvas.
		ms := Time millisecondsToRun: [
			10 timesRepeat: [ w fullRepaintNeeded. w displayWorldOn: canvas ] ].
		lineas add: nombre, ': ', (ms / 10.0) printString, ' ms por redibujo completo'.
		escribir value ].
	medir value: 'escena inicial (Transcript + bienvenida)'.
	(BrowserWindow new model: Browser new; buildMorphicWindow) openInWorld.
	w fullRepaintNeeded. w displayWorldOn: canvas.
	medir value: 'con un Browser abierto'.
	(BrowserWindow new model: Browser new; buildMorphicWindow) openInWorld.
	(BrowserWindow new model: Browser new; buildMorphicWindow) openInWorld.
	w fullRepaintNeeded. w displayWorldOn: canvas.
	medir value: 'con tres Browsers abiertos'.
	lineas add: 'fin'. escribir value
  ] on: Warning do: [ :wa | wa resume: true ] ]
	on: Error do: [ :e | lineas add: 'ERROR: ', e class name, ' / ', (e messageText ifNil: ['sin texto']). lineas add: 'fin'. escribir value ]
