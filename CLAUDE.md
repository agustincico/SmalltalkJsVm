# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SqueakJS is a Squeak/OpenSmalltalk virtual machine implemented in pure JavaScript, runnable in
the browser, headless in a browser, or under Node.js. It loads real Squeak `.image` files
(from the 1996 Squeak release through modern 64-bit Spur/Sista images) and interprets their
bytecode directly — there is no separate C VM being ported, this JS *is* the VM.

## Commands

- `npm start` — serve the repo with `http-server`, opening `run/` (drag-and-drop image launcher).
- `npm run dev` — serve the repo without auto-opening a page.
- `npm run build` — clean `dist/`, bundle `squeak.js`/`squeak_headless.js` with Rollup into
  `dist/squeak_bundle.js` / `dist/squeak_headless_bundle.js`, then minify with uglify-js
  (produces the `.min.js` + source maps). Use `npm run build:bundle` / `build:minify` to run a
  single step.
- Run an image from the CLI: `node squeak_node.js headless/headless.image` (add `-ignoreQuit` to
  stop the image from quitting when it detects no display).
- No lint script exists.
- Tests (`tests/`) run under Karma + Chrome and execute SUnit tests *inside* a Squeak test image:
  `cd tests && npm install && npm test`. This requires `tests/resources/{test.image,test.changes,
  SqueakV50.sources}`, which are NOT checked into the repo — `.travis.yml` fetches them from a
  now-defunct Bintray URL, so this suite will not run out of the box without sourcing that image
  another way. There's no way to run "a single test" from the JS side — the test selection lives
  in `tests/resources/tests.st` / `tests.ston` on the Smalltalk side.

## Architecture

### Module system

There's no bundler-driven module graph for the core VM: `globals.js` polyfills a tiny
Lively-Kernel-style class system on top of plain JS —`Function.prototype.subclass('Some.Path.Name', {...})`
creates a constructor and installs it into a namespace object (`Squeak` by convention), and
`Object.extend(target, {...}, {...}, ...)` copies properties onto an existing object/prototype
(used to add grouped categories of methods/constants to `Squeak` and to interpreter/object
prototypes). Expect to see `Object.subclass('Squeak.Foo', {...}, {...})` and
`Squeak.Foo.subclass('Squeak.Bar', {...})` throughout the `vm.*.js` files instead of ES classes.

Entry points wire the pieces together with plain imports/requires, in a load order that matters
(later files depend on globals/classes defined earlier):
- `squeak.js` — browser build (ES modules), the full VM + all internal/external plugins + display/input/audio/file browser backends.
- `squeak_headless.js` — same VM, headless display/input backends, no canvas/DOM UI.
- `squeak_node.js` — Node.js CLI runner; shims `self`/`localStorage`/`WebSocket`/`btoa`/`atob` onto `global` so the same browser-oriented VM code runs unmodified, then `fs.readFile`s the `.image` and drives the interpreter loop with `setTimeout`.
- `squeak_lively.js` — integration for the Lively Kernel environment (see `lively/`).

### Core VM pipeline (the `vm.*.js` files)

- `vm.js` — `Squeak` namespace: version info, object header bit layout, the `splOb_*` special-object-array indices, module registry (`Squeak.registerExternalModule`), time/utility helpers.
- `vm.object.js` / `vm.object.spur.js` — the two object memory representations. Pre-Spur images use `Squeak.Object`; Spur images (detected from the image version header) use `Squeak.ObjectSpur`, a subclass with a different header/class-table layout. Which one is instantiated is decided in `vm.image.js` based on `this.isSpur`.
- `vm.image.js` — parses a raw `.image` file buffer into live `Squeak.Object`/`ObjectSpur` graphs (`Squeak.Image`), handling both old and Spur/64-bit segment formats.
- `vm.interpreter.js` — `Squeak.Interpreter`: the bytecode interpreter proper, `interpret(forMilliseconds, thenDo)` is the driven-from-outside run loop (each host, browser or Node, re-schedules it via timers so it never blocks the event loop).
- `vm.interpreter.proxy.js` — the "interpreterProxy"/VM-proxy interface plugins use to read/push the stack, allocate objects, etc. (mirrors the C VM's plugin API).
- `vm.instruction.stream.js` / `.sista.js` / `vm.instruction.printer.js` — bytecode decoding (classic and Sista bytecode sets) and a disassembler.
- `vm.primitives.js` — `Squeak.Primitives`: built-in primitives plus the dispatcher that loads external plugin modules by name on first use (`Squeak.externalModules[name] || builtinModules[name] || loadModuleDynamically(name)`).
- `jit.js` — optional just-in-time compiler; per the README it currently only removes bytecode-decode overhead, it does not do real optimization. Can be omitted/replaced.
- `vm.display.*`, `vm.input.*`, `vm.audio.browser.js`, `vm.files.browser.js` — platform backends. Each has a browser and (for display/input) a headless variant; pick the pair matching the host environment (see how `squeak_node.js` requires the `*.headless.js` variants instead of `*.browser.js`).

### Plugins

Two kinds, both registered the same way (`Squeak.registerExternalModule(name, moduleObject)`,
looked up from Smalltalk by primitive `module:` name):
- Internal plugins (`vm.plugins.*.js` at the repo root) — hand-written, always loaded.
- External plugins (`plugins/*.js`) — most are **auto-generated JS** translated from Smalltalk
  VMMaker plugin source by the `JSPluginCodeGenerator`/`JSSmartSyntaxPluginCodeGenerator` in
  `utils/VMMakerJS.package` (a Squeak/Monticello filetree package, edited from within Squeak, not
  as ordinary JS). Generated files carry a header comment naming the generator and source
  Monticello version — treat those as build output: fixing a bug in one ideally means fixing the
  Smalltalk source and regenerating, not hand-patching the JS (hand-patches will look like they
  drifted from "generated by" provenance and will be silently blown away by a future regen). A
  few plugins (e.g. `SocketPlugin.js`, `ScratchPlugin.js`, `MIDIPlugin.js`) are hand-written
  JS, not generated — check for the generator header comment to tell which is which.
  External plugins load lazily: in the browser they must already be `import`ed/present; in
  Node, `squeak_node.js` overrides `loadModuleDynamically` to `require("./plugins/" + modName)`
  on demand.
- `demo/SimplePlugin.js` is a minimal template for writing a new external plugin by hand.
- `ffi/*.js` (`libc.js`, `opengl.js`) are FFI call-out libraries used via `vm.plugins.ffi.js`.

### Smalltalk-side sources (`utils/*.package`)

`utils/VMMakerJS.package`, `JSBridge-Core.package`, `SqueakJS-Testing.package`,
`BaselineOfSqueakJS.package` are Monticello filetree packages meant to be loaded into a Squeak
image, not built by any JS tooling here. They're the source of truth for: generating
`plugins/*.js` (VMMakerJS), the JS↔Smalltalk bridge used by `demo/JSBridge.st` /
`lib/JSBridge` code (JSBridge-Core), and in-image SUnit tests (SqueakJS-Testing).
`utils/mksqindex.py` builds `sqindex.json` directory listings consumed by the in-browser file
plugin.

### Interfaces / demos (each is a mostly-independent HTML entry point over the same VM)

`run/` (generic drag-and-drop image launcher), `demo/` (minimal example + `SimplePlugin.js`),
`etoys/`, `scratch/` (bundled images for those environments), `benchmark/`, `headless/`
(minimal headless example image), `lively/` (Lively Kernel integration, has its own
Dockerfile/README), `standalone/` (nw.js desktop wrapper), `ws/` (WebSocket server/client pair
for an interactive shell into a running Cuis/Squeak image — see `ws/README` workflow of
`start_server.sh` + `start_client.sh`).

### Distribution

`dist/squeak_bundle.js` / `dist/squeak_headless_bundle.js` (+ `.min.js`) are Rollup/uglify build
output for consumers who want a single-file, non-ES-module VM (e.g. `unpkg`/`jsdelivr` CDN use,
non-module `<script>` tags). Regenerate with `npm run build`; don't hand-edit.
