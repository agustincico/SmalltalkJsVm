| lineas escribir |
lineas := OrderedCollection new.
escribir := [ (DirectoryEntry currentDirectory // 'vep.txt') forceWriteStreamDo: [ :s |
	lineas do: [ :l | s nextPutAll: l; newLine ] ] ].
lineas add: 'apiVersion respondida: ', (Smalltalk at: #VectorEngineWithPlugin) pluginApiVersion printString.
lineas add: 'isPluginAvailable: ', (Smalltalk at: #VectorEngineWithPlugin) isPluginAvailable printString.
lineas add: 'fin'. escribir value
