// Corre una imagen Cuis bajo squeakjs/Node pasándole argumentos de línea de comandos
// (squeak_node.js no los pasa; Cuis los lee con getSystemAttribute: 2..n).
//
//   node correr-cuis.js <imagen> [args para la imagen...]      p.ej.  -s probar.st
//
// Copia de squeak_node.js con display.argv y un tope de tiempo.
"use strict";
const os = require("os"), fs = require("fs"), path = require("path");
const REPO = process.env.REPO || "/Users/agustin/SqueakJS";
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

// SONDA: quien escribe el header de un metodo (objectAt: 1 put:)
if (process.env.HEADERPUT) {
    var origAP = Squeak.Primitives.prototype.objectAtPut;
    var vistos = 0;
    Squeak.Primitives.prototype.objectAtPut = function(cameFromBytecode, convertChars, includeInstVars) {
        var arr = this.vm.stackValue(2), idx = this.vm.stackValue(1), val = this.vm.stackValue(0);
        if (arr && arr.isMethod && arr.isMethod() && idx === 1 && vistos++ < 8) {
            var cn = (val && val.sqClass && val.sqClass.className) ? val.sqClass.className() : typeof val;
            console.error("[header put] escriben el header de un metodo: valor es " + cn +
                (typeof val === "number" ? (" = " + val) : "") +
                " | antes pointers[0]=0x" + ((arr.pointers[0]|0) >>> 0).toString(16));
        }
        return origAP.apply(this, arguments);
    };
}
// SONDA: por que falla primitiveNewMethod (primitiva 79)
if (process.env.NEWMETHOD) {
    var origNM = Squeak.Primitives.prototype.primitiveNewMethod;
    var nmOk = 0, nmFalla = 0;
    Squeak.Primitives.prototype.primitiveNewMethod = function(argCount) {
        var header = this.vm.stackValue(0), cuenta = this.vm.stackValue(1), clase = this.vm.stackValue(2);
        var r = origNM.apply(this, arguments);
        if (r === true) {
            nmOk++;
            if (nmOk <= 6) {
                var m = this.vm.top();
                var cn = (header && header.sqClass && header.sqClass.className) ? header.sqClass.className() : typeof header;
                console.error("[prim79] header entra como " + cn +
                    " -> interno 0x" + (m.pointers[0] >>> 0).toString(16) +
                    " | signFlag=" + m.methodSignFlag() +
                    " numLits=" + m.methodNumLits() +
                    " numArgs=" + m.methodNumArgs() +
                    " nbytes=" + (m.bytes ? m.bytes.length : "?"));
            }
        }
        else {
            nmFalla++;
            if (nmFalla <= 5) {
                var desc = function(x) {
                    if (typeof x === "number") return "SmallInteger " + x;
                    if (!x) return String(x);
                    var cn = x.sqClass && x.sqClass.className ? x.sqClass.className() : "?";
                    var extra = x.bytes ? (" bytes=" + Array.from(x.bytes).join(",")) : "";
                    return cn + extra;
                };
                console.error("[prim79 FALLA] clase=" + desc(clase) + " bytecodes=" + desc(cuenta) +
                    " header=" + desc(header));
            }
        }
        return r;
    };
    process.on("exit", function() {
        console.error("== primitiva 79: " + nmOk + " ok, " + nmFalla + " fallas ==");
    });
}
// SONDA: volver al comportamiento viejo (retroceder el pc SIN reponer el tope de
// pila), para aislar exactamente ese cambio
if (process.env.SINTOPE) {
    Squeak.Primitives.prototype.backupToBlockingSend = function(process, cond) {
        var context = process.pointers[Squeak.Proc_suspendedContext];
        if (!context || !context.pointers) return false;
        var method = context.pointers[Squeak.Context_method],
            pcObj = context.pointers[Squeak.Context_instructionPointer];
        if (!method || !method.bytes || typeof pcObj !== "number") return false;
        var sendPC = this.startOfPrecedingSend(method, this.vm.decodeSqueakPC(pcObj, method));
        if (sendPC < 0) return false;
        context.pointers[Squeak.Context_instructionPointer] = this.vm.encodeSqueakPC(sendPC, method);
        context.dirty = true;
        return true;
    };
}
// spike de forma directa (ver utils/spikes/directo/): opt-in con DIRECTO=1
if (process.env.DIRECTO === "2") require(__dirname + "/spike-frontera.js");
else if (process.env.DIRECTO && process.env.DIRECTO !== "0") require(REPO + "/utils/spikes/directo/spike-directo.js");

// llave de desarrollo del VectorEnginePlugin
if (process.env.VECTORPLUGIN) Squeak.enableVectorEnginePlugin = true;
// SONDA: censo de la primitiva 578 -- cuantas veces se llama, sobre que clase de
// lista estaba el proceso, y si se retrocedio el pc
if (process.env.CENSO578) {
    var c578 = { total: 0, activo: 0, colaListos: 0, retrocedio: 0, sinRetroceso: 0, porClase: new Map() };
    var orig578 = Squeak.Primitives.prototype.primitiveSuspendAndBackupPC;
    var origStart = Squeak.Primitives.prototype.startOfPrecedingSend;
    Squeak.Primitives.prototype.startOfPrecedingSend = function(m, pc) {
        var r = origStart.call(this, m, pc);
        if (r >= 0) c578.retrocedio++; else c578.sinRetroceso++;
        return r;
    };
    Squeak.Primitives.prototype.primitiveSuspendAndBackupPC = function() {
        c578.total++;
        var proc = this.vm.top();
        var lista = proc && proc.pointers && proc.pointers[Squeak.Proc_myList];
        if (proc === this.activeProcess()) c578.activo++;
        else if (lista && !lista.isNil) {
            var esCola = this.isRunQueue(lista);
            if (esCola) c578.colaListos++;
            var nom = esCola ? "(cola de listos)" : (lista.sqClass && lista.sqClass.className
                ? lista.sqClass.className() : "?");
            c578.porClase.set(nom, (c578.porClase.get(nom) || 0) + 1);
        }
        return orig578.apply(this, arguments);
    };
    process.on("exit", function() {
        console.error("== censo de la primitiva 578 ==");
        console.error("  llamadas: " + c578.total + " | proceso activo: " + c578.activo +
            " | en cola de listos: " + c578.colaListos);
        console.error("  pc retrocedido: " + c578.retrocedio + " | intentos sin retroceso: " + c578.sinRetroceso);
        c578.porClase.forEach(function(v, k) { console.error("    lista " + k + ": " + v); });
    });
}
// SONDA: muestrear la pila Smalltalk cada 700 ms
// BOMBA DE EVENTOS (opt-in: PULSO=1). El backend
// headless (vm.input.headless.js) se traga el registro del semaforo de input y
// primitiveGetNextEvent falla siempre, asi que el mundo Morphic se duerme
// esperando eventos que no llegan y NUNCA bombea deferredUIMessages — que es
// donde Cuis procesa las opciones finales de linea de comandos (-s / -d).
// Historicamente esto "funcionaba" de casualidad: el chequeo del .changes
// fallaba (nombre truncado), el DNU mataba el proceso de UI y el respawn
// bombeaba la cola. Con el nombre arreglado el arranque drena la cola solo y
// el -s corre sin ayuda; la bomba queda como opt-in para scripts que necesiten
// UI viva despues del arranque (menus, delays de Morphic, etc):
// registramos el semaforo de verdad y lo pulsamos cada 50 ms. Un despertar
// espurio es legal para un semaforo; dormir para siempre no.
if (process.env.PULSO) {
    var pulsoPendiente = false, pulsoX = 0;
    Squeak.Primitives.prototype.primitiveInputSemaphore = function(argCount) {
        this.inputEventSemaIndex = this.stackInteger(0);
        this.vm.popNandPush(argCount + 1, this.vm.nilObj);
        return true;
    };
    // formato de evento: [tipo, tick, x, y, botones, modificadores, 0, 0]
    // (mismo layout que makeSqueakEvent en squeak.js; tipo 1 = mouse)
    Squeak.Primitives.prototype.primitiveGetNextEvent = function(argCount) {
        var evtBuf = this.vm.stackValue(0).pointers;
        if (evtBuf) {
            for (var i = 0; i < evtBuf.length; i++) evtBuf[i] = 0;
            if (pulsoPendiente) {
                pulsoPendiente = false;
                pulsoX = (pulsoX + 1) & 15; // mover 1px ida y vuelta: evento "real" pero inocuo
                evtBuf[0] = Squeak.EventTypeMouse;
                evtBuf[1] = this.millisecondClockValue();
                evtBuf[2] = 10 + (pulsoX & 1);
                evtBuf[3] = 10;
            } // si no, queda EventTypeNone (0)
        }
        this.vm.popN(argCount);
        return true;
    };
    setInterval(function() {
        var vm = self.__vm;
        if (vm && vm.primHandler && vm.primHandler.inputEventSemaIndex > 0) {
            pulsoPendiente = true;
            vm.primHandler.signalSemaphoreWithIndex(vm.primHandler.inputEventSemaIndex);
            vm.forceInterruptCheck();
        }
    }, 200);
}
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
fs.readFile(root + imageName + ".image", function(error, data) {
    if (process.env.CARGA) { var __t0 = Date.now(); }
    if (error) { console.error("Failed to read image", error); process.exit(1); }
    // CON ".image": el nombre va a parar a primitiveImageName y la imagen deriva
    // de ahi su .changes recortando la ultima extension. Sin el ".image", un
    // nombre con punto ("Cuis7.8") pierde el ".8" y el chequeo de arranque de
    // Cuis (checkIfAlreadyRunningOrStoppedNoExit) muere buscando Cuis7.changes,
    // matando de paso la cola de deferredUIMessages donde corre nuestro -s.
    var image = new Squeak.Image(root + imageName + ".image");
    image.readFromBuffer(data.buffer, function startRunning() {
        if (process.env.CARGA) console.error("[carga] " + (Date.now() - __t0) + " ms");
        // argv: [vm, imagen, argumentos...] -- la imagen los ve por getSystemAttribute:
        var display = { vmOptions: ["-vm-display-null", "-nodisplay"],
                        argv: [Squeak.vmPath, root + imageName + ".image"].concat(imgArgs) };
        var vm = new Squeak.Interpreter(image, display); self.__vm = vm;
        if (process.env.NOJIT) vm.compiler = null;
        // sp-en-local del jit (default: prendido). SPLOCAL=0 lo apaga;
        // JITSP=a,b / JITSPNOT=c,d bisecan por nombre de funcion generada
        if (process.env.SPLOCAL === "0") vm.jitSpLocal = false;
        if (process.env.PEEPHOLE === "0") vm.jitPeephole = false;
        // SONDA: desensamblar el metodo cuyo nombre matchea (DESARMAR=Integer>>benchFib)
        if (process.env.DESARMAR) {
            var __d = process.env.DESARMAR.split(">>"), __hecho = false;
            var __orig = vm.executeNewMethod.bind(vm);
            vm.executeNewMethod = function(rcvr, method, argc, prim, optClass, optSel) {
                if (!__hecho && optClass && optSel && optClass.className() === __d[0] && optSel.bytesAsString() === __d[1]) {
                    __hecho = true;
                    console.error("=== " + __d[0] + ">>" + __d[1] + " ===");
                    console.error("bytes: " + Array.from(method.bytes).join(" "));
                    console.error("numArgs=" + method.methodNumArgs() + " numTemps=" + method.methodTempCount() +
                        " numLits=" + method.methodNumLits() + " sista=" + method.methodSignFlag() +
                        " needsLarge=" + method.methodNeedsLargeFrame());
                    console.error(new Squeak.InstructionPrinter(method, vm).printInstructions());
                }
                return __orig(rcvr, method, argc, prim, optClass, optSel);
            };
        }
        if (process.env.PEEPHOLE) process.on("exit", function() { console.error("[mirilla] metodos: " + (vm.jitPeepholeOk||0) + " | rechazados: " + (vm.jitPeepholeFail||0)); });
        // SONDA: volcar el JS que genera el jit para un metodo. VOLCAR=<texto> matchea
        // contra el nombre de la funcion generada O contra su fuente (util porque los
        // metodos compilados desde interpret() pierden clase/selector y salen DOIT_n:
        // a la criba se la encuentra por su literal, VOLCAR=8190). VOLCAR=LISTA lista
        // todos los nombres generados.
        if (process.env.VOLCAR) {
            var __gen = vm.compiler.generate.bind(vm.compiler), __visto = false;
            vm.compiler.generate = function(m, cls, sel, iv) {
                var f = __gen(m, cls, sel, iv);
                if (process.env.VOLCAR === "LISTA" && f && f.name) console.error("[gen] " + f.name);
                var __t = f ? f.toString() : "";
                if (!__visto && f && (f.name.indexOf(process.env.VOLCAR) >= 0 || __t.indexOf(process.env.VOLCAR) >= 0)) {
                    __visto = true;
                    console.error("=== " + f.name + " ===\n" + f.toString());
                }
                return f;
            };
        }
        if (process.env.SPLOCAL) {
            if (process.env.JITSP) vm.jitSpLocalOnly = process.env.JITSP.split(",");
            if (process.env.JITSPNOT) vm.jitSpLocalNot = process.env.JITSPNOT.split(",");
            process.on("exit", function() {
                console.error("[splocal] transformados: " + (vm.jitSpLocalized || 0) +
                    " | fallbacks: " + (vm.jitSpLocalFallbacks || 0));
            });
        }
        var t0 = Date.now();
        function run() {
            if (Date.now() - t0 > TOPE_MS) { console.error("[tope de " + TOPE_MS + " ms]"); process.exit(2); }
            try {
                vm.interpret(200, function runAgain(ms) {
                    // -ignoreQuit: Cuis se cierra al no ver pantalla, antes de procesar -s
                    if (process.env.IGNOREQUIT || !display.quitFlag) setTimeout(run, ms === "sleep" ? 10 : ms);
                    else process.exit(0);
                });
            } catch (e) { console.error("Failure during Squeak run: ", e); process.exit(3); }
        }
        run();
    });
});

// PARCHE CRITICO: imprimir contadores del VM al salir (paridad A/B)
process.on("exit", function() {
    var vm = self.__vm;
    if (vm) console.error("[conteo] sendCount=" + vm.sendCount + " byteCodeCount=" + vm.byteCodeCount);
});
