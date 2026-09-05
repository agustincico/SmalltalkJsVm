"LO QUE EL DEBUGGER HACE ADEMAS DE MIRAR: reiniciar un frame, dar un paso,
 y suspender/reanudar un proceso parado EN MEDIO de codigo directo.
 Todo esto agarra un contexto materializado desde locales de JS y lo vuelve a
 poner a correr: es la prueba mas dura de la materializacion."
| out probar |
out := StdIOWriteStream stdout.
probar := [ :nombre :blk |
    | v |
    v := [ blk value printString ] on: Error do: [ :e |
            'EXCEPCION: ', e class name, ' ', ([ e messageText printString ] on: Error do: [ :z | '?' ]) ].
    out nextPutAll: '##', nombre, ' ', v; newLine; flush ].

"efectos de desenrollado observables (sin escribir al stream desde el unwind)"
probar value: 'UNWIND-ORDEN' value: [
    | t | t := OrderedCollection new.
    [ [ [ 3 between: 1 and: nil ] ensure: [ t add: #interno ] ] ensure: [ t add: #externo ] ]
        on: Error do: [ :e | nil ].
    t asArray ].
probar value: 'CURT-CORRIO' value: [
    | t | t := OrderedCollection new.
    [ [ nil zorkA ] ifCurtailed: [ t add: #curtailed ] ] on: Error do: [ :e | nil ].
    t asArray ].

"DEBUGGER: reiniciar un frame materializado (lo que hace el boton Restart)"
probar value: 'RESTART' value: [
    | n r | n := 0.
    r := [ n := n + 1. n < 3 ifTrue: [ Error signal: 'todavia no' ]. n * 100 ]
        on: Error do: [ :e | e retry ].
    r ].

"DEBUGGER: dar pasos sobre un contexto materializado (boton Step)"
probar value: 'STEP' value: [
    | ctx pasos |
    ctx := [ 3 between: 1 and: 5 ] asContext.
    pasos := 0.
    [ ctx isNil or: [ pasos > 400 ] ] whileFalse: [ ctx := ctx step. pasos := pasos + 1 ].
    pasos > 0 ].

"DEBUGGER: mirar la pila de OTRO proceso suspendido adentro de codigo directo"
probar value: '~OTRO-PROCESO' value: [
    | p listo cad n |
    listo := false.
    p := [ 1 to: 300000 do: [ :i | listo := (i between: 1 and: 400000) ] ] newProcess.
    p priority: Processor userSchedulingPriority - 1.
    p resume.
    (Delay forMilliseconds: 30) wait.
    p suspend.
    cad := OrderedCollection new. n := p suspendedContext.
    [ n notNil and: [ cad size < 6 ] ] whileTrue: [ cad add: n printString. n := n sender ].
    p terminate.
    cad asArray ].

"EL MAS DURO: preemptar codigo directo cientos de veces y ver si da bien"
probar value: 'PREEMPCION' value: [
    | p res guardia |
    res := nil.
    p := [ res := 25 benchFib ] newProcess.
    p priority: Processor userSchedulingPriority.
    guardia := [ 1 to: 400 do: [ :i | (Delay forMilliseconds: 1) wait ] ] newProcess.
    guardia priority: Processor highIOPriority.
    p resume. guardia resume.
    [ res isNil ] whileTrue: [ (Delay forMilliseconds: 25) wait ].
    guardia terminate.
    res ].

probar value: 'SANO' value: [ (28 benchFib) printString, ' ', (3 between: 1 and: 5) printString ].
out nextPutAll: '##FIN ok'; newLine; flush.
Smalltalk quitPrimitive.
