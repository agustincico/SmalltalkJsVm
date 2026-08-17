| mutex duenio esperando log anotar r sigo |
log := OrderedCollection new.
anotar := [ :linea |
	log add: linea.
	(DirectoryEntry currentDirectory // 'resultado-mutex2.txt') forceWriteStreamDo: [ :s |
		log do: [ :l | s nextPutAll: l; newLine ] ] ].
anotar value: '0 arranca'.
mutex := Mutex new.
sigo := Semaphore new.
"el dueno toma el mutex y se queda adentro esperando un semaforo"
duenio := [ mutex critical: [ sigo wait ] ] newProcess.
duenio priority: Processor activePriority.
duenio resume.
Processor yield.
"el segundo se bloquea esperando el mutex"
esperando := [ mutex critical: [ anotar value: 'X ENTRO AL CRITICAL' ] ] newProcess.
esperando priority: Processor activePriority.
esperando resume.
Processor yield.
anotar value: '1 lista del bloqueado: ', esperando suspendingList printString,
	'  clase: ', esperando suspendingList class name,
	'  es el mutex: ', (esperando suspendingList == mutex) printString.
anotar value: '1b contexto del bloqueado: ', esperando suspendedContext printString.
r := [ esperando suspend ] on: Error do: [ :e | 'ERROR: ', e class name ].
anotar value: '2 suspend respondio: ', r printString.
anotar value: '2b contexto tras suspend: ', esperando suspendedContext printString.
esperando resume.
Processor yield. Processor yield.
anotar value: '3 tras resume, lista: ', esperando suspendingList printString,
	'  es el mutex: ', (esperando suspendingList == mutex) printString.
anotar value: '3b contexto: ', esperando suspendedContext printString.
anotar value: 'fin'.
Smalltalk quit: 0
