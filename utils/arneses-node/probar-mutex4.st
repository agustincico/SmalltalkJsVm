| clase mutex b log anotar r tope |
log := OrderedCollection new.
anotar := [ :linea |
	log add: linea.
	(DirectoryEntry currentDirectory // 'resultado-mutex4.txt') forceWriteStreamDo: [ :s |
		log do: [ :l | s nextPutAll: l; newLine ] ] ].
anotar value: '0 arranca'.
Semaphore subclass: #MiMutex
	instanceVariableNames: ''
	classVariableNames: ''
	poolDictionaries: ''
	category: 'Prueba'.
clase := Smalltalk at: #MiMutex.
r := [ clase compile: 'entrar
	"como Mutex>>primitiveEnterCriticalSection de Squeak"
	<primitive: 186>
	^#fallo' classified: 'prueba'. 'ok' ] on: Error do: [ :e | 'ERROR compilando: ', e messageText printString ].
anotar value: '0b compilacion: ', r printString.
mutex := clase new.
"el slot 3 (owner) tiene 0 heredado de Semaphore: la primitiva lo ve ocupado y bloquea"
b := [ [ mutex entrar. anotar value: 'X B SIGUIO DE LARGO' ]
       on: Error do: [ :e |
         anotar value: 'ERROR EN B: ', e class name printString, ' -- ', e messageText printString,
			' -- receptor: ', ([ e message printString ] on: Error do: [ :x | '?' ]) ] ] newProcess.
b priority: Processor activePriority.
b resume.
Processor yield.
anotar value: '1 lista de b: ', b suspendingList printString,
	'  es el mutex: ', (b suspendingList == mutex) printString.
tope := [ b suspendedContext top printString ] on: Error do: [ :e | 'no pude leer el tope' ].
anotar value: '1b tope de la pila de b (antes del suspend): ', tope.
r := [ b suspend ] on: Error do: [ :e | 'ERROR: ', e class name printString ].
anotar value: '2 suspend respondio: ', r printString.
tope := [ b suspendedContext top printString ] on: Error do: [ :e | 'no pude leer el tope' ].
anotar value: '2b tope de la pila de b (tras el suspend): ', tope.
anotar value: '2c contexto de b: ', b suspendedContext printString.
b resume.
Processor yield. Processor yield. Processor yield.
anotar value: '3 tras resume, lista de b: ', b suspendingList printString,
	'  es el mutex: ', (b suspendingList == mutex) printString.
anotar value: '3b contexto de b: ', b suspendedContext printString.
anotar value: 'fin'.
Smalltalk quit: 0
