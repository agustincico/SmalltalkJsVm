"The application itself: bubbles you can drag and a shockwave on click, with none of the
IDE showing. Ship this as startup.st next to the image (Pharo runs it at boot) -- no .sources
needed, an application does not browse its own code.

Why at startup instead of a saved image: a snapshot taken with the bare snapshotPrimitive
resumes WITHOUT Pharo's session restart, so the UI process never comes back and the world
is frozen -- it renders its last frame and ignores input. Booting normally keeps Morphic,
its stepping and its event dispatch fully alive, and hiding the chrome is enough to make it
an application."!

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

| world field result |
world := World.

"1. clean desktop: the IDE chrome is what makes it look like an IDE"
(world submorphs select: [ :m | m isSystemWindow ]) do: [ :w | w delete ].
[ MenubarMorph showMenubar: false ] on: Error do: [ :e | ].
[ TaskbarMorph showTaskbar: false ] on: Error do: [ :e | ].
[ Morph halosEnabled: false ] on: Error do: [ :e | ].
[ world submorphs
	select: [ :m | m isMenubar or: [ m isTaskbar ] ]
	thenDo: [ :m | m delete ] ] on: Error do: [ :e | ].

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

"4. ready -- the application is up. No snapshot: resuming an image saved with the bare
snapshotPrimitive comes back without Pharo's session restart, and its UI process never
gets going again, so the world renders its last frame and then ignores every event."
world changed.
!
