SmalltalkJsVm: Squeak, Pharo and Cuis in the browser
====================================================

A Smalltalk virtual machine written in pure JavaScript, running real `.image` files in a
browser tab — no plugin, no server doing the work. Live at **[smalltalkjsvm.com.ar][site]**.

This is a fork of **[SqueakJS][upstream]**, written by **Vanessa Freudenberg**, who showed a
decade ago that a full Smalltalk VM could live in a web page. The interpreter, the object
memories, BitBlt and the plugin machinery are hers; everything below is what this fork adds
on top.

What this fork adds
-------------------

**Pharo runs here.** Versions 10 through 13, 32- and 64-bit, boot to a clean, interactive
world — including the image the Pharo Launcher installs today. That took a dozen VM fixes
(64-bit indexable arrays, the Sista `push thisProcess` bytecode, file-attribute and
working-directory primitives, semaphores that accept subclasses, a `wordSize` that 64-bit
Pharo reads from a class variable) plus startup scripts that give the 64-bit builds back the
display and event classes they dropped when they moved to SDL2. See [pharo/README.md](pharo/)
for how those work and how the Morphic demo image is built.

**Cuis 7.x runs here**, once the VM learned the 16- and 64-bit array formats the newer images
use, gained `primitiveGet/SetWorkingDirectory`, and started falling back to the plain
interpreter when the JIT hits a bytecode it mishandles instead of killing the image.

**A Web Worker runtime.** `squeak_worker.js` runs the VM off the main thread, drawing on an
OffscreenCanvas, so the page keeps answering while the image works. It carries the pieces a
worker has no access to on its own: the file system's directory listing is passed in from the
host, saved images come back out to Downloads, and input, cursor, clipboard, sound, resize and
drag-and-drop are forwarded both ways. See [WORKER.md](WORKER.md).

**A launcher that fits the image to the VM.** [run/index.html](run/) reads a dropped `.image`
to see which Pharo compatibility script it needs and installs it, downloads bundles and
multi-file image sets, and clears a startup script left behind by a previous run so it cannot
leak into the next image.

**The site.** [utils/mk-site.py](utils/mk-site.py) builds the standalone tree published at
smalltalkjsvm.com.ar: the launcher, exactly the VM modules it imports, and the compatibility
scripts. No image is hosted — every example links the build its own project publishes, through
[a small CORS worker](utils/cors-worker.js) for the two servers that send no CORS headers.

Running it
----------

**In a browser.** Serve the repository and open `run/`:

    npx serve          # or: npm start

then drag a Smalltalk image onto the page (with its `.changes` and `.sources` if it has them),
or pick one of the examples. A local web server is needed because images are loaded with
`fetch`, which does not work from a `file:` URL.

**From the command line.** `node squeak_node.js headless/headless.image` — add `-ignoreQuit`
to stop the image quitting when it finds no display.

**Bundled.** `dist/squeak_bundle.js` and `dist/squeak_headless_bundle.js` are single-file
builds for pages that cannot use ES modules; `npm run build` regenerates them.

How it is put together
----------------------

There is no bundler for the core VM. `globals.js` installs a small Lively-Kernel-style class
system — `Object.subclass('Squeak.Foo', {...})` and `Object.extend(target, {...})` — and the
entry points load the pieces in an order that matters:

| | |
|---|---|
| `vm.js` | the `Squeak` namespace: object header layout, special-object indices, module registry |
| `vm.object.js`, `vm.object.spur.js` | the two object memory representations; Spur images use the second |
| `vm.image.js` | parses a raw `.image` into a live object graph, old and Spur/64-bit formats |
| `vm.interpreter.js` | the bytecode interpreter; `interpret(ms, thenDo)` is driven from outside so it never blocks the event loop |
| `vm.primitives.js` | built-in primitives and the dispatcher that loads plugins by name |
| `jit.js` | optional JIT — it removes bytecode-decode overhead, it does not optimize |
| `vm.display.*`, `vm.input.*`, `vm.files.browser.js` | platform backends, browser and headless variants |

Plugins come in two kinds, both registered with `Squeak.registerExternalModule`: the
hand-written internal ones (`vm.plugins.*.js`) and the external ones in `plugins/`, most of
which are **generated** from Smalltalk VMMaker source by the code generator in
`utils/VMMakerJS.package` — those carry a header naming their generator, and fixing a bug in
one means fixing the Smalltalk source and regenerating, not patching the JavaScript.

Contributing
------------

Bug reports and pull requests welcome. Fixes that belong to the engine itself are better sent
[upstream][upstream], where they help everyone using SqueakJS.

Credits
-------

SqueakJS is by Vanessa Freudenberg (codefrau) and its contributors; the engine's own history
is in [the upstream changelog][changelog]. The Pharo and Cuis 7.x compatibility work, the Web
Worker runtime and the launcher in this fork are by Agustín Martínez. MIT licensed, like the
original — see [LICENSE.md](LICENSE.md).

  [site]:      https://smalltalkjsvm.com.ar/
  [upstream]:  https://github.com/codefrau/SqueakJS
  [changelog]: https://github.com/codefrau/SqueakJS/blob/main/README.md#changelog
  [squeak]:    https://squeak.org/
