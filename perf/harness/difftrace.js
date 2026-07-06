"use strict";
// Oráculo diferencial para el proyecto stack-zone (ver ../stack-zone-design.md).
//
// Corre una imagen headless en Node con entorno determinista (reloj virtual,
// random sembrado, WebSocket inerte) y acumula un hash de la traza de ejecución
// (sendCount/pc/sp/método en cada slice). Dos corridas del mismo VM producen el
// mismo hash; cualquier divergencia semántica introducida por un VM modificado
// produce otro hash.
//
//   node perf/harness/difftrace.js --golden        graba perf/harness/golden.json
//   node perf/harness/difftrace.js                 compara contra el golden (exit 1 si difiere)
//   node perf/harness/difftrace.js --bench         reloj real, mide wall-time y sends/s
//   opciones: --sends N (default 20000000), --image ruta (default ws/client/cuis.image)

var os = require("os");
var fs = require("fs");
var path = require("path");

var repoRoot = path.join(__dirname, "..", "..");
var args = process.argv.slice(2);
var mode = args.indexOf("--golden") >= 0 ? "golden"
         : args.indexOf("--bench") >= 0 ? "bench"
         : "check";
var useFrames = args.indexOf("--frames") >= 0; // correr con el stack zone activado
var noJit = args.indexOf("--nojit") >= 0; // apagar el jit (para aislar divergencias jit vs frames)
function argValue(name, deflt) {
    var i = args.indexOf(name);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : deflt;
}
var maxSends = parseInt(argValue("--sends", "20000000"), 10);
var imagePath = path.resolve(repoRoot, argValue("--image", "ws/client/cuis.image"));
var goldenPath = path.join(__dirname, "golden.json");
var logPath = argValue("--log", null); // traza por checkpoint, para ubicar divergencias
var logFrom = parseInt(argValue("--logfrom", "-1"), 10); // log fino por-send en [logfrom, logto]
var logTo = parseInt(argValue("--logto", "-1"), 10);

// ---------------------------------------------------------------------------
// Entorno determinista (solo en modos de traza; --bench usa el reloj real)
// ---------------------------------------------------------------------------
var virtualMs = 0;
var VIRTUAL_EPOCH = 1735689600000; // 2025-01-01, fijo
// El reloj virtual queda congelado hasta que arranca el loop de interpretación:
// el boot de Node/carga de imagen consume Date.now un número variable de veces
// (estado frío vs caliente) y no debe correr la línea de tiempo.
var clockRunning = false;
if (mode !== "bench") {
    var clockCalls = 0;
    var virtualNow = function() {
        if (clockRunning && ++clockCalls % 4 === 0) virtualMs++;
        return VIRTUAL_EPOCH + virtualMs;
    };
    // Stub de Date completo: new Date() sin args también debe ser virtual
    // (el código de la imagen loguea timestamps; con reloj real divergen las trazas)
    var RealDate = Date;
    var FakeDate = function Date() {
        if (arguments.length === 0) return new RealDate(virtualNow());
        return new (RealDate.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))();
    };
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now = virtualNow;
    FakeDate.UTC = RealDate.UTC;
    FakeDate.parse = RealDate.parse;
    global.Date = FakeDate;
    global.performance = { now: function() { return virtualMs; } };
    var seed = 42 >>> 0;
    Math.random = function() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// Bootstrapping del VM: mismo esquema que squeak_node.js
// ---------------------------------------------------------------------------
Object.assign(global, {
    self: new Proxy({}, {
        get: function(obj, prop) { return global[prop]; },
        set: function(obj, prop, value) { global[prop] = value; return true; }
    })
});

// WebSocket inerte: la imagen de ws/client intenta conectarse al arrancar; acá
// queda CONNECTING para siempre (el timeout del lado Smalltalk corre con el
// reloj virtual, así que es determinista).
function FakeWebSocket(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null; this.onclose = null; this.onmessage = null; this.onerror = null;
}
FakeWebSocket.prototype.send = function() {};
FakeWebSocket.prototype.close = function() { this.readyState = 3; };
FakeWebSocket.prototype.addEventListener = function() {};
FakeWebSocket.prototype.removeEventListener = function() {};

Object.assign(self, {
    localStorage: {},
    // inerte también en --bench: el workload debe ser idéntico al de la traza
    WebSocket: FakeWebSocket,
    sha1: require(path.join(repoRoot, "lib/sha1")),
    btoa: function(string) { return Buffer.from(string, "ascii").toString("base64"); },
    atob: function(string) { return Buffer.from(string, "base64").toString("ascii"); }
});

[
    "globals.js", "vm.js", "vm.object.js", "vm.object.spur.js", "vm.image.js",
    "vm.interpreter.js", "vm.interpreter.proxy.js", "vm.instruction.stream.js",
    "vm.instruction.stream.sista.js", "vm.instruction.printer.js", "vm.primitives.js",
    "jit.js", "vm.display.js", "vm.display.headless.js", "vm.input.js",
    "vm.input.headless.js", "vm.plugins.js", "vm.plugins.file.node.js",
    "vm.stackzone.js",
].forEach(function(f) { require(path.join(repoRoot, f)); });

Object.extend(Squeak, {
    vmPath: path.dirname(imagePath) + path.sep,
    platformSubtype: "Node.js",
    osVersion: mode === "bench"
        ? process.version + " " + os.platform() + " " + os.release() + " " + os.arch()
        : "difftrace-deterministic", // la imagen puede leer esto; que no varíe por máquina
    windowSystem: "none",
});

Object.extend(Squeak.Primitives.prototype, {
    loadModuleDynamically: function(modName) {
        try {
            require(path.join(repoRoot, "plugins", modName));
            return Squeak.externalModules[modName];
        } catch (e) {
            console.error("Plugin " + modName + " could not be loaded");
        }
        return undefined;
    }
});

// ---------------------------------------------------------------------------
// Driver síncrono + hash de traza
// ---------------------------------------------------------------------------
var hash = 2166136261 >>> 0; // FNV-1a
function mix(v) {
    hash = (hash ^ (v >>> 0)) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
}

// La imagen escribe artefactos junto a sí misma (crea el .changes si falta,
// logs de debug). Limpiarlos antes de correr para que toda corrida parta del
// mismo estado de filesystem — si no, la primera corrida en un clone fresco
// difiere de las siguientes.
var imageDir = path.dirname(imagePath);
var imageBase = path.basename(imagePath, ".image");
fs.readdirSync(imageDir).forEach(function(f) {
    if (f === imageBase + ".changes" || /^CuisDebug-.*\.log$/.test(f)) {
        fs.unlinkSync(path.join(imageDir, f));
    }
});

var data = fs.readFileSync(imagePath);
var image = new Squeak.Image(imagePath.replace(/\.image$/, ""));
image.readFromBuffer(data.buffer, function startRunning() {
    var display = { vmOptions: ["-vm-display-null", "-nodisplay"] };
    var vm = new Squeak.Interpreter(image, display, useFrames ? { stackZone: true } : {});
    if (noJit) vm.compiler = null;
    if (process.env.ZDBG9) {
        // volcar bytes+literales del método activado cuando mbytes coincide
        var z9size = parseInt(process.env.ZDBG9_SIZE), z9From = parseInt(process.env.ZDBG9_FROM || "0");
        var origENM9 = vm.executeNewMethod;
        var dumped = 0;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            if (vm.sendCount >= z9From && dumped < 2 && newMethod.bytes && newMethod.bytes.length === z9size) {
                dumped++;
                var lits = [];
                for (var i = 0; i < newMethod.pointers.length; i++) {
                    var l = newMethod.pointers[i];
                    lits.push(l && l.bytesAsString ? l.bytesAsString() : (l && l.sqClass ? l.sqClass.className() : String(l)));
                }
                console.error("MDUMP s=" + vm.sendCount + " sel=" + (optSel && optSel.bytesAsString ? optSel.bytesAsString() : "?")
                    + " bytes=[" + Array.prototype.join.call(newMethod.bytes, ",") + "] lits=" + JSON.stringify(lits));
            }
            return origENM9.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
        };
    }
    if (process.env.ZDBG7) {
        // dump de cadena al activar un método específico (por _traceId)
        var z7id = parseInt(process.env.ZDBG7_ID), z7From = parseInt(process.env.ZDBG7_FROM || "0");
        var chainDesc = function() {
            var desc = [];
            if (vm.useStackZone) {
                var page = vm.zonePage, fp = vm.fp, hops = 0;
                while (fp >= 0 && hops++ < 20) {
                    var m = page.slots[fp + Squeak.Frame_method];
                    var cl = page.slots[fp + Squeak.Frame_closure];
                    desc.push("m" + (m.bytes ? m.bytes.length : "?") + (cl && !cl.isNil ? "b" : ""));
                    fp = page.slots[fp + Squeak.Frame_savedFp];
                }
                if (fp < 0) desc.push("BASE:" + (page.baseCallerCtx && !page.baseCallerCtx.isNil ? "ctx" : "nil"));
            } else {
                var ctx = vm.activeContext, hops = 0;
                while (!ctx.isNil && hops++ < 20) {
                    var m2 = ctx.pointers[Squeak.Context_method];
                    var cl2 = ctx.pointers[Squeak.Context_closure];
                    desc.push("m" + (m2.bytes ? m2.bytes.length : (vm.isSmallInt(m2) ? "INT" : "?")) + (cl2 && !cl2.isNil ? "b" : ""));
                    ctx = ctx.pointers[Squeak.Context_sender];
                }
            }
            return desc.join("<");
        };
        var origENM7 = vm.executeNewMethod;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            var r = origENM7.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
            if (vm.sendCount >= z7From && newMethod._traceId === z7id)
                console.error("ACT s=" + vm.sendCount + " chain: " + chainDesc());
            return r;
        };
    }
    if (process.env.ZDBG6) {
        var origTT = vm.primHandler.transferTo;
        vm.primHandler.transferTo = function(newProc) {
            console.error("TT s=" + vm.sendCount);
            return origTT.call(this, newProc);
        };
    }
    if (process.env.ZDBG5) {
        // historial de activaciones de contexto explícitas (process switch / value de
        // contextos dormidos) en ambos modos
        var origNAC = vm.newActiveContext;
        vm.newActiveContext = function(newContext) {
            var m = newContext.pointers[Squeak.Context_method];
            console.error("NAC s=" + vm.sendCount
                + " mbytes=" + (m && m.bytes ? m.bytes.length : "int?")
                + " senderNil=" + (newContext.pointers[Squeak.Context_sender].isNil === true)
                + (vm.useStackZone ? " frame=" + (newContext.frame != null) : ""));
            return origNAC.call(vm, newContext);
        };
    }
    if (process.env.ZDBG4) {
        // atrapar escrituras de campos de contexts en modo contexts:
        // via bytecode (storeInstVar) y via primitivos (objectAtPut/storeStackp)
        var ctxClass = vm.specialObjects[Squeak.splOb_ClassMethodContext];
        var origSIV = vm.storeInstVar;
        var sivCount = 0;
        vm.storeInstVar = function(index, value) {
            if (++sivCount <= 3) console.error("SIV-ALIVE #" + sivCount + " s=" + vm.sendCount + " rcls=" + this.getClass(this.receiver).className());
            if (this.receiver.sqClass === ctxClass)
                console.error("CTXSTORE s=" + vm.sendCount + " idx=" + index + " val=" + (value && value.isNil ? "nil" : typeof value));
            return origSIV.call(this, index, value);
        };
        var origOAP = vm.primHandler.objectAtPut;
        vm.primHandler.objectAtPut = function(a, b, c) {
            var rcvr = this.stackNonInteger(2);
            if (rcvr.sqClass === ctxClass)
                console.error("CTXATPUT s=" + vm.sendCount + " idx=" + this.stackPos32BitInt(1));
            return origOAP.call(this, a, b, c);
        };
        var origSSP = vm.primHandler.primitiveStoreStackp;
        vm.primHandler.primitiveStoreStackp = function(argCount) {
            console.error("CTXSTACKP s=" + vm.sendCount);
            return origSSP.call(this, argCount);
        };
    }
    if (process.env.ZDBG3) {
        // dump de cadenas en la ventana: frames (fp chain) vs contexts (sender chain)
        var z3From = parseInt(process.env.ZDBG3_FROM || "0"), z3To = parseInt(process.env.ZDBG3_TO || "99999999");
        var origDR = vm.doReturn;
        vm.doReturn = function(returnValue, targetContext) {
            if (vm.sendCount >= z3From && vm.sendCount <= z3To) {
                var desc = [];
                if (vm.useStackZone) {
                    var page = vm.zonePage, fp = vm.fp, hops = 0;
                    while (fp >= 0 && hops++ < 12) {
                        var m = page.slots[fp + Squeak.Frame_method];
                        var cl = page.slots[fp + Squeak.Frame_closure];
                        desc.push(fp + ":m" + (m.bytes ? m.bytes.length : "?") + (cl && !cl.isNil ? "[blk]" : ""));
                        fp = page.slots[fp + Squeak.Frame_savedFp];
                    }
                    if (fp < 0) desc.push("base->" + (page.baseCallerCtx && !page.baseCallerCtx.isNil ? "ctx" : "nil"));
                } else {
                    var ctx = vm.activeContext, hops = 0;
                    while (!ctx.isNil && hops++ < 12) {
                        var m2 = ctx.pointers[Squeak.Context_method];
                        var cl2 = ctx.pointers[Squeak.Context_closure];
                        desc.push("m" + (m2.bytes ? m2.bytes.length : "?") + (cl2 && !cl2.isNil ? "[blk]" : ""));
                        ctx = ctx.pointers[Squeak.Context_sender];
                    }
                }
                console.error("DR s=" + vm.sendCount + " pc=" + vm.pc + " chain: " + desc.join(" <- "));
            }
            return origDR.call(vm, returnValue, targetContext);
        };
    }
    if (process.env.ZDBG) {
        var zFrom = parseInt(process.env.ZDBG_FROM || "0"), zTo = parseInt(process.env.ZDBG_TO || "99999999");
        var origANC = vm.primHandler.activateNewClosureMethod;
        vm.primHandler.activateNewClosureMethod = function(blockClosure, argCount) {
            if (vm.sendCount >= zFrom && vm.sendCount <= zTo) {
                var outer = blockClosure.pointers[Squeak.Closure_outerContext];
                var m = outer.frame != null ? outer.frame.page.slots[outer.frame.fp + Squeak.Frame_method]
                    : outer.pointers[Squeak.Context_method];
                console.error("ANC s=" + vm.sendCount + " startpc=" + blockClosure.pointers[Squeak.Closure_startpc]
                    + " mlits=" + (m.pointers ? m.pointers.length : "?") + " mbytes=" + (m.bytes ? m.bytes.length : "?")
                    + " outerMarried=" + (outer.frame != null) + " isNilM=" + (m.isNil === true));
            }
            var r = origANC.call(this, blockClosure, argCount);
            if (vm.sendCount >= zFrom && vm.sendCount <= zTo && !vm._zdbgArmed) {
                vm._zdbgArmed = 60;
                var origIO = vm.interpretOne.bind(vm);
                vm.interpretOne = function(singleStep) {
                    if (vm._zdbgArmed-- > 0)
                        console.error("BC pc=" + vm.pc + " byte=" + vm.method.bytes[vm.pc]
                            + " mbytes=" + vm.method.bytes.length + " sp=" + vm.sp + " fp=" + vm.fp);
                    return origIO(singleStep);
                };
            }
            return r;
        };
    }
    var slices = 0, idleStreak = 0, stopReason = "maxSends";
    var logLines = logPath ? [] : null;
    if (mode !== "bench") {
        // Muestreo en checkpoints fijos de sendCount: independiente de la
        // representación (contexts/frames) Y de la cadencia de interrupciones
        // (que difiere con/sin jit). Es la señal que entra al hash.
        var origENM = vm.executeNewMethod;
        vm.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
            // método identificado por fingerprint de contenido (los oops temporales
            // interleavan contexts y difieren entre representaciones; el identity
            // hash de métodos de imagen V3 es 0)
            if (newMethod._traceId === undefined) {
                var fp = newMethod.bytes ? newMethod.bytes.length : 0;
                if (newMethod.bytes) for (var bi = 0; bi < Math.min(newMethod.bytes.length, 16); bi++)
                    fp = ((fp * 31) + newMethod.bytes[bi]) | 0;
                newMethod._traceId = fp;
            }
            if (vm.sendCount < maxSends && (vm.sendCount & 4095) === 0) {
                mix(vm.sendCount);
                mix(newMethod._traceId);
                mix(vm.pc);
                if (logLines) logLines.push("s=" + vm.sendCount + " h=" + newMethod._traceId + " pc=" + vm.pc);
            }
            if (logLines && vm.sendCount >= logFrom && vm.sendCount <= logTo)
                logLines.push("S=" + vm.sendCount + " h=" + newMethod._traceId + " pc=" + vm.pc + " args=" + argumentCount + " prim=" + primitiveIndex
                    + " rcls=" + vm.getClass(newRcvr).className() + " sel=" + (optSel && optSel.bytesAsString ? optSel.bytesAsString() : "?"));
            return origENM.call(vm, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
        };
    }
    var wallStart = process.hrtime.bigint();
    clockRunning = true;
    try {
        while (vm.sendCount < maxSends) {
            if (display.quitFlag) { stopReason = "quit"; break; }
            var result = vm.interpret(5);
            slices++;
            // el hash se alimenta solo de los checkpoints por sendCount (arriba);
            // los límites de slice dependen de la cadencia de interrupciones,
            // que varía entre modos (jit/no-jit) sin implicar divergencia semántica
            if (result === "sleep") {
                // todos los procesos esperan sin timer: nada más va a pasar
                if (++idleStreak >= 3) { stopReason = "idle"; break; }
                warpClock(vm, 10);
            } else if (typeof result === "number" && result > 1) {
                // todos esperan hasta un timer futuro: saltar la espera
                warpClock(vm, result);
                idleStreak = 0;
            } else if (result === "break") {
                stopReason = "breakpoint"; break;
            } else {
                idleStreak = 0;
            }
        }
    } catch (e) {
        stopReason = "error: " + e.message;
        if (process.env.DIFFTRACE_DEBUG) console.error(e.stack);
    }
    var wallMs = Number(process.hrtime.bigint() - wallStart) / 1e6;
    if (logLines) fs.writeFileSync(logPath, logLines.join("\n") + "\n");

    function warpClock(vm, ms) {
        if (mode === "bench") {
            // adelantar el reloj del VM (startupTime) para no esperar de verdad
            var now = vm.primHandler.millisecondClockValue();
            vm.primHandler.millisecondClockValueSet(now + ms);
        } else {
            virtualMs += ms;
        }
    }

    var report = {
        image: path.relative(repoRoot, imagePath),
        maxSends: maxSends,
        sendCount: vm.sendCount,
        slices: slices,
        stopReason: stopReason,
        hash: hash.toString(16),
        virtualMs: virtualMs,
    };

    if (mode === "bench") {
        console.log("bench: " + vm.sendCount + " sends en " + wallMs.toFixed(0) + " ms  (" +
            (vm.sendCount / (wallMs / 1000) / 1e6).toFixed(2) + "M sends/s), stop: " + stopReason);
        return;
    }

    console.log("trace: sends=" + report.sendCount + " slices=" + report.slices +
        " stop=" + report.stopReason + " hash=" + report.hash + " virtualMs=" + report.virtualMs +
        "  (wall " + wallMs.toFixed(0) + " ms)");

    if (mode === "golden") {
        fs.writeFileSync(goldenPath, JSON.stringify(report, null, 2) + "\n");
        console.log("golden grabado en " + path.relative(repoRoot, goldenPath));
    } else {
        if (!fs.existsSync(goldenPath)) {
            console.error("no hay golden.json — corré primero con --golden");
            process.exit(2);
        }
        var golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
        // slices/virtualMs/sendCount-final quedan fuera de la comparación:
        // dependen de la cadencia de interrupciones y la granularidad del slice,
        // no de la semántica
        var keys = ["image", "maxSends", "stopReason", "hash"];
        var diffs = keys.filter(function(k) { return String(golden[k]) !== String(report[k]); });
        if (diffs.length === 0) {
            console.log("OK: traza idéntica al golden");
        } else {
            diffs.forEach(function(k) {
                console.error("DIVERGE " + k + ": golden=" + golden[k] + " actual=" + report[k]);
            });
            process.exit(1);
        }
    }
});
