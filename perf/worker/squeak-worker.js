// Web Worker (module) que corre el VM de SqueakJS FUERA del hilo principal,
// renderizando a un OffscreenCanvas y recibiendo input por postMessage.
// Spike del "puente" Web Worker: el VM usa 100% de un core en background y el
// hilo principal (canvas/input/página) queda responsive → no freeze, no ruedita.
//
// Shims: en un worker existe `self` pero no `window`/`document`/`localStorage`.
// El core del VM solo usa `self`; los plugins de archivo usan `window`/localStorage
// → los apuntamos a `self` (indexedDB SÍ existe en workers).
self.window = self;
self.localStorage = {};

import "../../globals.js";
import "../../vm.js";
import "../../vm.object.js";
import "../../vm.object.spur.js";
import "../../vm.image.js";
import "../../vm.interpreter.js";
import "../../vm.interpreter.proxy.js";
import "../../vm.instruction.stream.js";
import "../../vm.instruction.stream.sista.js";
import "../../vm.instruction.printer.js";
import "../../vm.primitives.js";
import "../../jit.js";
import "../../vm.stackzone.js";
import "../../jit2.js";
import "../../vm.display.js";
import "../../vm.input.js";
import "../../vm.plugins.js";
import "../../vm.plugins.file.browser.js";
import "../../vm.files.browser.js";
// plugins esenciales para Morphic (BitBlt = render; el resto lo usa Dialogo).
// Se omiten los con deps de DOM puro (jpeg2 usa Image/canvas del documento).
import "../../plugins/BitBltPlugin.js";
import "../../plugins/LargeIntegers.js";
import "../../plugins/MiscPrimitivePlugin.js";
import "../../plugins/FloatArrayPlugin.js";
import "../../plugins/B2DPlugin.js";
import "../../plugins/Matrix2x3Plugin.js";
import "../../plugins/ZipPlugin.js";

var display = null, ctx = null, vm = null;

// --- backend de display+input para el worker (OffscreenCanvas + cola de eventos) ---
Object.extend(Squeak.Primitives.prototype, "worker-display", {
    primitiveScreenSize: function(argCount) {
        return this.popNandPushIfOK(argCount + 1, this.makePointWithXandY(display.width, display.height));
    },
    primitiveScreenDepth: function(argCount) { return this.popNandPushIfOK(argCount + 1, 32); },
    primitiveScreenScaleFactor: function(argCount) { return this.popNandPushIfOK(argCount + 1, 1); },
    primitiveBeDisplay: function(argCount) {
        this.vm.specialObjects[Squeak.splOb_TheDisplay] = this.vm.stackValue(0);
        this.vm.popN(argCount); return true;
    },
    primitiveDeferDisplayUpdates: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveForceDisplayUpdate: function(argCount) { renderDisplay(); this.vm.popN(argCount); return true; },
    primitiveShowDisplayRect: function(argCount) { renderDisplay(); this.vm.popN(argCount); return true; },
    primitiveReverseDisplay: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveSetFullScreen: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveBeCursor: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveTestDisplayDepth: function(argCount) { return this.popNandPushIfOK(argCount + 1, this.vm.trueObj); },
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
    primitiveBeep: function(argCount) { return true; },
    primitiveClipboardText: function(argCount) { return false; },
});

function renderDisplay() {
    var disp = vm.specialObjects[Squeak.splOb_TheDisplay];
    if (!disp || !disp.pointers) return;
    var bits = disp.pointers[0], w = disp.pointers[1], h = disp.pointers[2];
    if (!bits || !bits.words || !w || !h) return;
    var words = bits.words, n = Math.min(words.length, w * h);
    var img = ctx.createImageData(w, h), dst = new Uint32Array(img.data.buffer);
    for (var i = 0; i < n; i++) {
        var argb = words[i];
        dst[i] = (argb & 0xFF00FF00) | ((argb & 0x00FF0000) >> 16) | ((argb & 0x000000FF) << 16) | 0xFF000000;
    }
    ctx.putImageData(img, 0, 0);
}

self.onmessage = function(e) {
    var msg = e.data;
    if (msg.type === "init") {
        ctx = msg.canvas.getContext("2d");
        display = { width: msg.width, height: msg.height, mouseX: msg.width >> 1, mouseY: msg.height >> 1,
                    buttons: 0, keys: [], eventQueue: [], signalInputEvent: null };
        boot(msg.image);
    } else if (msg.type === "event") {
        var ev = msg.ev;
        if (ev[0] === 1) { display.mouseX = ev[2]; display.mouseY = ev[3]; display.buttons = ev[4]; }
        display.eventQueue.push(ev);
        if (display.signalInputEvent) display.signalInputEvent();
    }
};

function boot(imageUrl) {
    Object.extend(Squeak, { vmPath: "/", platformSubtype: "Worker", osVersion: "worker", windowSystem: "worker" });
    fetch(imageUrl).then(function(r) { return r.arrayBuffer(); }).then(function(data) {
        var image = new Squeak.Image("Dialogo");
        image.readFromBuffer(data, function() {
            vm = new Squeak.Interpreter(image, display);
            self.postMessage({ type: "ready" });
            function run() {
                try { vm.interpret(50, function(ms) { setTimeout(run, ms === "sleep" ? 10 : ms); }); }
                catch (err) { self.postMessage({ type: "error", msg: String(err && err.stack || err) }); }
            }
            run();
            // render decoplado del VM: copiar el Display Form al canvas ~30fps,
            // sin depender de que la imagen llame forceDisplayUpdate
            setInterval(function() {
                renderDisplay();
                self.postMessage({ type: "tick", sends: vm.sendCount });
            }, 33);
        });
    }).catch(function(err) { self.postMessage({ type: "error", msg: "fetch: " + err }); });
}
