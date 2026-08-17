// Corre una imagen Cuis bajo squeakjs/Node pasándole argumentos de línea de comandos
// (squeak_node.js no los pasa; Cuis los lee con getSystemAttribute: 2..n).
//
//   node correr-cuis.js <imagen> [args para la imagen...]      p.ej.  -s probar.st
//
// Copia de squeak_node.js con display.argv y un tope de tiempo.
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = "/private/tmp/claude-501/-Users-agustin-SqueakJS/8ee00768-18c2-4641-a4de-6466e623ea98/scratchpad/rev";
const fullName = require("path").resolve(process.argv[2]); // absoluto: la imagen deriva su directorio de este nombre
const imgArgs = process.argv.slice(3);
const TOPE_MS = +(process.env.TOPE_MS || 300000);
const root = path.dirname(fullName) + path.sep;
const imageName = path.basename(fullName, ".image");

Object.assign(global, {
    self: new Proxy({}, {
        get: (o, p) => global[p],
        set: (o, p, v) => { global[p] = v; return true; },
    }),
});
Object.assign(self, {
    localStorage: {},
    WebSocket: typeof WebSocket === "undefined" ? require(REPO + "/lib_node/WebSocket") : WebSocket,
    sha1: require(REPO + "/lib/sha1"),
    btoa: s => Buffer.from(s, "ascii").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("ascii"),
});

require(REPO + "/globals.js");
require(REPO + "/vm.js");
require(REPO + "/vm.object.js");
require(REPO + "/vm.object.spur.js");
require(REPO + "/vm.image.js");
require(REPO + "/vm.interpreter.js");
require(REPO + "/vm.interpreter.proxy.js");
require(REPO + "/vm.instruction.stream.js");
require(REPO + "/vm.instruction.stream.sista.js");
require(REPO + "/vm.instruction.printer.js");
require(REPO + "/vm.primitives.js");
if (!process.env.NOJIT) require(REPO + "/jit.js");
require(REPO + "/vm.display.js");
require(REPO + "/vm.display.headless.js");
require(REPO + "/vm.input.js");
require(REPO + "/vm.input.headless.js");
require(REPO + "/vm.plugins.js");
require(REPO + "/vm.plugins.file.node");
require(REPO + "/plugins/BitBltPlugin.js");
require(REPO + "/plugins/LargeIntegers.js");
require(REPO + "/plugins/MiscPrimitivePlugin.js");
require(REPO + "/plugins/FloatArrayPlugin.js");

Object.extend(Squeak, {
    vmPath: process.cwd() + path.sep,
    platformSubtype: "Node.js",
    osVersion: process.version + " " + os.platform() + " " + os.release() + " " + os.arch(),
    windowSystem: "none",
});
Object.extend(Squeak.Primitives.prototype, {
    loadModuleDynamically: function(modName) {
        try { require(REPO + "/plugins/" + modName); return Squeak.externalModules[modName]; }
        catch (e) { console.error("Plugin " + modName + " could not be loaded"); }
        return undefined;
    },
});

// SONDA: muestrear la pila Smalltalk cada 700 ms
if (process.env.ESTACA) {
    setInterval(function() {
        try { if (self.__vm) console.error("~~~pila~~~\n" + self.__vm.printStack(null, 8)); }
        catch (e) {}
    }, 700);
}
// SONDA: quién manda el selector CAZA (por método llamador)
if (process.env.CAZA) {
    var caza = process.env.CAZA, porLlamador = new Map();
    var origSend2 = Squeak.Interpreter.prototype.send;
    Squeak.Interpreter.prototype.send = function(selector, argCount, doSuper) {
        if (selector && selector.bytes && selector.bytesAsString() === caza)
            porLlamador.set(this.method, (porLlamador.get(this.method) || 0) + 1);
        return origSend2.call(this, selector, argCount, doSuper);
    };
    process.on("exit", function() {
        console.error("== llamadores de " + caza + " ==");
        var vm = self.__vm;
        Array.from(porLlamador.entries()).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 15)
            .forEach(function(par) {
                var nombre = "?";
                try { nombre = vm.printMethod(par[0]); } catch (e) {}
                console.error("  " + par[1] + "\t" + nombre);
            });
    });
}
// SONDA: censo de sends por fase (la imagen corta fase abriendo 'census-marker')
if (process.env.CENSO) {
    var conteo = new Map(), fases = 0;
    var origSend = Squeak.Interpreter.prototype.send;
    Squeak.Interpreter.prototype.send = function(selector, argCount, doSuper) {
        conteo.set(selector, (conteo.get(selector) || 0) + 1);
        return origSend.call(this, selector, argCount, doSuper);
    };
    var volcar = function() {
        fases++;
        var total = 0; conteo.forEach(function(v) { total += v; });
        console.error("== censo fase " + fases + ": " + total + " sends ==");
        Array.from(conteo.entries()).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 30)
            .forEach(function(par) { console.error("  " + par[1] + "	" +
                (par[0] && par[0].bytesAsString ? par[0].bytesAsString() : String(par[0]))); });
        conteo = new Map();
    };
    var origFO = Squeak.Primitives.prototype.primitiveFileOpen;
    Squeak.Primitives.prototype.primitiveFileOpen = function(argCount) {
        var nombre = this.vm.stackValue(1);
        if (nombre && nombre.bytesAsString && /census-marker/.test(nombre.bytesAsString())) volcar();
        return origFO.apply(this, arguments);
    };
}
// SONDA: espiar las primitivas de directorio para ver qué pregunta la imagen
if (process.env.ESPIAR) {
    ["primitiveDirectoryCreate", "primitiveDirectoryEntry", "primitiveDirectoryLookup"].forEach(function(nombre) {
        var orig = Squeak.Primitives.prototype[nombre];
        Squeak.Primitives.prototype[nombre] = function(argCount) {
            var args = [];
            for (var i = argCount - 1; i >= 0; i--) {
                var o = this.vm.stackValue(i);
                args.push(o && o.bytesAsString ? o.bytesAsString() : String(o));
            }
            var ok = orig.call(this, argCount);
            var res = ok && this.vm.top();
            console.error("[espía] " + nombre + "(" + args.join(", ") + ") -> " +
                (ok ? (res && res.pointers ? "entrada" : String(res)) : "FALLA"));
            return ok;
        };
    });
}
// SONDA: mirar sends de primitiveEnterCriticalSection / DNU, y el backup de pc
if (process.env.SONDA_MUTEX) {
    var origSend3 = Squeak.Interpreter.prototype.send;
    Squeak.Interpreter.prototype.send = function(selector, argCount, doSuper) {
        var sel = selector && selector.bytes && selector.bytesAsString();
        if (sel === "primitiveEnterCriticalSection" || sel === "primitiveExitCriticalSection" ||
            sel === "doesNotUnderstand:") {
            var rcvr = this.stackValue(argCount);
            var cls = "?";
            try { cls = (rcvr && rcvr.sqInstName) ? rcvr.sqInstName() : String(rcvr); } catch (e) {}
            console.error("[sonda] send " + sel + " a " + cls);
        }
        return origSend3.call(this, selector, argCount, doSuper);
    };
    var origBackup = Squeak.Primitives.prototype.primitiveSuspendAndBackupPC;
    var foto = function(ctx) {
        if (!ctx || !ctx.pointers) return "sin contexto";
        var sp = ctx.pointers[Squeak.Context_stackPointer], base = Squeak.Context_tempFrameStart, s = [];
        for (var i = Math.max(0, sp - 3); i < sp; i++) {
            var o = ctx.pointers[base + i];
            s.push((o && o.sqInstName) ? o.sqInstName() : String(o));
        }
        return "pc=" + ctx.pointers[Squeak.Context_instructionPointer] + " sp=" + sp + " cima=[" + s.join(", ") + "]";
    };
    Squeak.Primitives.prototype.primitiveSuspendAndBackupPC = function() {
        var proc = this.vm.top();
        var ctx = proc && proc.pointers && proc.pointers[Squeak.Proc_suspendedContext];
        var lista = proc && proc.pointers && proc.pointers[Squeak.Proc_myList];
        var antes = foto(ctx);
        var res = origBackup.apply(this, arguments);
        console.error("[sonda] 578 lista=" + ((lista && lista.sqInstName) ? lista.sqInstName() : String(lista)) +
            " -> " + res + "\n         antes:  " + antes + "\n         despues:" + foto(ctx));
        return res;
    };
}
fs.readFile(root + imageName + ".image", function(error, data) {
    if (error) { console.error("Failed to read image", error); process.exit(1); }
    var image = new Squeak.Image(root + imageName);
    image.readFromBuffer(data.buffer, function startRunning() {
        // argv: [vm, imagen, argumentos...] -- la imagen los ve por getSystemAttribute:
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"],
                        argv: [Squeak.vmPath, root + imageName + ".image"].concat(imgArgs) };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;
        if (process.env.NOJIT) vm.compiler = null;
        var t0 = Date.now();
        function run() {
            if (Date.now() - t0 > TOPE_MS) { console.error("[tope de " + TOPE_MS + " ms]"); process.exit(2); }
            try {
                vm.interpret(200, function runAgain(ms) {
                    if (!display.quitFlag) setTimeout(run, ms === "sleep" ? 10 : ms);
                    else process.exit(0);
                });
            } catch (e) { console.error("Failure during Squeak run: ", e); process.exit(3); }
        }
        run();
    });
});
