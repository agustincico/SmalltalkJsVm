// Generic SqueakJS Web Worker entry point (ES module). Runs the VM OFF the main thread,
// rendering to an OffscreenCanvas and receiving input via postMessage, so the page stays
// responsive (no freeze / no "ruedita") and the VM gets a dedicated core.
//
// Used by run/ (#worker mode) and the perf/worker spike. All config arrives in the
// "init" message: { canvas, width, height, image, name?, templates?, headRoom?, nostream? }
// where `image` is either an ArrayBuffer (the .image bytes) or a URL string to fetch,
// and `templates` is an optional { root, url } to preload app files (Etoys/Scratch/etc.).
//
// Shims: a worker has `self` but no window/document/localStorage/prompt/alert/confirm.
// The VM core only uses `self`; file plugins use window/localStorage → point them at self
// (indexedDB works in workers). prompt/confirm return null so the low-space path signals
// the image gracefully instead of throwing; alert goes to the console.
self.window = self;
self.localStorage = {};
self.prompt = function() { return null; };
self.confirm = function() { return false; };
self.alert = function(msg) { console.warn("[squeak alert]", msg); };

import "./globals.js";
import "./vm.js";
import "./vm.object.js";
import "./vm.object.spur.js";
import "./vm.image.js";
import "./vm.interpreter.js";
import "./vm.interpreter.proxy.js";
import "./vm.instruction.stream.js";
import "./vm.instruction.stream.sista.js";
import "./vm.instruction.printer.js";
import "./vm.primitives.js";
import "./jit.js";
import "./vm.stackzone.js";
import "./jit2.js";
import "./vm.display.js";
import "./vm.display.browser.js"; // display primitives (scanCharacters etc.); DOM/render bits overridden below
import "./vm.input.js";
import "./vm.plugins.js";
import "./vm.plugins.file.browser.js";
import "./vm.files.browser.js";
import "./plugins/BitBltPlugin.js";
import "./plugins/LargeIntegers.js";
import "./plugins/MiscPrimitivePlugin.js";
import "./plugins/FloatArrayPlugin.js";
import "./plugins/B2DPlugin.js";
import "./plugins/Matrix2x3Plugin.js";
import "./plugins/ZipPlugin.js";
import "./vm.plugins.jpeg2.browser.js"; // defines the jpeg2_* functions (module is builtin but empty without this)

var display = null, ctx = null, vm = null;

// --- display + input backend for the worker ---
// Most of vm.display.browser.js's display primitives are already worker-safe: their DOM
// branches are guarded by this.display.cursorCanvas / fullscreenRequest / highdpi (which
// we never set), and they render to the OffscreenCanvas via this.display.context (the
// showForm/showDisplayBits path). So we don't reimplement them — the real
// deferDisplayUpdates batching runs. We only override what genuinely touches DOM/audio
// (beep/clipboard, screenDepth which is headless-only) and INPUT: in the browser it
// arrives via DOM listeners; here it arrives via postMessage → an event queue.
Object.extend(Squeak.Primitives.prototype, "worker-display", {
    primitiveScreenDepth: function(argCount) { return this.popNandPushIfOK(argCount + 1, 32); },
    primitiveBeep: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveClipboardText: function(argCount) { return false; },
    // Image-managed cursor (desktop parity): render the cursor form to an OffscreenCanvas
    // with showForm and post the ImageBitmap + hotspot to the main thread, which sets it
    // as a native CSS cursor (url(...) hotX hotY) — hardware-drawn, perfect tracking, no
    // overlay. Squeak's form offset is negative (added to the mouse pos) → CSS hotspot is
    // -offset, clamped into the image.
    primitiveBeCursor: function(argCount) {
        try {
            var cursorForm = this.loadForm(this.stackNonInteger(argCount), true),
                maskForm = argCount === 1 ? this.loadForm(this.stackNonInteger(0)) : null;
            if (this.success && cursorForm) {
                var w = cursorForm.width, h = cursorForm.height,
                    oc = new OffscreenCanvas(w, h), octx = oc.getContext("2d"),
                    bounds = { left: 0, top: 0, right: w, bottom: h }, form = cursorForm;
                if (form.depth === 1) {
                    if (maskForm) { form = this.cursorMergeMask(form, maskForm);
                        this.showForm(octx, form, bounds, [0x00000000, 0xFF0000FF, 0xFFFFFFFF, 0xFF000000]);
                    } else this.showForm(octx, form, bounds, [0x00000000, 0xFF000000]);
                } else this.showForm(octx, form, bounds, true);
                var bmp = oc.transferToImageBitmap();
                self.postMessage({ type: "cursor", bitmap: bmp,
                    hotX: Math.max(0, Math.min(w - 1, -(form.offsetX | 0))),
                    hotY: Math.max(0, Math.min(h - 1, -(form.offsetY | 0))) }, [bmp]);
            }
        } catch (e) { /* if it fails, keep the previous cursor */ }
        this.vm.popN(argCount);
        return true;
    },
    // input
    primitiveInputSemaphore: function(argCount) {
        var idx = this.stackInteger(0); if (!this.success) return false;
        this.inputEventSemaIndex = idx;
        display.signalInputEvent = function() { this.signalSemaphoreWithIndex(this.inputEventSemaIndex); }.bind(this);
        return this.popNIfOK(argCount);
    },
    primitiveInputWord: function(argCount) { return this.popNandPushIfOK(1, 0); },
    primitiveGetNextEvent: function(argCount) {
        var evtBuf = this.stackNonInteger(0).pointers;
        var evt = display.eventQueue.shift();
        if (evt) { evtBuf[0] = evt[0]; evtBuf[1] = evt[1] & 0x1FFFFFFF; for (var i = 2; i < evt.length; i++) evtBuf[i] = evt[i]; }
        else evtBuf[0] = 0;
        return this.popNIfOK(argCount);
    },
    primitiveMouseButtons: function(argCount) { return this.popNandPushIfOK(argCount + 1, this.ensureSmallInt(display.buttons | 0)); },
    primitiveMousePoint: function(argCount) { return this.popNandPushIfOK(argCount + 1, this.makePointWithXandY(display.mouseX | 0, display.mouseY | 0)); },
    primitiveKeyboardNext: function(argCount) { return this.popNandPushIfOK(argCount + 1, display.keys.length ? this.ensureSmallInt(display.keys.shift()) : this.vm.nilObj); },
    primitiveKeyboardPeek: function(argCount) { return this.popNandPushIfOK(argCount + 1, display.keys.length ? this.ensureSmallInt(display.keys[0]) : this.vm.nilObj); },
});

// Worker-safe JPEG: jpeg2.browser decodes with `new Image()` + a DOM <canvas>, neither of
// which exists in a worker. Override just the 2 DOM read functions with createImageBitmap
// (the browser's native JPEG decoder, available in workers) + OffscreenCanvas. The rest of
// the plugin (async freeze, copyPixelsToForm*) is pure JS and reused as-is.
Object.extend(Squeak.Primitives.prototype, "jpeg2-worker-overrides", {
    jpeg2_readImageFromBytes: function(bytes, thenDo, errorDo) {
        createImageBitmap(new Blob([bytes], { type: "image/jpeg" }))
            .then(function(bmp) { thenDo(bmp); })
            .catch(function() { errorDo(); });
    },
    jpeg2_getPixelsFromImage: function(image) {
        var canvas = new OffscreenCanvas(image.width, image.height),
            context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
    },
});

self.onmessage = function(e) {
    var msg = e.data;
    if (msg.type === "init") {
        ctx = msg.canvas.getContext("2d");
        // context: used by vm.display.browser.js's render path (showForm/showDisplayBits)
        display = { width: msg.width, height: msg.height, context: ctx, mouseX: msg.width >> 1, mouseY: msg.height >> 1,
                    buttons: 0, keys: [], eventQueue: [], signalInputEvent: null };
        // The FilePlugin keeps its DIRECTORY structure in localStorage (Squeak.Settings),
        // but a worker has no localStorage — so the host passes it in and we seed it here.
        // (File CONTENTS live in IndexedDB, which is shared across the origin, so those
        // come through on their own.) Without this the worker sees an empty FS → no saved
        // projects. We remember it as the baseline for change detection on sync-back.
        if (msg.settings) {
            Object.assign(Squeak.Settings, msg.settings);
            console.log("squeak_worker: seeded FS with " + Object.keys(Squeak.Settings).filter(function(k){ return k.indexOf("squeak:") === 0; }).length + " directory entries from host");
        }
        boot(msg);
    } else if (msg.type === "event") {
        var ev = msg.ev;
        if (ev[0] === 1) { display.mouseX = ev[2]; display.mouseY = ev[3]; display.buttons = ev[4]; }
        else if (ev[0] === 2) display.keys.push((ev[4] << 8) | ev[2]); // keyboard: also feed the polling interface (Sensor, for modals)
        display.eventQueue.push(ev);
        if (display.signalInputEvent) display.signalInputEvent();
    }
};

var BUILD = "squeak_worker v1";
function boot(opts) {
    Object.extend(Squeak, { vmPath: "/", platformSubtype: "Worker", osVersion: "worker", windowSystem: "worker" });
    // Optional app template files (Etoys/Scratch/Dialogo): lazy XHR into the worker FS.
    var useTemplates = !!(opts.templates && opts.templates.url);
    if (useTemplates) Squeak.fetchTemplateDir(opts.templates.root || "/", opts.templates.url);
    // image can be ArrayBuffer bytes (from the launcher's IndexedDB) or a URL string.
    var getData = typeof opts.image === "string"
        ? fetch(opts.image).then(function(r) { return r.arrayBuffer(); })
        : Promise.resolve(opts.image);
    getData.then(function(data) {
        // When using templates, wait a beat so the template XHRs register the directory
        // structure before the image enumerates its projects at startup (avoids a race).
        setTimeout(function() {
            var image = new Squeak.Image(opts.name || "SqueakJS");
            // More headroom than the 100MB default: opening a big project spikes transient
            // allocation (image decode + morph rebuild); 512MB lets the peak fit and the GC
            // reclaim it. Headroom is only a threshold (memory grows on demand).
            image.headRoom = opts.headRoom || 512000000;
            image.readFromBuffer(data, function() {
                vm = new Squeak.Interpreter(image, display);
                if (opts.nostream) vm.primHandler.streamPrims = false; // A/B: disable stream prims 65/66/67
                self.postMessage({ type: "ready", build: BUILD });
                function run() {
                    try { vm.interpret(50, function(ms) { setTimeout(run, ms === "sleep" ? 10 : ms); }); }
                    catch (err) { self.postMessage({ type: "error", msg: String(err && err.stack || err) }); }
                }
                run();
                // No separate render timer: rendering is driven by the real displayDirty →
                // showForm path (respects Morphic's deferDisplayUpdates, so no mid-draw
                // frames → no flicker). This interval only posts status.
                setInterval(function() { self.postMessage({ type: "tick", sends: vm.sendCount }); }, 250);
                // Persist FS changes back to the host: the worker's directory updates live
                // in its in-memory Squeak.Settings (no real localStorage), so files it
                // creates would be orphaned in IndexedDB after a reload. Send the settings
                // snapshot whenever it changes; the host writes it to localStorage.
                var lastSettings = "";
                setInterval(function() {
                    var snap = {};
                    for (var k in Squeak.Settings) if (typeof Squeak.Settings[k] === "string") snap[k] = Squeak.Settings[k];
                    var ser = JSON.stringify(snap);
                    if (ser !== lastSettings) { lastSettings = ser; self.postMessage({ type: "settings", settings: snap }); }
                }, 700);
            });
        }, useTemplates ? 800 : 0);
    }).catch(function(err) { self.postMessage({ type: "error", msg: "load: " + err }); });
}
