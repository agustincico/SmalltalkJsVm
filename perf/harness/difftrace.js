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
function argValue(name, deflt) {
    var i = args.indexOf(name);
    return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : deflt;
}
var maxSends = parseInt(argValue("--sends", "20000000"), 10);
var imagePath = path.resolve(repoRoot, argValue("--image", "ws/client/cuis.image"));
var goldenPath = path.join(__dirname, "golden.json");
var logPath = argValue("--log", null); // traza por slice, para ubicar divergencias

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
    var vm = new Squeak.Interpreter(image, display);
    var slices = 0, idleStreak = 0, stopReason = "maxSends";
    var logLines = logPath ? [] : null;
    var wallStart = process.hrtime.bigint();
    clockRunning = true;
    try {
        while (vm.sendCount < maxSends) {
            if (display.quitFlag) { stopReason = "quit"; break; }
            var result = vm.interpret(5);
            slices++;
            if (mode !== "bench") {
                // Solo estado independiente de la representación de contexts:
                // sp/activeContext cambian de significado con el stack zone,
                // pero sendCount/método/pc son comparables entre ambos VMs.
                mix(vm.sendCount);
                mix(vm.pc);
                mix(vm.method && vm.method.oop ? vm.method.oop : 0);
                if (logLines) logLines.push(slices + " sends=" + vm.sendCount + " pc=" + vm.pc +
                    " oop=" + (vm.method && vm.method.oop) +
                    " vms=" + virtualMs + " r=" + result);
            }
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
        // slices/virtualMs quedan fuera de la comparación: son del scheduling,
        // no de la semántica (podrían variar levemente entre representaciones)
        var keys = ["image", "maxSends", "sendCount", "stopReason", "hash"];
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
