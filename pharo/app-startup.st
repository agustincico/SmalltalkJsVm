"The application itself: bubbles you can drag and a shockwave on click, with none of the
IDE showing. This is the single source of the app; app-snapshot.st appended to it turns a
stock Pharo image into a deployment image (see README).

Run as startup.st beside an image and the app is assembled at every boot, which works but
shows the plain Pharo desktop while it happens. The published bundle instead ships the image
that app-snapshot.st saves from this one, so it opens with the app already there."!

Morph subclass: #BubbleField
	instanceVariableNames: 'bubbles'
	classVariableNames: ''
	package: 'SmalltalkJsVm-Demo'!

EllipseMorph subclass: #RippleMorph
	instanceVariableNames: 'age origin'
	classVariableNames: ''
	package: 'SmalltalkJsVm-Demo'!

EllipseMorph subclass: #BubbleMorph
	instanceVariableNames: 'vx vy dragging dragOffset'
	classVariableNames: ''
	package: 'SmalltalkJsVm-Demo'!

"--- BubbleMorph: a bubble that drifts, bounces, and can be thrown around by hand ---"!

!BubbleMorph methodsFor: 'accessing' stamp: ''!
vx
	^ vx ifNil: [ vx := 0 ]! !

!BubbleMorph methodsFor: 'accessing' stamp: ''!
vx: aNumber
	vx := aNumber! !

!BubbleMorph methodsFor: 'accessing' stamp: ''!
vy
	^ vy ifNil: [ vy := 0 ]! !

!BubbleMorph methodsFor: 'accessing' stamp: ''!
vy: aNumber
	vy := aNumber! !

!BubbleMorph methodsFor: 'accessing' stamp: ''!
isDragging
	^ dragging ifNil: [ dragging := false ]! !

!BubbleMorph methodsFor: 'events' stamp: ''!
handlesMouseDown: anEvent
	^ true! !

!BubbleMorph methodsFor: 'events' stamp: ''!
handlesMouseMove: anEvent
	"Morphic asks before dispatching moves. Without this the bubble gets the press but
	never the drag, and it just sits there while the pointer walks away."
	^ true! !

!BubbleMorph methodsFor: 'events' stamp: ''!
handlesMouseOver: anEvent
	^ true! !

!BubbleMorph methodsFor: 'events' stamp: ''!
mouseDown: anEvent
	"Grab it. Remember where inside the bubble it was grabbed so it does not jump."
	dragging := true.
	dragOffset := self position - anEvent position.
	vx := 0. vy := 0.
	self comeToFront! !

!BubbleMorph methodsFor: 'events' stamp: ''!
mouseMove: anEvent
	"Follow the pointer, and keep the movement as velocity so releasing throws the bubble."
	| target |
	self isDragging ifFalse: [ ^ self ].
	target := anEvent position + dragOffset.
	vx := (target x - self position x) / 2.
	vy := (target y - self position y) / 2.
	self position: target.
	self changed! !

!BubbleMorph methodsFor: 'events' stamp: ''!
mouseUp: anEvent
	dragging := false! !

!BubbleMorph methodsFor: 'physics' stamp: ''!
push: anImpulse
	"Add an impulse, keeping the speed within something watchable."
	| max |
	max := 22.
	vx := ((self vx + anImpulse x) max: max negated) min: max.
	vy := ((self vy + anImpulse y) max: max negated) min: max! !

!BubbleMorph methodsFor: 'stepping' stamp: ''!
wantsSteps
	"Morphic only steps morphs that ask for it."
	^ true! !

!BubbleMorph methodsFor: 'stepping' stamp: ''!
stepTime
	"Driven by Morphic itself: the World steps its morphs, and that survives a snapshot,
	which a forked process of our own does not."
	^ 25! !

!BubbleMorph methodsFor: 'stepping' stamp: ''!
step
	self world ifNotNil: [ :w | self advanceWithin: w bounds ]! !

!BubbleMorph methodsFor: 'physics' stamp: ''!
advanceWithin: aRectangle
	"Move one step and bounce off the edges. Ignored while being dragged."
	| p |
	self isDragging ifTrue: [ ^ self ].
	p := self position + (self vx @ self vy).
	(p x < aRectangle left or: [ p x > (aRectangle right - self width) ])
		ifTrue: [ vx := self vx negated ].
	(p y < aRectangle top or: [ p y > (aRectangle bottom - self height) ])
		ifTrue: [ vy := self vy negated ].
	"damping, so a shockwave fades out instead of accumulating forever"
	vx := self vx * 0.995. vy := self vy * 0.995.
	self position:
		((p x max: aRectangle left) min: aRectangle right - self width) @
		((p y max: aRectangle top) min: aRectangle bottom - self height).
	self changed! !

"--- RippleMorph: the expanding ring a click leaves behind ---"!

!RippleMorph methodsFor: 'initialization' stamp: ''!
centerOn: aPoint
	origin := aPoint.
	age := 0.
	self borderWidth: 0.
	self color: ((Color r: 0.2 g: 0.45 b: 0.8) alpha: 0.45).
	self bounds: (aPoint - (6 @ 6) corner: aPoint + (6 @ 6))! !

!RippleMorph methodsFor: 'stepping' stamp: ''!
wantsSteps
	^ true! !

!RippleMorph methodsFor: 'stepping' stamp: ''!
stepTime
	^ 20! !

!RippleMorph methodsFor: 'stepping' stamp: ''!
step
	| radius |
	age := (age ifNil: [ 0 ]) + 1.
	age > 18 ifTrue: [ ^ self delete ].
	radius := age * 14.
	self bounds: (origin - (radius @ radius) corner: origin + (radius @ radius)).
	self color: ((Color r: 0.2 g: 0.45 b: 0.8) alpha: 0.45 * (1 - (age / 18))).
	self changed! !

"--- BubbleField: the invisible sheet behind the bubbles; catches clicks on empty space ---"!

!BubbleField methodsFor: 'accessing' stamp: ''!
bubbles
	^ bubbles ifNil: [ bubbles := OrderedCollection new ]! !

!BubbleField methodsFor: 'accessing' stamp: ''!
addBubble: aBubble
	self bubbles add: aBubble! !

!BubbleField methodsFor: 'events' stamp: ''!
containsPoint: aPoint
	"Morphic skips transparent morphs when deciding who gets a click. This sheet is
	invisible on purpose -- it must not hide Pharo's desktop -- but it does want the
	clicks that land on empty space, so answer for its whole area."
	^ self bounds containsPoint: aPoint! !

!BubbleField methodsFor: 'events' stamp: ''!
handlesMouseDown: anEvent
	^ true! !

!BubbleField methodsFor: 'events' stamp: ''!
mouseDown: anEvent
	self shockwaveAt: anEvent position! !

!BubbleField methodsFor: 'effects' stamp: ''!
shockwaveAt: aPoint
	"Shove every bubble away from the point, harder the closer it is, and draw the ring."
	self bubbles do: [ :b |
		| d dist strength |
		d := b center - aPoint.
		dist := (d r max: 1) min: 100000.
		strength := 1800 / (dist + 40).
		b push: (d / dist) * strength ].
	self ringAt: aPoint! !

!BubbleField methodsFor: 'effects' stamp: ''!
ringAt: aPoint
	"An expanding, fading circle that steps itself and then goes away."
	| ring |
	ring := RippleMorph new.
	ring centerOn: aPoint.
	ring openInWorld! !

!BubbleField methodsFor: 'running' stamp: ''!
startRunning
	"Nothing to start: every bubble steps itself through Morphic."
	^ self! !

"--- build the application and freeze it into the image ---"!

"SqjsSweep keeps what the application put on the desktop -- the bubbles, the field, the two
labels -- and deletes anything else that turned up. Pharo's startup notices (the missing
.sources file, the absent TFFI callbacks) are what it is for: they are not system windows, so
picking by isSystemWindow leaves them sitting there, or bakes them into a saved image.

Both this and SqjsLog are defined as chunks of their own, ahead of the doit: a comment that
closes a chunk in the middle of a doit would cut the doit short, and the remainder would then
run as separate chunks against variables that no longer exist -- which fails in silence and
leaves a plain Pharo booting. (Chunk punctuation is unforgiving that way. This paragraph
cannot even name the character without doubling it: !!)"!

Smalltalk at: #SqjsSweep put: [
	[ World submorphs do: [ :m |
		([ m isSystemWindow
			or: [ m isMenubar
			or: [ m isTaskbar
			or: [ m class name includesSubstring: 'Growl' ] ] ] ] on: Error do: [ :e | false ])
				ifTrue: [ [ m delete ] on: Error do: [ :e | ] ] ].
	  World changed ] on: Error do: [ :e | ] ]!

Smalltalk at: #SqjsLog put: [ :msg |
	[ | out |
	  out := (FileLocator workingDirectory / 'appbuild.log') writeStream.
	  out nextPutAll: msg; flush; close ] on: Error do: [ :e | ] ]!

(Smalltalk at: #SqjsLog) value: 'chunks-ok'!

"Compiling a method makes Pharo ask who is writing it, and it asks with a modal dialog. In a
startup script there is nobody to answer, so the script stops there and waits forever -- the
image finishes booting as plain Pharo and nothing says why. Name the author first. The setter
on the instance assigns it outright; the class-side one validates and can raise the very
dialog we are avoiding."!

[ (Smalltalk at: #Author) uniqueInstance fullName: 'SmalltalkJsVm' ] on: Error do: [ :e | ]!

(Smalltalk at: #SqjsLog) value: 'author-set'!

"Sweeping the notices away is a race we keep losing: Pharo raises them at points spread over
the whole of startup, and on a resumed image the session restart raises them again. Every one
of them is opened through this single method, so silence it there instead. An application has
nobody to inform that the .sources file is absent or that the VM has no native FFI callbacks.

The class is reached through Smalltalk at: rather than named outright: naming a global that
turns out not to exist fails at compile time, before the on:Error around it can catch
anything, and that takes the whole script down without a word."!

[ (Smalltalk at: #GrowlMorph) class
	compile: 'openWithLabel: aString contents: contentString backgroundColor: aColor labelColor: aLabelColor
	"SqueakJS: an application, not the IDE. No notices."
	^ nil'
	classified: 'squeakjs-compat' ] on: Error do: [ :e | ]!

(Smalltalk at: #SqjsLog) value: 'growls-silenced'!

"The .sources file is deliberately not shipped -- it is about 39 MB and only serves to browse
code -- so on every startup, and again on every session restart of the resumed image, Pharo
announces through StartupUIManager that it cannot find it. That announcement does not go
through GrowlMorph, so the silencing above does not reach it.

Rather than override the method that announces, use the mechanism Pharo already has for an
image with no source files: NoPharoFilesOpener answers nil for sources and changes and says
nothing. Its install: sets the shared Default that PharoFilesOpener class>>default reads, and
being a class variable it survives the snapshot."!

[ (Smalltalk at: #NoPharoFilesOpener) install ] on: Error do: [ :e | ]!

(Smalltalk at: #SqjsLog) value: 'sources-opener-neutered'!

| world field result |
world := World.
(Smalltalk at: #SqjsLog) value: 'doit-start'.

"1. clean desktop: the IDE chrome is what makes it look like an IDE. Windows, menubar and
taskbar go, and so do Pharo's startup notices -- the missing .sources file and the absent
TFFI callbacks each raise a Growl, which is not a system window and so survives the obvious
sweep, then sits there in plain sight or gets baked into a saved image. The desktop logo
stays: this is still Pharo, and it says so."
(Smalltalk at: #SqjsSweep) value.
[ MenubarMorph showMenubar: false ] on: Error do: [ :e | ].
[ TaskbarMorph showTaskbar: false ] on: Error do: [ :e | ].
[ Morph halosEnabled: false ] on: Error do: [ :e | ].
(Smalltalk at: #SqjsLog) value: 'desktop-cleared'.

"2. the field goes in first so the bubbles end up in front of it and get their own clicks"
field := BubbleField new.
field color: (Color white alpha: 0.004).  "invisible, pero hit-testable"
field bounds: world bounds.
"Explicitly at the back: openInWorld puts a morph in FRONT, and a full-screen sheet in
front swallows the clicks meant for the bubbles."
world addMorphBack: field.

[ | title subtitle |
  title := StringMorph contents: 'running in your browser'.
  title font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 26).
  title color: (Color r: 0.11 g: 0.15 b: 0.33).
  title position: 440 @ 40.
  title openInWorld.
  subtitle := StringMorph contents: 'drag a bubble, or click anywhere for a shockwave'.
  subtitle font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 14).
  subtitle color: (Color r: 0.33 g: 0.36 b: 0.45).
  subtitle position: 442 @ 78.
  subtitle openInWorld ] on: Error do: [ :e | ].

(1 to: 14) do: [ :i |
	| b |
	b := BubbleMorph new.
	b borderWidth: 0.
	b color: (Color random alpha: 0.85).
	b extent: (28 + 24 atRandom) asPoint.
	b position: (60 + 500 atRandom) @ (70 + 380 atRandom).
	b vx: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
	b vy: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
	b openInWorld.
	field addBubble: b ].

field startRunning.

(Smalltalk at: #SqjsLog) value: 'built'.

"4. ready. Some of Pharo's startup notices arrive after this script has run, so keep sweeping
for a few seconds."
[ 1 to: 8 do: [ :i |
	(Delay forMilliseconds: 700) wait.
	(Smalltalk at: #SqjsSweep) value ] ] forkAt: Processor userBackgroundPriority.

world changed.
(Smalltalk at: #SqjsLog) value: 'done'.
!
