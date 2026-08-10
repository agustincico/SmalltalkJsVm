"Freeze the running application into the image. Append this to app-startup.st and run the
result as startup.st once, beside a stock Pharo image, in the browser worker (under Node our
FileAttributesPlugin has no virtual FS and every stat fails). It leaves an `appbuild.done`
marker when the image has been written.

    cat pharo/app-startup.st pharo/app-snapshot.st > startup.st

WHERE THIS STANDS: the image it writes resumes straight into the application -- no menubar,
no taskbar, no Welcome window -- and answers the mouse. What it does not do is animate on its
own: Morphic runs a burst of cycles whenever an event arrives and stands still in between, so
the bubbles only move when you touch them. Until that is solved the published bundle is the
boot-built one (app-startup.st alone as startup.st), which takes longer to appear but is
fully alive. README.md records what was measured and what was ruled out.

This is SessionManager>>launchSnapshot:andQuit: written out by hand, and each piece is here
for a reason:

 - `Smalltalk snapshotPrimitive` alone writes an image that comes back completely frozen: it
   never re-registers its input semaphore, its delay timer or its display with the VM. The
   session restart around the primitive -- stop: before, installNewSession + start: after --
   is what does that. Writing the image between the two also keeps it clean, since this run
   gets Pharo's chrome back when its own session restarts and the saved image never sees it.
 - It runs inside DefaultExecutionEnvironment, the way SmalltalkImage>>snapshot:andQuit:
   arranges it, and the deferred startup actions run in the CALLING process afterwards.
 - Calling Pharo's own snapshot:andQuit: instead would be tidier, but its ChangesLog
   bookkeeping writes to files the browser FS does not provide, and stubbing that method out
   from a chunk file kills the rest of the script."!

"Let the app settle, then sweep the desktop one last time: Pharo's startup notices (missing
.sources, no TFFI callbacks) arrive late and would otherwise be frozen into the image, where
they are far more annoying -- they come back on every single run."
(Smalltalk at: #SqjsLog) value: 'snapshot-chunk'.
(Delay forMilliseconds: 3000) wait.
(Smalltalk at: #SqjsSweep) value.
(Delay forMilliseconds: 800) wait.
(Smalltalk at: #SqjsSweep) value.
World changed.
(Delay forMilliseconds: 400) wait.
!

| done resuming mgr |
done := Semaphore new.
resuming := false.
mgr := SessionManager default.
[ [ DefaultExecutionEnvironment beActiveDuring: [
      [ mgr currentSession stop: false.
        "The last moment before the write: let go of the .sources file. The build has it
         open and the published bundle does not ship it, and an image saved holding it open
         spends 133 full GCs -- some 20 seconds -- failing to reopen it on every boot.
         app-startup.st, where SqjsDropSources is defined, tells the whole story."
        (Smalltalk at: #SqjsDropSources) value.
        resuming := Smalltalk snapshotPrimitive == true.
        resuming ifTrue: [ mgr installNewSession ].
        mgr currentSession start: resuming ]
	    on: Error do: [ :e | [ mgr currentSession start: resuming ] on: Error do: [ :e2 | ] ] ] ]
    on: Error do: [ :e | ].
  done signal ] forkAt: Processor timingPriority - 1.
done wait.

"SessionManager runs these in the calling process once launchSnapshot: returns"
[ mgr currentSession executeDeferredStartupActions: resuming ] on: Error do: [ :e | ].

"Restarting the session runs Pharo's startup list again, which can raise those same notices
on the resumed image; sweep them there too."
resuming ifTrue: [
	[ 1 to: 6 do: [ :i |
		(Delay forMilliseconds: 700) wait.
		(Smalltalk at: #SqjsSweep) value ] ] forkAt: Processor userBackgroundPriority ].

(Smalltalk at: #SqjsLog) value: 'snapshot-done resuming=', resuming printString.

"the marker the build script waits for; the resumed image must not touch it"
resuming ifFalse: [
	[ | out |
	  out := (FileLocator workingDirectory / 'appbuild.done') writeStream.
	  out nextPutAll: 'snapshot=saved'; flush; close ] on: Error do: [ :e | ] ].
!
