"Build a deployment image out of the Morphic demo: an application, not the IDE with an app
on top of it. Run this as startup.st once (in the browser worker, where Pharo's file layer
works — under Node our FileAttributesPlugin has no virtual FS and every stat fails), then
ship the resulting .image *without* any startup.st: the application state is baked in.

What gets baked in:
  - no menu bar, no taskbar, no halos — the IDE chrome is what makes it look like an IDE
  - every window closed
  - the demo morphs and their animation process, alive at snapshot time

Snapshotting goes through Smalltalk snapshotPrimitive rather than `Smalltalk snapshot:`,
because Pharo's session machinery around it (ChangesLog logSnapshot:, session stop/restart)
does file work that fails here. The primitive itself writes the image fine.
Note the image keeps its full size: this hides and closes things, it does not unload the
development packages, which in Pharo is a far riskier operation."
[
| balls world result |
world := World.

"1. clean desktop"
(world submorphs select: [:m | m isSystemWindow]) do: [:w | w delete].
[ MenubarMorph showMenubar: false ] on: Error do: [:e | ].
[ TaskbarMorph showTaskbar: false ] on: Error do: [:e | ].
[ Morph halosEnabled: false ] on: Error do: [:e | ].
[ world submorphs
    select: [:m | m isMenubar or: [ m isTaskbar ]]
    thenDo: [:m | m delete] ] on: Error do: [:e | ].

"2. the application itself"
[ | title subtitle |
  title := StringMorph contents: 'running in your browser'.
  title font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 26).
  title color: (Color r: 0.11 g: 0.15 b: 0.33).
  title position: 440 @ 44.
  title openInWorld.
  subtitle := StringMorph contents: 'a Pharo application — no plugins, no server, no IDE.'.
  subtitle font: (LogicalFont familyName: 'Source Sans Pro' pointSize: 14).
  subtitle color: (Color r: 0.33 g: 0.36 b: 0.45).
  subtitle position: 442 @ 82.
  subtitle openInWorld ] on: Error do: [:e | ].

balls := (1 to: 14) collect: [:i | | m |
    m := EllipseMorph new.
    m color: (Color random alpha: 0.85).
    m extent: (28 + 24 atRandom) asPoint.
    m position: (60 + 500 atRandom) @ (70 + 380 atRandom).
    m setProperty: #vx toValue: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
    m setProperty: #vy toValue: ((6 atRandom) - 3 + (2 atRandom)) sign * (2 + 3 atRandom).
    m openInWorld.
    m].

"Animate just below the UI process so it is always scheduled between cycles, and invalidate
explicitly — the worker's deferred-update path repaints damaged regions, not everything."
[[true] whileTrue: [
    balls do: [:m | | p vx vy w h |
        vx := m valueOfProperty: #vx. vy := m valueOfProperty: #vy.
        w := m width. h := m height.
        p := m position + (vx @ vy).
        (p x < 0 or: [p x > (world width - w)]) ifTrue: [vx := vx negated. m setProperty: #vx toValue: vx].
        (p y < 0 or: [p y > (world height - h)]) ifTrue: [vy := vy negated. m setProperty: #vy toValue: vy].
        m position: (p x max: 0) @ (p y max: 0).
        m changed].
    world changed.
    (Delay forMilliseconds: 25) wait]] forkAt: Processor userSchedulingPriority - 1.

"3. let the world settle and paint before freezing it into the image"
(Delay forMilliseconds: 1500) wait.
world changed.
(Delay forMilliseconds: 500) wait.

"4. write the image, then leave a marker the build script can look for"
result := [ Smalltalk snapshotPrimitive printString ]
    on: Error do: [:e | 'ERROR: ', e messageText asString ].
[ | out |
  out := (FileLocator workingDirectory / 'appbuild.done') writeStream.
  out nextPutAll: 'snapshot=', result; flush; close ] on: Error do: [:e | ].
] on: Error do: [:e |
    [ | out |
      out := (FileLocator workingDirectory / 'appbuild.done') writeStream.
      out nextPutAll: 'BUILD-FAILED: ', e messageText asString; flush; close ] on: Error do: [:x | ] ].
