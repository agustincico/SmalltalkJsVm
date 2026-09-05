// CENSO DINAMICO de activaciones por metodo, para la "forma directa".
// Se inyecta desde una COPIA del arnes (correr-censo.js) via CENSODIN=<este archivo>.
// No toca el repo: monkey-patchea prototipos de Squeak.Interpreter / Squeak.Primitives.
//
// Cuenta:
//  - activaciones por metodo (entradas a executeNewMethod; incluye las que la
//    primitiva resuelve sin crear contexto — se distinguen con "cuerpo")
//  - aristas dinamicas caller->callee (caller = vm.method al entrar)
//  - quick sends (quickSendOther: at:/at:put:/size/==/class/value/value:) que NO
//    pasan por executeNewMethod, global y por metodo caller
//  - activaciones de bloques (activateNewClosureMethod / activateNewFullClosure)
// Al salir clasifica cada metodo visto con EL MISMO escaner del censo estatico
// (censo-elegibilidad.js, copiado verbatim) y calcula cobertura R0/R1/R2 ponderada
// por activaciones + la sustentabilidad de cadenas (aristas eleg->eleg).
//
// Salida: JSON en CENSOSAL (default censo-salida.json), etiqueta CENSONOM.
"use strict";
var fs = require("fs");

// ---------------------------------------------------------------------------
// escaner de bytecodes SISTA — COPIA VERBATIM de censo-elegibilidad.js (censo
// estatico) para que las dos clasificaciones sean identicas.
function escanearMetodo(m) {
    var bytes = m.bytes;
    var prim = m.methodPrimitiveIndex();
    var r = {
        prim: prim,
        quickPrim: prim >= 256 && prim < 520,
        fullClosure: 0, closureCopy: 0, remoteTemp: 0,
        newArrayVacio: 0, newArrayPop: 0,
        thisContext: 0, thisProcess: 0,
        superSend: 0, superDirected: 0,
        backJump: 0, backCondJump: 0,
        blockReturn: 0,
        raro: null,
        sends: 0, sendsEspeciales: 0, jumps: 0, condJumps: 0,
        nInstr: 0, cuerpoBytes: 0,
    };
    var pc = 0, endPC = 0, extA = 0, extB = 0, done = false;
    if (prim > 0) {
        if (bytes.length < 3 || bytes[0] !== 0xF8) { r.raro = "prim-sin-callPrimitive"; return r; }
        pc = 3;
        if (r.quickPrim) return r;
    }
    var inicio = pc;
    while (!done) {
        if (pc >= bytes.length) { if (!r.raro) r.raro = "fin-sin-return"; break; }
        if (r.nInstr++ > 200000) { r.raro = "metodo-absurdo"; break; }
        var b = bytes[pc++];
        if (b === 0xE0) { extA = extA * 256 + bytes[pc++]; continue; }
        if (b === 0xE1) { var v = bytes[pc++]; extB = extB * 256 + (v < 128 ? v : v - 256); continue; }
        var eA = extA, eB = extB, b2, b3, dist;
        extA = 0; extB = 0;
        if (b <= 0x51) { }
        else if (b === 0x52) {
            if (eB === 0) r.thisContext++;
            else if (eB === 1) r.thisProcess++;
            else r.raro = "0x52-extB-" + eB;
        }
        else if (b === 0x53) { }
        else if (b >= 0x54 && b <= 0x57) { r.raro = "no-usado-" + b.toString(16); break; }
        else if (b >= 0x58 && b <= 0x5C) { done = pc > endPC; }
        else if (b === 0x5D || b === 0x5E) { r.blockReturn++; done = pc > endPC; }
        else if (b === 0x5F) { }
        else if (b <= 0x7F) { r.sends++; r.sendsEspeciales++; }
        else if (b <= 0xAF) { r.sends++; }
        else if (b <= 0xB7) { dist = (b & 7) + 1; r.jumps++; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xC7) { dist = (b & 7) + 1; r.condJumps++; if (pc + dist > endPC) endPC = pc + dist; }
        else if (b <= 0xD7) { }
        else if (b === 0xD8) { }
        else if (b <= 0xDF) { r.raro = (b === 0xD9 ? "trap-0xD9" : "no-usado-" + b.toString(16)); break; }
        else if (b === 0xE2 || b === 0xE3 || b === 0xE4 || b === 0xE5) { pc++; }
        else if (b === 0xE6) { r.raro = "no-usado-e6"; break; }
        else if (b === 0xE7) { b2 = bytes[pc++]; if (b2 < 128) r.newArrayVacio++; else r.newArrayPop++; }
        else if (b === 0xE8 || b === 0xE9) { pc++; }
        else if (b === 0xEA) { pc++; r.sends++; }
        else if (b === 0xEB) { pc++; if (eB >= 64) r.superDirected++; else r.superSend++; }
        else if (b === 0xEC) { r.raro = "class-trap-0xEC"; break; }
        else if (b === 0xED) {
            b2 = bytes[pc++]; dist = b2 + eB * 256; r.jumps++;
            if (dist <= 0) r.backJump++; else if (pc + dist > endPC) endPC = pc + dist;
        }
        else if (b === 0xEE || b === 0xEF) {
            b2 = bytes[pc++]; dist = b2 + eB * 256; r.condJumps++;
            if (dist <= 0) { r.backJump++; r.backCondJump++; } else if (pc + dist > endPC) endPC = pc + dist;
        }
        else if (b >= 0xF0 && b <= 0xF5) { pc++; }
        else if (b === 0xF6 || b === 0xF7) { r.raro = "no-usado-" + b.toString(16); break; }
        else if (b === 0xF8) { pc += 2; r.raro = "callPrim-en-medio"; }
        else if (b === 0xF9) { pc += 2; r.fullClosure++; }
        else if (b === 0xFA) {
            b2 = bytes[pc++]; b3 = bytes[pc++];
            var blockSize = b3 + (eB << 8);
            r.closureCopy++;
            if (pc + blockSize > endPC) endPC = pc + blockSize;
        }
        else if (b >= 0xFB && b <= 0xFD) { pc += 2; r.remoteTemp++; }
        else { r.raro = "desconocido-" + b.toString(16); break; }
    }
    r.cuerpoBytes = pc - inicio;
    return r;
}

function motivos(r) {
    var m = [];
    if (r.prim > 0) m.push("primitiva");
    if (r.fullClosure || r.closureCopy || r.remoteTemp || r.blockReturn) m.push("closure");
    if (r.newArrayVacio || r.newArrayPop) m.push("newArray");
    if (r.thisContext) m.push("thisContext");
    if (r.thisProcess) m.push("thisProcess");
    if (r.raro) m.push("raro");
    return m;
}
// ------------------------------------------------------------- fin copia ----

var SIN_CALLER = { esSentinela: true };
var censo = new Map();          // metodo -> {n, cuerpo, nombre}
var edges = new Map();          // caller -> Map(callee -> n)
var quickPorCaller = new Map(); // caller -> Int32Array(16)
var quickGlobal = new Array(16).fill(0);
var quickFallas = 0;
var closViejo = 0, closFull = 0;
var closPorHome = new Map();    // metodo home -> activaciones de bloque
var totalAct = 0, totalCuerpo = 0;

var protoI = Squeak.Interpreter.prototype;
var origENM = protoI.executeNewMethod;
protoI.executeNewMethod = function(newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel) {
    totalAct++;
    var rec = censo.get(newMethod);
    if (rec === undefined) { rec = { n: 0, cuerpo: 0, nombre: null }; censo.set(newMethod, rec); }
    rec.n++;
    if (rec.nombre === null && optClass && optSel) {
        try { rec.nombre = optClass.className() + ">>" + optSel.bytesAsString(); }
        catch (e) { rec.nombre = "?anon?"; }
    }
    var caller = this.method || SIN_CALLER;
    var em = edges.get(caller);
    if (em === undefined) { em = new Map(); edges.set(caller, em); }
    em.set(newMethod, (em.get(newMethod) || 0) + 1);
    origENM.call(this, newRcvr, newMethod, argumentCount, primitiveIndex, optClass, optSel);
    if (this.method === newMethod) { rec.cuerpo++; totalCuerpo++; }
};

var protoP = Squeak.Primitives.prototype;
var origQSO = protoP.quickSendOther;
protoP.quickSendOther = function(rcvr, lobits) {
    var ok = origQSO.call(this, rcvr, lobits);
    if (ok) {
        quickGlobal[lobits]++;
        var caller = this.vm.method || SIN_CALLER;
        var arr = quickPorCaller.get(caller);
        if (arr === undefined) { arr = new Int32Array(16); quickPorCaller.set(caller, arr); }
        arr[lobits]++;
    } else quickFallas++;
    return ok;
};
var origANC = protoP.activateNewClosureMethod;
protoP.activateNewClosureMethod = function(blockClosure, argCount) {
    closViejo++;
    try {
        var oc = blockClosure.pointers[Squeak.Closure_outerContext];
        var home = oc && oc.pointers && oc.pointers[Squeak.Context_method];
        if (home) closPorHome.set(home, (closPorHome.get(home) || 0) + 1);
    } catch (e) { }
    return origANC.call(this, blockClosure, argCount);
};
var origANF = protoP.activateNewFullClosure;
protoP.activateNewFullClosure = function(blockClosure, argCount) {
    closFull++;
    try {
        var cb = blockClosure.pointers[Squeak.ClosureFull_method];
        if (cb) closPorHome.set(cb, (closPorHome.get(cb) || 0) + 1);
    } catch (e) { }
    return origANF.call(this, blockClosure, argCount);
};

// ------------------------------------------------------------------ volcado ----
var QNOM = { 0: "at:", 1: "at:put:", 2: "size", 6: "==", 7: "class", 8: "blockCopy:", 9: "value", 10: "value:" };

process.on("exit", function() {
    try { volcar(); } catch (e) { console.error("censo-dinamico: fallo el volcado: " + (e.stack || e)); }
});

function volcar() {
    var vm = self.__vm;
    // indice inverso metodo -> nombre (una sola pasada por la imagen)
    var nombres = new Map();
    try {
        vm.allMethodsDo(function(cls, m, sel) {
            if (!nombres.has(m)) {
                try { nombres.set(m, cls.className() + ">>" + sel.bytesAsString()); } catch (e) { }
            }
        });
    } catch (e) { console.error("censo-dinamico: allMethodsDo fallo: " + e); }

    // clasificacion memoizada
    var clasifCache = new Map();
    function clasif(m) {
        if (!m || m === SIN_CALLER) return null;
        var c = clasifCache.get(m);
        if (c !== undefined) return c;
        c = { esR0: false, esR1: false, esR2: false, mot: null, r: null, tipo: "metodo" };
        try {
            if (typeof m.methodSignFlag !== "function" || !m.bytes || !m.pointers) {
                c.tipo = "no-metodo"; c.mot = ["no-metodo"];
            } else if (!m.methodSignFlag()) {
                c.tipo = "no-sista"; c.mot = ["no-sista"];
            } else {
                var r = escanearMetodo(m);
                var mot = motivos(r);
                c.r = r; c.mot = mot;
                c.esR2 = mot.length === 0;
                c.esR1 = c.esR2 && !r.superSend && !r.superDirected;
                c.esR0 = c.esR1 && !r.backJump;
            }
        } catch (e) { c.tipo = "error"; c.mot = ["error-escaneo"]; }
        clasifCache.set(m, c);
        return c;
    }
    function nombreDe(m, rec) {
        if (rec && rec.nombre) return rec.nombre;
        var n = nombres.get(m);
        if (n) return n;
        try { return m.methodAsString(); } catch (e) { }
        return "?doit-o-anon?";
    }
    function motivoTexto(c) {
        if (!c) return "?";
        if (c.mot && c.mot.length) {
            var partes = c.mot.slice();
            if (c.r && c.r.prim > 0) {
                var i = partes.indexOf("primitiva");
                if (i >= 0) partes[i] = "primitiva:" + c.r.prim + (c.r.quickPrim ? "(quick)" : "");
            }
            return partes.join("+");
        }
        if (!c.esR1) return "super";
        if (!c.esR0) return "loop(soloR1)";
        return "-";
    }

    // cobertura ponderada por activaciones
    var cob = {
        R0: { acts: 0, cuerpo: 0, metodos: 0 },
        R1: { acts: 0, cuerpo: 0, metodos: 0 },
        R2: { acts: 0, cuerpo: 0, metodos: 0 },
    };
    var porCategoria = {}; // motivo -> activaciones (callees inelegibles R1) + elegR0/soloLoop/super
    var lista = [];
    censo.forEach(function(rec, m) {
        var c = clasif(m);
        var cat;
        if (c.esR0) cat = "elegible-R0";
        else if (c.esR1) cat = "loop(soloR1)";
        else if (c.esR2) cat = "super(soloR2)";
        else cat = (c.mot || ["?"]).join("+");
        if (c.r && c.r.prim > 0 && cat.indexOf("primitiva") >= 0)
            cat = cat.replace("primitiva", c.r.quickPrim ? "primitiva-quick" : "primitiva-real");
        porCategoria[cat] = (porCategoria[cat] || 0) + rec.n;
        if (c.esR0) { cob.R0.acts += rec.n; cob.R0.cuerpo += rec.cuerpo; cob.R0.metodos++; }
        if (c.esR1) { cob.R1.acts += rec.n; cob.R1.cuerpo += rec.cuerpo; cob.R1.metodos++; }
        if (c.esR2) { cob.R2.acts += rec.n; cob.R2.cuerpo += rec.cuerpo; cob.R2.metodos++; }
        lista.push({
            nombre: nombreDe(m, rec), n: rec.n, cuerpo: rec.cuerpo,
            elegR0: c.esR0, elegR1: c.esR1, elegR2: c.esR2,
            motivo: motivoTexto(c),
            prim: c.r ? c.r.prim : -1,
            loops: c.r ? c.r.backJump : 0,
            sends: c.r ? c.r.sends : -1,
            bytes: c.r ? c.r.cuerpoBytes : -1,
            numArgs: (function() { try { return m.methodNumArgs(); } catch (e) { return -1; } })(),
            numTemps: (function() { try { return m.methodTempCount(); } catch (e) { return -1; } })(),
        });
    });
    lista.sort(function(a, b) { return b.n - a.n; });

    // aristas: sustentabilidad de cadenas
    var aristas = {
        total: 0,
        desdeR0: { total: 0, aR0: 0 }, desdeR1: { total: 0, aR1: 0, aR1oQuick: 0, aR1oQuickoPrimOK: 0 },
        aR0: { total: 0, desdeR0: 0 }, aR1: { total: 0, desdeR1: 0 },
        sinCaller: 0,
    };
    // callee "primOK": primitiva real que casi nunca corre el cuerpo (cuerpo/n < 2%)
    function esPrimOK(m, ce) {
        if (!ce || !ce.r || !(ce.r.prim > 0) || ce.r.quickPrim) return false;
        var rec = censo.get(m);
        return rec && rec.n > 0 && rec.cuerpo / rec.n < 0.02;
    }
    function esQuick(ce) { return ce && ce.r && ce.r.quickPrim; }
    var frontera = new Map(); // "caller -> callee" (caller elegR1, callee no) -> count
    var fronteraR0 = new Map();
    edges.forEach(function(em, caller) {
        var cc = clasif(caller);
        em.forEach(function(n, callee) {
            aristas.total += n;
            if (!cc) { aristas.sinCaller += n; }
            var ce = clasif(callee);
            if (cc && cc.esR0) {
                aristas.desdeR0.total += n;
                if (ce.esR0) aristas.desdeR0.aR0 += n;
                else {
                    var k = nombreDe(caller, censo.get(caller)) + " -> " + nombreDe(callee, censo.get(callee)) + " [" + motivoTexto(ce) + "]";
                    fronteraR0.set(k, (fronteraR0.get(k) || 0) + n);
                }
            }
            if (cc && cc.esR1) {
                aristas.desdeR1.total += n;
                if (ce.esR1) aristas.desdeR1.aR1 += n;
                else {
                    var k2 = nombreDe(caller, censo.get(caller)) + " -> " + nombreDe(callee, censo.get(callee)) + " [" + motivoTexto(ce) + "]";
                    frontera.set(k2, (frontera.get(k2) || 0) + n);
                }
                if (ce.esR1 || esQuick(ce)) aristas.desdeR1.aR1oQuick += n;
                if (ce.esR1 || esQuick(ce) || esPrimOK(callee, ce)) aristas.desdeR1.aR1oQuickoPrimOK += n;
            }
            if (ce.esR0) { aristas.aR0.total += n; if (cc && cc.esR0) aristas.aR0.desdeR0 += n; }
            if (ce.esR1) { aristas.aR1.total += n; if (cc && cc.esR1) aristas.aR1.desdeR1 += n; }
        });
    });
    function topMap(map, k) {
        return Array.from(map.entries()).sort(function(a, b) { return b[1] - a[1]; }).slice(0, k)
            .map(function(par) { return { arista: par[0], n: par[1] }; });
    }

    // quick sends desde callers elegibles
    var quickDesdeR1 = new Array(16).fill(0), quickDesdeR0 = new Array(16).fill(0);
    quickPorCaller.forEach(function(arr, caller) {
        var cc = clasif(caller);
        if (cc && cc.esR1) for (var i = 0; i < 16; i++) quickDesdeR1[i] += arr[i];
        if (cc && cc.esR0) for (var i = 0; i < 16; i++) quickDesdeR0[i] += arr[i];
    });
    function quickObj(arr) {
        var o = {}, tot = 0;
        for (var i = 0; i < 16; i++) if (arr[i]) { o[QNOM[i] || ("lobits" + i)] = arr[i]; tot += arr[i]; }
        o.TOTAL = tot;
        return o;
    }

    // bloques: top homes
    var topHomes = Array.from(closPorHome.entries()).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 25)
        .map(function(par) { return { home: nombreDe(par[0], censo.get(par[0])), n: par[1] }; });

    var salida = {
        workload: process.env.CENSONOM || "?",
        totalActivaciones: totalAct,
        totalConCuerpo: totalCuerpo,
        metodosDistintos: censo.size,
        cobertura: {
            R0: { acts: cob.R0.acts, pct: pcnt(cob.R0.acts), cuerpo: cob.R0.cuerpo, metodos: cob.R0.metodos },
            R1: { acts: cob.R1.acts, pct: pcnt(cob.R1.acts), cuerpo: cob.R1.cuerpo, metodos: cob.R1.metodos },
            R2: { acts: cob.R2.acts, pct: pcnt(cob.R2.acts), cuerpo: cob.R2.cuerpo, metodos: cob.R2.metodos },
        },
        categoriasPonderadas: porCategoria,
        coberturaR1MasQuickInline: (function() {
            var q = 0;
            censo.forEach(function(rec, m) { var c = clasif(m); if (esQuick(c)) q += rec.n; });
            return { actsR1: cob.R1.acts, actsQuick: q, pct: pcnt(cob.R1.acts + q) };
        })(),
        aristas: {
            total: aristas.total,
            sinCaller: aristas.sinCaller,
            desdeElegR0: { total: aristas.desdeR0.total, aElegR0: aristas.desdeR0.aR0, frac: frac(aristas.desdeR0.aR0, aristas.desdeR0.total) },
            desdeElegR1: { total: aristas.desdeR1.total, aElegR1: aristas.desdeR1.aR1, frac: frac(aristas.desdeR1.aR1, aristas.desdeR1.total),
                aElegR1oQuick: aristas.desdeR1.aR1oQuick, fracConQuick: frac(aristas.desdeR1.aR1oQuick, aristas.desdeR1.total),
                aElegR1oQuickoPrimOK: aristas.desdeR1.aR1oQuickoPrimOK, fracConQuickYPrimOK: frac(aristas.desdeR1.aR1oQuickoPrimOK, aristas.desdeR1.total) },
            haciaElegR0: { total: aristas.aR0.total, desdeElegR0: aristas.aR0.desdeR0, frac: frac(aristas.aR0.desdeR0, aristas.aR0.total) },
            haciaElegR1: { total: aristas.aR1.total, desdeElegR1: aristas.aR1.desdeR1, frac: frac(aristas.aR1.desdeR1, aristas.aR1.total) },
        },
        quick: {
            global: quickObj(quickGlobal),
            fallas: quickFallas,
            desdeCallersElegR0: quickObj(quickDesdeR0),
            desdeCallersElegR1: quickObj(quickDesdeR1),
        },
        bloques: { activacionesViejo: closViejo, activacionesFull: closFull, topHomes: topHomes },
        topMetodos: lista, // completa (ordenada por n desc)
        topFronteraDesdeR1: topMap(frontera, 60),
        topFronteraDesdeR0: topMap(fronteraR0, 60),
    };
    function pcnt(n) { return totalAct ? (100 * n / totalAct).toFixed(2) + "%" : "0%"; }
    function frac(a, b) { return b ? (100 * a / b).toFixed(2) + "%" : "-"; }

    var out = process.env.CENSOSAL || "censo-salida.json";
    fs.writeFileSync(out, JSON.stringify(salida, null, 1));
    console.error("== censo dinamico [" + salida.workload + "]: " + totalAct + " activaciones, " +
        censo.size + " metodos distintos ==");
    console.error("   cobertura R0 " + salida.cobertura.R0.pct + " | R1 " + salida.cobertura.R1.pct +
        " | R2 " + salida.cobertura.R2.pct);
    console.error("   aristas desde-R1 a-R1: " + salida.aristas.desdeElegR1.frac +
        " | quick global: " + salida.quick.global.TOTAL + " | bloques: " + (closViejo + closFull));
    console.error("   [json en " + out + "]");
}
