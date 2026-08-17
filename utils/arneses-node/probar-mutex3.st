| mutex sem a b log anotar r tope |
log := OrderedCollection new.
anotar := [ :linea |
	log add: linea.
	(DirectoryEntry currentDirectory // 'resultado-mutex3.txt') forceWriteStreamDo: [ :s |
		log do: [ :l | s nextPutAll: l; newLine ] ] ].
anotar value: '0 arranca'.
mutex := Mutex new.
sem := Semaphore new.
"A toma el mutex con la primitiva 186 y se queda adentro"
a := [ mutex primitiveEnterCriticalSectionOnBehalfOf: Processor activeProcess.
       sem wait ] newProcess.
a priority: Processor activePriority.
a resume.
Processor yield.
"B se bloquea en la primitiva 186 (rama que encola el proceso en el mutex)"
b := [ [ mutex primitiveEnterCriticalSectionOnBehalfOf: Processor activeProcess.
         anotar value: 'X B ENTRO AL CRITICAL' ]
       on: Error do: [ :e |
         anotar value: 'ERROR EN B: ', e class name printString, ' -- ', e messageText printString ] ] newProcess.
b priority: Processor activePriority.
b resume.
Processor yield.
anotar value: '1 lista de b: ', b suspendingList printString,
	'  es el mutex: ', (b suspendingList == mutex) printString.
tope := [ b suspendedContext top printString ] on: Error do: [ :e | 'no pude leer el tope' ].
anotar value: '1b tope de la pila de b antes del suspend: ', tope.
r := [ b suspend ] on: Error do: [ :e | 'ERROR: ', e class name printString ].
anotar value: '2 suspend respondio: ', r printString.
tope := [ b suspendedContext top printString ] on: Error do: [ :e | 'no pude leer el tope' ].
anotar value: '2b tope de la pila de b tras el suspend: ', tope.
anotar value: '2c contexto de b: ', b suspendedContext printString.
b resume.
Processor yield. Processor yield. Processor yield.
anotar value: '3 tras resume, lista de b: ', b suspendingList printString,
	'  es el mutex: ', (b suspendingList == mutex) printString.
anotar value: '3b contexto de b: ', b suspendedContext printString.
anotar value: 'fin'.
Smalltalk quit: 0
