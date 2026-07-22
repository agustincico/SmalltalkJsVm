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
import "../../vm.display.browser.js"; // primitivos de display (scanCharacters, etc.); las funciones DOM/render las piso abajo
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
import "../../vm.plugins.jpeg2.browser.js"; // define las funciones jpeg2_* (el módulo JPEGReadWriter2Plugin es builtin pero vacío sin esto)

var display = null, ctx = null, vm = null;

// --- backend de display+input para el worker ---
// La MAYORÍA de los primitivos de display de vm.display.browser.js ya son worker-safe:
// las ramas DOM están guardadas por this.display.cursorCanvas / fullscreenRequest /
// highdpi (que no seteamos) y renderizan al OffscreenCanvas vía this.display.context
// (mismo camino showForm/showDisplayBits). Por eso NO los reimplementamos: dejamos que
// corra el batching real de deferDisplayUpdates. Solo pisamos lo que SÍ toca DOM/audio
// (beep/clipboard, screenDepth que solo existe en headless) y el INPUT: en el browser
// llega por listeners del DOM; acá llega por postMessage → cola de eventos.
Object.extend(Squeak.Primitives.prototype, "worker-display", {
    primitiveScreenDepth: function(argCount) { return this.popNandPushIfOK(argCount + 1, 32); },
    primitiveBeep: function(argCount) { this.vm.popN(argCount); return true; },
    primitiveClipboardText: function(argCount) { return false; },
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

// JPEG worker-safe: jpeg2.browser decodifica con `new Image()` + <canvas> del DOM,
// que no existe en un worker. Se sobrescriben SOLO las 2 funciones DOM de lectura
// con `createImageBitmap` (decoder JPEG nativo del browser, disponible en workers)
// + `OffscreenCanvas`. El resto del plugin (freeze async, copyPixelsToForm*) es
// puro-JS y se reusa tal cual. (El write/encode queda para después.)
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
        // context: lo usa la ruta de render de vm.display.browser.js (showForm/showDisplayBits)
        display = { width: msg.width, height: msg.height, context: ctx, mouseX: msg.width >> 1, mouseY: msg.height >> 1,
                    buttons: 0, keys: [], eventQueue: [], signalInputEvent: null };
        boot(msg.image, msg.notemplates);
    } else if (msg.type === "event") {
        var ev = msg.ev;
        if (ev[0] === 1) { display.mouseX = ev[2]; display.mouseY = ev[3]; display.buttons = ev[4]; }
        else if (ev[0] === 2) display.keys.push((ev[4] << 8) | ev[2]); // teclado: también el polling interface (Sensor, p/ modales)
        display.eventQueue.push(ev);
        if (display.signalInputEvent) display.signalInputEvent();
    }
};

var BUILD = "worker-v6 displayDirty render (no flicker)";
function boot(imageUrl, notemplates) {
    Object.extend(Squeak, { vmPath: "/", platformSubtype: "Worker", osVersion: "worker", windowSystem: "worker" });
    // cargar los archivos de proyecto de Dialogo (lazy, vía XHR) en el FS del worker,
    // igual que #templates en el browser. IndexedDB/XHR funcionan en workers.
    if (!notemplates) Squeak.fetchTemplateDir("/", "/dialogo-fs");
    // esperar a que los XHR de templates registren la estructura de directorios ANTES
    // de que la imagen enumere sus proyectos al arrancar (evita una race consistente)
    fetch(imageUrl).then(function(r) { return r.arrayBuffer(); }).then(function(data) {
      setTimeout(function() {
        var tdirs = Object.keys(self.localStorage).filter(function(k){ return k.indexOf("squeak-template:") === 0; }).length;
        var image = new Squeak.Image("Dialogo");
        image.readFromBuffer(data, function() {
            vm = new Squeak.Interpreter(image, display);
            self.postMessage({ type: "ready", build: BUILD, templateDirs: tdirs });
            function run() {
                try { vm.interpret(50, function(ms) { setTimeout(run, ms === "sleep" ? 10 : ms); }); }
                catch (err) { self.postMessage({ type: "error", msg: String(err && err.stack || err) }); }
            }
            run();
            // NO renderizamos en un timer aparte: el render lo maneja la ruta real
            // displayDirty→showForm (respeta deferDisplayUpdates de Morphic, sin capturar
            // frames a mitad de dibujo → sin flicker). Este intervalo es solo status.
            setInterval(function() {
                var tdirs = Object.keys(Squeak.Settings).filter(function(k){ return k.indexOf("squeak-template:") === 0; }).length;
                self.postMessage({ type: "tick", sends: vm.sendCount, templateDirs: tdirs });
            }, 250);
        });
      }, 800);
    }).catch(function(err) { self.postMessage({ type: "error", msg: "fetch: " + err }); });
}
