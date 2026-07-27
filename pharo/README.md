# Pharo support for SqueakJS

Two startup scripts live here. Both use Pharo's own mechanism: name the file `startup.st`,
place it next to the `.image`, and `StartupPreferencesLoader` runs it at boot. The hosted
zip bundles ship them that way.

State of Pharo support (see `../ESTADO.md` for the full picture):

- **32-bit** — boots clean and is fully interactive. This is the build to show.
- **64-bit** — boots clean and renders, but mouse events don't reach Morphic yet
  (keyboard does). Experimental.

Pharo's git integration (Iceberg → libgit2 through native FFI) used to open a post-mortem
debugger over an otherwise healthy world on *both* builds. The VM now neuters
`LGitLibrary class>>startUp:` (see `hackImage` in `../vm.interpreter.js`), so Pharo runs
git-less — exactly as on a machine without libgit2. No image patching needed.

## `startup-compat64.st`

Restores, at image startup, the classic VM display/input classes that Pharo's **64-bit**
builds no longer ship (they render exclusively through SDL2/OSWindow via native FFI,
which does not exist in the browser):

- `EventSensorConstants`, `InputEventHandler`, `InputEventSensor`, `InputEventFetcher`
  (classic VM event polling), the classic `HandMorph` event-queue methods,
- the classic `DisplayScreen` protocol (`beDisplay`, `forceToScreen:` …),
- `VMWorldRenderer` + its update modes (rendering via Display/BitBlt),
- cursor primitives (`beCursor`, `beCursorWithMask:`),

all extracted verbatim from the Pharo 10 32-bit build (which still ships them), then
reinstalls the UI (`UIManager default:` after clearing `MainWorldRenderer`).

**Usage:** ships inside `Pharo64.zip`. 32-bit images don't need it.

**Known gap:** this restores the *polling* `Sensor`, but the 64-bit builds route the mouse
through OSWindow's event-driven model, so clicks don't reach Morphic. The worker delivers
events identically for 32- and 64-bit (verified), so the remaining gap is image-side.

## `demo-startup.st`

A small self-contained Morphic app, so visitors see a real Pharo application running (and
animating) in the browser rather than just the IDE. Closes the Welcome window, draws a
caption next to Pharo's desktop logo, and bounces 14 balls around the world. Core Morphic
only — no FFI, no network. The full IDE stays one menu-bar click away.

**Usage:** publish `Pharo-demo.zip` = the contents of `Pharo.zip` plus this file renamed to
`startup.st` at the root of the zip.

**Gotcha worth keeping:** the animation process must run at `userSchedulingPriority - 1` and
invalidate explicitly (`m changed` per ball, then `world changed` per frame). Forking it at
`userBackgroundPriority` never got scheduled — the balls rendered once and stayed frozen.
