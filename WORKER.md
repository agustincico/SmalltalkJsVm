# SqueakJS — Web Worker mode & usability additions

This fork keeps [SqueakJS](https://github.com/codefrau/SqueakJS) (the pure-JavaScript
Squeak VM by Vanessa Freudenberg) intact and adds a **Web Worker mode** plus a set of
usability features, so real Squeak/Cuis apps — the driver here is **Dialog.ar**, a
children's drawing app on Cuis — run smoothly in the browser, on desktop and mobile.

The launcher lives in [`run/`](run/); the worker VM is [`squeak_worker.js`](squeak_worker.js).

## What's new

### Run the VM off the main thread (no more freeze / "ruedita")
The classic SqueakJS runs the interpreter on the page's main thread, cooperatively
yielding via timers. Heavy moments (a big GC, a large BitBlt, deserializing a project)
still block the page — the browser shows a spinner and input stalls.

**Worker mode** runs the whole VM in a `Web Worker`, rendering to an `OffscreenCanvas`
and receiving input by `postMessage`. The page's main thread stays free, so it never
freezes and the VM effectively gets its own core.

Tick the *"Run in a Web Worker"* box in [`run/`](run/), or add `#worker` to the URL.

### General VM speedups (help every image, worker or not)
- **Monomorphic object representation** — all Squeak objects share one JS constructor
  instead of a per-class `new Function`, so V8 keeps one hidden class instead of
  thousands. Collapses megamorphic property access → **~+6.6%** on the Dialog.ar workload.
- **Stream primitives 65/66/67** (`next`/`nextPut:`/`atEnd`) — older images (Cuis) compile
  these, so without them deserializing a project ran entirely in bytecode.
- **LargeInteger arithmetic primitives** (BigInt-backed).
- **Cached primitive-name decoding** in `doNamedPrimitive` (name decoding was ~10% of the
  browser profile).

### Desktop-grade UX in the browser
- **Image-managed cursor** — the Squeak image controls the pointer shape (arrow, hand,
  wait clock…), rendered as a native CSS cursor. No system pointer mismatch.
- **Flicker-free rendering** — render is driven by the image's own dirty-rect / defer
  cycle, so no half-drawn frames.
- **Dynamic resize** — the display follows the window / device rotation.
- **Sound** — audio is streamed from the worker to the main thread's Web Audio.
- **System clipboard** — copy in the image → paste in other apps, and vice-versa.
- **Save to Downloads** — when the image saves a file it lands in the user's Downloads
  folder (turning an inaccessible virtual path into a real, reachable file).
- **Open files** — by drag-and-drop, or a 📂 button that opens the native file picker
  (the way to load files on mobile, where drag-and-drop doesn't exist). The image decides
  whether to accept each file, exactly like the desktop VM.
- **Internet images** — worker mode runs images by URL, not just local ones.

## Architecture

```
 main thread (page)                         Web Worker (squeak_worker.js)
 ┌───────────────────────────┐   init +     ┌──────────────────────────────┐
 │ <canvas> ── transferControl│──Offscreen─▶ │ Squeak VM (interpreter+jit)  │
 │ mouse/keyboard ── postMsg ─┼────events──▶ │ display → OffscreenCanvas 2D  │
 │ Web Audio  ◀── samples ────┼──────────────│ sound plugin → postMessage    │
 │ system clipboard ◀────────▶│──text───────▶│ clipboard prim ↔ display str  │
 │ navigator downloads ◀──────┼──save bytes──│ FilePlugin close hook         │
 │ localStorage (dir tree) ◀─▶│──FS sync────▶│ Squeak.Settings               │
 └───────────────────────────┘              └──────────────────────────────┘
                       IndexedDB (file contents) — shared, same origin
```

Key pieces:

- **Render**: the page transfers its canvas with `transferControlToOffscreen()`; the
  worker draws to it via the standard `vm.display.browser.js` path (`display.context` is
  the OffscreenCanvas 2D context), so dirty-rect batching and all bit depths work
  unchanged.
- **Input**: the page forwards mouse/keyboard/drag events as Squeak event arrays over
  `postMessage`; the worker feeds them into the display's event queue.
- **Filesystem**: file *contents* live in IndexedDB, which is shared across the origin, so
  the worker reads/writes the same store as the page. The *directory tree*, which SqueakJS
  keeps in `localStorage` (unavailable in workers), is snapshotted into the worker at
  startup and synced back on change — so saved projects load and new ones persist.
- **Cursor / audio / clipboard / downloads**: each browser API that is main-thread- or
  gesture-only (`CSS cursor`, `AudioContext`, `navigator.clipboard`, downloads) is bridged
  with a small `postMessage` protocol; the VM primitives run in the worker against local
  state that the host keeps in sync.
- **Worker-safe JPEG**: the DOM JPEG decode (`new Image()` + `<canvas>`) is replaced with
  `createImageBitmap` + `OffscreenCanvas`.

The worker runs the standard interpreter + JIT (`jit.js`). An earlier flat-frame
"stack-zone" / register-JIT exploration was measured and **not adopted** (it did not help
the closure-heavy Morphic workload); it is not part of this branch.

## Benchmark

Main-thread responsiveness while the VM boots and renders Dialog.ar (10 s, headless
Chrome). We sample `requestAnimationFrame` gaps on the **page** thread — a large gap is a
visible stall.

| mode         | avg fps | janky frames (>50 ms) | worst frame |
|--------------|--------:|----------------------:|------------:|
| **worker**   |     60  |                     0 |     18 ms   |
| main thread  |     59  |                     4 |     83 ms   |

Even on this light workload the worker page never drops a frame, while the main-thread
page hitches. On heavier moments (opening a large project) the main-thread page freezes
for **seconds** — the spinner the users complained about — whereas the worker page stays
at 60 fps because the VM isn't on it.

## Credits

Engine by **Vanessa Freudenberg** ([codefrau/SqueakJS](https://github.com/codefrau/SqueakJS)).
Web Worker mode and usability additions by **Agustín Martínez**. MIT licensed.
