"use strict";
/*
 * jit2: stack-to-register mapping compiler for stack-zone mode.
 *
 * Compiles V3(+closures) methods to JS functions where operand-stack slots
 * live in JS locals (s0, s1, ...) whose depth is tracked at compile time.
 * Slots are spilled to the zone only at send sites (where the frame must be
 * observable/resumable) and reloaded on trampoline re-entry, distinguished
 * from internal jumps by a function-local `entering` flag. Each send site
 * has a monomorphic inline cache (class -> method/primitive), bypassing
 * findSelectorInClass on hits. Unsupported bytecodes bail the whole method
 * to the jit1 template compiler.
 *
 * Only active in stack-zone mode (generated code assumes frames).
 */

Object.subclass('Squeak.Compiler2',
'initialization', {
    initialize: function(vm) {
        this.vm = vm;
        this.fallback = new Squeak.Compiler(vm);
        this.bailCount = 0;
        this.okCount = 0;
    },
},
'accessing', {
    compile: function(method, optClassObj, optSelObj) {
        if (method.compiled === undefined) {
            method.compiled = false; // 1st time: defer (same policy as jit1)
            return;
        }
        if (method.methodSignFlag() // Sista: not supported yet
            || (typeof process !== "undefined" && process.env && process.env.JIT2BAIL)) {
            return this.fallback.compile(method, optClassObj, optSelObj);
        }
        var clsName = optClassObj && optClassObj.className(),
            sel = optSelObj && optSelObj.bytesAsString();
        var fn = this.generate2(method, clsName, sel);
        if (fn) {
            this.okCount++;
            method.compiled = fn;
        } else {
            this.bailCount++;
            return this.fallback.compile(method, optClassObj, optSelObj);
        }
    },
    enableSingleStepping: function(method, optClass, optSel) {
        // debugging always uses the jit1 debug/single-step generator
        return this.fallback.enableSingleStepping(method, optClass, optSel);
    },
},
'generating', {
    generate2: function(method, optClass, optSel) {
        try {
            return this.generateV3R(method, optClass, optSel);
        } catch (e) {
            if (e && e.bail) return null;
            throw e;
        }
    },
    bail: function(why) {
        throw { bail: true, why: why };
    },
    generateV3R: function(method, optClass, optSel) {
        this.method = method;
        this.pc = 0;
        this.endPC = 0;
        this.depth = 0;          // virtual operand-stack depth
        this.maxDepth = 0;
        this.knownDepth = true;  // false after unconditional jump/return until a label
        this.labelDepth = {};    // pc -> expected depth (from forward jumps / resumes)
        this.resumeDepth = {};   // pc -> depth to reload on trampoline re-entry
        this.needsLabel = {};
        this.sourceParts = [];   // list of {pc, code:[]} segments, one per instruction
        this.ics = [];
        var tempCount = method.methodTempCount();
        this.tempCount = tempCount;
        // pass over bytecodes
        this.done = false;
        while (!this.done) {
            this.instStart = this.pc;
            this.beginInstruction();
            var b = method.bytes[this.pc++];
            this.generateByte(b);
        }
        // assemble
        var parts = this.sourceParts;
        var src = [];
        var maxD = this.maxDepth;
        var decl = [];
        for (var i = 0; i < maxD; i++) decl.push("s" + i);
        src.push("var zone = vm.stack, fp = vm.fp, page = vm.zonePage;\n");
        src.push("var rcvr = vm.receiver, inst = rcvr.pointers, lit = vm.method.pointers;\n");
        // spBase = base del stack de operandos de ESTA activación (métodos y
        // blocks difieren); en entrada fresca depth=0 así que spBase = vm.sp,
        // en re-entrada el prelude del label lo deriva de la depth de resume
        src.push("var tB = vm.tempOffset, spBase = vm.sp;\n");
        if (decl.length) src.push("var ", decl.join(", "), ";\n");
        src.push("var entering = true;\n");
        src.push("while (true) switch (vm.pc) {\n");
        this.needsLabel[0] = true;
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (this.needsLabel[part.pc]) {
                src.push("case ", part.pc, ":\n");
                // profundidad a recargar: la depth estática de este label —
                // cubre resumes de sends Y transiciones intérprete->compilado
                // a mitad de método (loop heads con contador en el stack)
                var rd = this.emittedDepth[part.pc] || 0;
                src.push("if (entering) { entering = false; spBase = vm.sp - ", rd, ";");
                for (var k = 0; k < rd; k++)
                    src.push(" s", k, " = zone[spBase + ", 1 + k, "];");
                src.push(" }\n");
            }
            for (var j = 0; j < part.code.length; j++) src.push(part.code[j]);
        }
        src.push("default: if (vm.jit2Debug) { console.error('jit2 default pc=' + vm.pc + ' mbytes=' + vm.method.bytes.length); console.error('bytes: ' + Array.prototype.join.call(vm.method.bytes, ',')); console.error(String(vm.method.compiled).slice(0, 2000)); vm.jit2Debug = false; } vm.interpretOne(true); return;\n}");
        var funcName = (optClass && optSel)
            ? (optClass + "_" + optSel).replace(/[^a-zA-Z0-9_]/g, "ː")
            : "R_METHOD";
        var body = "'use strict';\nvar ics = arguments[0];\nreturn function " + funcName
            + "(vm) {\n" + src.join("") + "}";
        try {
            return new Function(body)(this.ics);
        } catch (e) {
            this.bail("syntax: " + e.message);
        }
    },
    beginInstruction: function() {
        // labels: if this pc is a known jump target, depths must agree
        var expected = this.labelDepth[this.instStart];
        if (!this.knownDepth) {
            if (expected === undefined) this.bail("unreachable code with unknown depth");
            this.depth = expected;
            this.knownDepth = true;
        } else if (expected !== undefined && expected !== this.depth) {
            this.bail("stack depth mismatch at label");
        }
        if (!this.emittedDepth) this.emittedDepth = {};
        this.emittedDepth[this.instStart] = this.depth;
        this.part = { pc: this.instStart, code: [] };
        this.sourceParts.push(this.part);
    },
    emit: function(/* ... */) {
        for (var i = 0; i < arguments.length; i++) this.part.code.push(arguments[i]);
    },
    push: function(expr) {
        this.emit("s", this.depth, " = ", expr, ";\n");
        this.depth++;
        if (this.depth > this.maxDepth) this.maxDepth = this.depth;
    },
    top: function() { return "s" + (this.depth - 1); },
    pop: function() { this.depth--; return "s" + this.depth; },
    slotAt: function(depthFromTop) { return "s" + (this.depth - 1 - depthFromTop); },
    spillAll: function() {
        for (var k = 0; k < this.depth; k++)
            this.emit("zone[spBase + ", 1 + k, "] = s", k, ";\n");
        this.emit("vm.sp = spBase + ", this.depth, ";\n");
    },
    activationCheck: function() {
        return "if (vm.fp !== fp || vm.zonePage !== page || vm.breakOutOfInterpreter !== false) return;\n";
    },
    markJumpTarget: function(dest) {
        this.needsLabel[dest] = true;
        if (dest > this.endPC) this.endPC = dest;
        if (dest <= this.instStart) { // backward: el label ya se emitió
            if (this.emittedDepth[dest] !== this.depth) this.bail("backward jump depth mismatch");
            return;
        }
        var expected = this.labelDepth[dest];
        if (expected === undefined) this.labelDepth[dest] = this.depth;
        else if (expected !== this.depth) this.bail("jump depth mismatch");
    },
    markResume: function(pc, depthAfter) {
        this.needsLabel[pc] = true;
        if (pc > this.endPC) this.endPC = pc; // el label de resume debe generarse
        if (this.resumeDepth[pc] !== undefined && this.resumeDepth[pc] !== depthAfter)
            this.bail("conflicting resume depths");
        this.resumeDepth[pc] = depthAfter;
        if (pc <= this.instStart) { // backward (interrupt check de back-jump)
            if (this.emittedDepth[pc] !== depthAfter) this.bail("backward resume depth mismatch");
            return;
        }
        var expected = this.labelDepth[pc];
        if (expected === undefined) this.labelDepth[pc] = depthAfter;
        else if (expected !== depthAfter) this.bail("resume depth mismatch");
    },
    endOfSegment: function() {
        // after return/unconditional jump: depth unknown until next label
        this.knownDepth = false;
        this.done = this.pc > this.endPC;
    },
},
'bytecodes', {
    generateByte: function(byte) {
        var b2, b3;
        switch (byte & 0xF8) {
            case 0x00: case 0x08: // push inst var
                this.push("inst[" + (byte & 0x0F) + "]"); break;
            case 0x10: case 0x18: // push temp
                this.push("zone[tB + " + (byte & 0xF) + "]"); break;
            case 0x20: case 0x28: case 0x30: case 0x38: // push literal
                this.push("lit[" + (1 + (byte & 0x1F)) + "]"); break;
            case 0x40: case 0x48: case 0x50: case 0x58: // push literal indirect
                this.push("lit[" + (1 + (byte & 0x1F)) + "].pointers[1]"); break;
            case 0x60: // storeAndPop inst var
                this.generateStoreInst(byte & 7, true); break;
            case 0x68: // storeAndPop temp
                this.emit("zone[tB + ", byte & 7, "] = ", this.pop(), ";\n"); break;
            case 0x70: // quick pushes
                switch (byte) {
                    case 0x70: this.push("rcvr"); break;
                    case 0x71: this.push("vm.trueObj"); break;
                    case 0x72: this.push("vm.falseObj"); break;
                    case 0x73: this.push("vm.nilObj"); break;
                    case 0x74: this.push("-1"); break;
                    case 0x75: this.push("0"); break;
                    case 0x76: this.push("1"); break;
                    case 0x77: this.push("2"); break;
                }
                break;
            case 0x78: // quick returns
                switch (byte) {
                    case 0x78: this.generateReturn("rcvr"); break;
                    case 0x79: this.generateReturn("vm.trueObj"); break;
                    case 0x7A: this.generateReturn("vm.falseObj"); break;
                    case 0x7B: this.generateReturn("vm.nilObj"); break;
                    case 0x7C: this.generateReturn(this.pop()); break;
                    case 0x7D: this.generateBlockReturn(); break;
                    default: this.bail("unusedBytecode " + byte);
                }
                break;
            case 0x80: case 0x88:
                this.generateExtended(byte); break;
            case 0x90: // short jump
                this.generateJump((byte & 7) + 1); break;
            case 0x98: // short conditional jump (jumpIfFalse)
                this.generateJumpIf(false, (byte & 7) + 1); break;
            case 0xA0: // long jump
                b2 = this.method.bytes[this.pc++];
                this.generateJump(((byte & 7) - 4) * 256 + b2); break;
            case 0xA8: // long conditional jump
                b2 = this.method.bytes[this.pc++];
                this.generateJumpIf(byte < 0xAC, (byte & 3) * 256 + b2); break;
            case 0xB0: case 0xB8: // arithmetic special sends
                this.generateNumericOp(byte); break;
            case 0xC0: case 0xC8: // quick prims
                this.generateQuickPrim(byte); break;
            case 0xD0: case 0xD8: // send literal selector, 0 args
                this.generateSend(1 + (byte & 0xF), 0); break;
            case 0xE0: case 0xE8: // 1 arg
                this.generateSend(1 + (byte & 0xF), 1); break;
            case 0xF0: case 0xF8: // 2 args
                this.generateSend(1 + (byte & 0xF), 2); break;
            default: this.bail("bytecode " + byte);
        }
    },
    generateExtended: function(byte) {
        var b2, b3;
        switch (byte) {
            case 0x80: // extended push
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.push("inst[" + (b2 & 0x3F) + "]"); break;
                    case 1: this.push("zone[tB + " + (b2 & 0x3F) + "]"); break;
                    case 2: this.push("lit[" + (1 + (b2 & 0x3F)) + "]"); break;
                    case 3: this.push("lit[" + (1 + (b2 & 0x3F)) + "].pointers[1]"); break;
                }
                break;
            case 0x81: // extended store (no pop)
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.generateStoreInst(b2 & 0x3F, false); break;
                    case 1: this.emit("zone[tB + ", b2 & 0x3F, "] = ", this.top(), ";\n"); break;
                    case 2: this.bail("store into literal");
                    case 3: this.emit("var assoc = lit[", 1 + (b2 & 0x3F), "]; assoc.dirty = true; assoc.pointers[1] = ", this.top(), ";\n"); break;
                }
                break;
            case 0x82: // extended store-pop
                b2 = this.method.bytes[this.pc++];
                switch (b2 >> 6) {
                    case 0: this.generateStoreInst(b2 & 0x3F, true); break;
                    case 1: this.emit("zone[tB + ", b2 & 0x3F, "] = ", this.pop(), ";\n"); break;
                    case 2: this.bail("store into literal");
                    case 3: this.emit("var assoc = lit[", 1 + (b2 & 0x3F), "]; assoc.dirty = true; assoc.pointers[1] = ", this.pop(), ";\n"); break;
                }
                break;
            case 0x83: // single extended send
                b2 = this.method.bytes[this.pc++];
                this.generateSend(1 + (b2 & 31), b2 >> 5);
                break;
            case 0x84: // double extended do-anything
                b2 = this.method.bytes[this.pc++];
                b3 = this.method.bytes[this.pc++];
                switch (b2 >> 5) {
                    case 0: this.generateSend(1 + b3, b2 & 31); break;
                    case 2: this.push("inst[" + b3 + "]"); break;
                    case 3: this.push("lit[" + (1 + b3) + "]"); break;
                    case 4: this.push("lit[" + (1 + b3) + "].pointers[1]"); break;
                    default: this.bail("doubleExtended op " + (b2 >> 5));
                }
                break;
            case 0x87: // pop
                this.depth--; break;
            case 0x88: // dup
                this.push(this.top()); break;
            case 0x89: // thisContext
                this.spillAll();
                this.push("vm.exportThisContext()");
                break;
            case 0x8F: // pushClosureCopy
                this.generateClosureCopy(); break;
            default:
                this.bail("extended " + byte); // 0x85/0x86 super, 0x8A-0x8E: jit1
        }
    },
    generateStoreInst: function(index, popIt) {
        var val = popIt ? this.pop() : this.top();
        // married-context write-through, same protocol as jit1 frames templates
        this.emit("if (rcvr.sqClass !== vm.contextClass_ || rcvr.frame == null) { inst[", index, "] = ", val, "; rcvr.dirty = true; }\n");
        this.emit("else { ");
        this.spillAll();
        this.emit("vm.pc = ", this.pc, "; vm.storeToMarriedContext(rcvr, ", index, ", ", val, "); ",
            this.activationCheck(), " }\n");
        this.markResume(this.pc, this.depth);
    },
    generateReturn: function(what) {
        this.emit("vm.pc = ", this.pc, "; vm.doReturn(", what, "); return;\n");
        this.endOfSegment();
    },
    generateBlockReturn: function() {
        this.emit("vm.pc = ", this.pc, "; vm.doBlockReturn(", this.pop(), "); return;\n");
        this.endOfSegment();
    },
    generateJump: function(distance) {
        var dest = this.pc + distance;
        if (distance < 0) {
            // backward jump: interrupt check; a process switch must find the
            // frame resumable, so spill live slots (loop back-edges: usually 0)
            this.spillAll();
            this.emit("if (vm.interruptCheckCounter-- <= 0) {\n",
                "  vm.pc = ", dest, "; vm.checkForInterrupts();\n",
                "  ", this.activationCheck(), "}\n");
            this.markResume(dest, this.depth);
        }
        this.markJumpTarget(dest);
        this.emit("vm.pc = ", dest, "; continue;\n");
        this.endOfSegment();
    },
    generateJumpIf: function(condition, distance) {
        var dest = this.pc + distance;
        var cond = this.pop();
        this.emit("if (", cond, " === vm.", condition, "Obj) { vm.pc = ", dest, "; continue; }\n");
        this.emit("else if (", cond, " !== vm.", !condition, "Obj) {\n");
        this.depth++; this.spillAll(); this.depth--; // cond back on stack as receiver
        this.emit("  vm.pc = ", this.pc, "; vm.send(vm.specialObjects[25], 0, false); return; }\n");
        this.markJumpTarget(dest);
        this.markResume(this.pc, this.depth);
    },
    generateSend: function(litIndex, argCount) {
        var ic = this.ics.length;
        this.ics.push({ c: null, m: null, a: 0, p: 0, k: null });
        var rcvrSlot = this.slotAt(argCount);
        this.spillAll();
        this.emit("vm.pc = ", this.pc, ";\n");
        this.emit("var ic = ics[", ic, "], rc = typeof ", rcvrSlot, " === 'number' ? vm.smallIntClass_ : ", rcvrSlot, ".sqClass;\n");
        this.emit("if (rc !== ic.c) vm.jit2FillIC(ic, lit[", litIndex, "], ", argCount, ", rc);\n");
        // receivers que son contexts casados: refrescar snapshot (mismo gate que sendZ)
        this.emit("if (rc === vm.contextClass_ && ", rcvrSlot, ".frame != null) vm.syncMarriedContext(", rcvrSlot, ");\n");
        this.emit("if (ic.p) { vm.verifyAtSelector = lit[", litIndex, "]; vm.verifyAtClass = rc; }\n");
        this.emit("vm.executeNewMethod(", rcvrSlot, ", ic.m, ic.a, ic.p, ic.k, lit[", litIndex, "]);\n");
        this.emit(this.activationCheck());
        this.depth -= argCount + 1;
        this.push("zone[vm.sp]"); // result (fast-path prim; resume reloads instead)
        this.markResume(this.pc, this.depth);
    },
    generateNumericOp: function(byte) {
        var a, b;
        switch (byte & 0xF) {
            case 0x0: case 0x1: { // + -
                var op = (byte & 0xF) === 0 ? "+" : "-";
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = vm.primHandler.signed32BitIntegerFor(", a, " ", op, " ", b, ");\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0x2: case 0x3: case 0x4: case 0x5: { // < > <= >=
                var cmp = ["<", ">", "<=", ">="][(byte & 0xF) - 2];
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = ", a, " ", cmp, " ", b, " ? vm.trueObj : vm.falseObj;\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0x6: case 0x7: { // = ~=
                var eq = (byte & 0xF) === 6;
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number') ",
                    a, " = ", a, " ", eq ? "===" : "!==", " ", b, " ? vm.trueObj : vm.falseObj;\n");
                this.emit("else if (", a, " === ", b, " && ", a, ".float === ", a, ".float) ",
                    a, " = vm.", eq ? "true" : "false", "Obj;\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            case 0xE: case 0xF: { // bitAnd: bitOr:
                var bop = (byte & 0xF) === 0xE ? "&" : "|";
                b = this.pop(); a = this.top();
                this.emit("if (typeof ", a, " === 'number' && typeof ", b, " === 'number' && (", a, "|0) === ", a, " && (", b, "|0) === ", b, ") ",
                    a, " = ", a, " ", bop, " ", b, ";\n");
                this.generateNumericFallback(a, b, byte & 0xF);
                break;
            }
            default: { // * / \\ @ bitShift: // : usar el camino genérico de vm
                b = this.pop(); a = this.top();
                this.generateNumericSlow(byte & 0xF);
                break;
            }
        }
    },
    generateNumericFallback: function(a, b, opIndex) {
        // a/b son locals; a ya tiene el resultado si el fast path aplicó.
        // Si no aplicó, mandar el send especial (stack: rcvr, arg).
        this.emit("else {\n");
        this.depth++; this.spillAll(); this.depth--;
        this.emit("  vm.pc = ", this.pc, "; vm.sendSpecial(", opIndex, "); ", this.activationCheck());
        this.emit("  ", a, " = zone[vm.sp];\n}\n");
        this.markResume(this.pc, this.depth);
    },
    generateNumericSlow: function(opIndex) {
        // sin fast path inline: siempre via camino del vm (pop2AndPush... via sendSpecial-like)
        this.depth++; this.spillAll(); this.depth--;
        var a = "s" + (this.depth - 1);
        this.emit("vm.pc = ", this.pc, "; vm.sp = spBase + ", this.depth + 1, ";\n");
        // replicar jit1: success+pop2AndPush<X>Result según op
        switch (opIndex) {
            case 0x8: this.emit("vm.success = true; vm.resultIsFloat = false; if (!vm.pop2AndPushNumResult(vm.stackIntOrFloat(1) * vm.stackIntOrFloat(0))) { vm.sendSpecial(8); ", this.activationCheck(), "}\n"); break;
            case 0x9: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.quickDivide(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(9); ", this.activationCheck(), "}\n"); break;
            case 0xA: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.mod(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(10); ", this.activationCheck(), "}\n"); break;
            case 0xB: this.emit("vm.success = true; if (!vm.primHandler.primitiveMakePoint(1, true)) { vm.sendSpecial(11); ", this.activationCheck(), "}\n"); break;
            case 0xC: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.safeShift(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(12); ", this.activationCheck(), "}\n"); break;
            case 0xD: this.emit("vm.success = true; if (!vm.pop2AndPushIntResult(vm.div(vm.stackInteger(1), vm.stackInteger(0)))) { vm.sendSpecial(13); ", this.activationCheck(), "}\n"); break;
            default: this.bail("numeric op " + opIndex);
        }
        this.emit(a, " = zone[vm.sp];\n");
        this.markResume(this.pc, this.depth);
    },
    generateQuickPrim: function(byte) {
        var lo = byte & 0xF;
        switch (lo) {
            case 0x6: { // ==
                var b = this.pop(), a = this.top();
                this.emit(a, " = ", a, " === ", b, " ? vm.trueObj : vm.falseObj;\n");
                return;
            }
            case 0x7: { // class
                var t = this.top();
                this.emit(t, " = typeof ", t, " === 'number' ? vm.specialObjects[5] : ", t, ".sqClass;\n");
                return;
            }
            case 0x0: { // at:
                var idx = this.slotAt(0), arr = this.slotAt(1);
                this.emit("if (", arr, ".sqClass === vm.specialObjects[7] && ", arr, ".pointers && typeof ", idx, " === 'number' && ", idx, " > 0 && ", idx, " <= ", arr, ".pointers.length) {\n",
                    "  ", arr, " = ", arr, ".pointers[", idx, " - 1];\n} else {\n");
                this.spillAll();
                this.emit("  var c = vm.primHandler.objectAt(true,true,false); if (vm.primHandler.success) { vm.sp -= 1; ", arr, " = c; } else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(16); ", this.activationCheck(),
                    "  ", arr, " = zone[vm.sp]; }\n}\n");
                this.depth--;
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x1: { // at:put:
                var val = this.slotAt(0), idx = this.slotAt(1), arr = this.slotAt(2);
                this.emit("if (", arr, ".sqClass === vm.specialObjects[7] && ", arr, ".pointers && typeof ", idx, " === 'number' && ", idx, " > 0 && ", idx, " <= ", arr, ".pointers.length) {\n",
                    "  ", arr, ".pointers[", idx, " - 1] = ", val, "; ", arr, ".dirty = true; ", arr, " = ", val, ";\n} else {\n");
                this.spillAll();
                // puede flushear (context casado): pc de re-ejecución idempotente
                this.emit("  vm.pc = ", this.instStart, "; vm.primHandler.objectAtPut(true,true,false); if (vm.fp !== fp || vm.zonePage !== page) return;\n",
                    "  if (vm.primHandler.success) { vm.sp -= 2; ", arr, " = ", val, "; } else {\n",
                    "  vm.pc = ", this.pc, "; vm.sendSpecial(17); ", this.activationCheck(),
                    "  ", arr, " = zone[vm.sp]; }\n}\n");
                this.depth -= 2;
                this.needsLabel[this.instStart] = true;
                this.labelDepth[this.instStart] = this.depth + 2;
                this.resumeDepth[this.instStart] = this.depth + 2;
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x2: { // size
                var t = this.top();
                this.emit("if (", t, ".sqClass === vm.specialObjects[7]) ", t, " = ", t, ".pointersSize();\n",
                    "else if (", t, ".sqClass === vm.specialObjects[6]) ", t, " = ", t, ".bytesSize();\n",
                    "else {\n");
                this.spillAll();
                this.emit("  vm.pc = ", this.pc, "; vm.sendSpecial(18); ", this.activationCheck(),
                    "  ", t, " = zone[vm.sp];\n}\n");
                this.markResume(this.pc, this.depth);
                return;
            }
            case 0x9: case 0xA: case 0xB: { // value value: do:
                this.spillAll();
                var rcvrSlot = this.slotAt(lo === 0x9 ? 0 : 1);
                this.emit("vm.pc = ", this.pc, "; if (!vm.primHandler.quickSendOther(", rcvrSlot, ", ", lo, ")) vm.sendSpecial(", lo + 16, "); return;\n");
                this.depth -= (lo === 0x9 ? 0 : 1);
                this.markResume(this.pc, this.depth);
                this.endOfSegment();
                // tras el return el resultado queda en zone: el resume lo recarga
                return;
            }
            default: // next nextPut: atEnd blockCopy: new new: x y -> jit1
                this.bail("quick prim " + lo);
        }
    },
    generateClosureCopy: function() {
        var b = this.method.bytes;
        var numArgsNumCopied = b[this.pc++],
            numArgs = numArgsNumCopied & 0xF,
            numCopied = numArgsNumCopied >> 4,
            blockSize = b[this.pc++] * 256 + b[this.pc++];
        var from = this.pc, to = from + blockSize;
        // marry del frame activo: la zona y vm.sp deben reflejar el estado real
        // (el snapshot del context casado y el GC leen vm.sp)
        this.spillAll();
        this.emit("var closure = vm.instantiateClass(vm.specialObjects[36], ", numCopied, ");\n");
        this.emit("closure.pointers[0] = vm.activeContextObj(); vm.reclaimableContextCount = 0;\n");
        this.emit("closure.pointers[1] = ", from + this.method.pointers.length * 4 + 1, ";\n");
        this.emit("closure.pointers[2] = ", numArgs, ";\n");
        for (var i = 0; i < numCopied; i++)
            this.emit("closure.pointers[", 3 + i, "] = ", this.slotAt(numCopied - i - 1), ";\n");
        this.depth -= numCopied;
        this.push("closure");
        this.emit("vm.pc = ", to, "; continue;\n");
        this.markJumpTarget(to);
        // el cuerpo del block arranca con stack vacío (activación fresca)
        this.needsLabel[from] = true;
        this.labelDepth[from] = 0;
        this.resumeDepth[from] = 0;
        if (to > this.endPC) this.endPC = to;
        this.endOfSegment();
    },
});

// vm-side support
Object.extend(Squeak.Interpreter.prototype, 'jit2 support', {
    jit2FillIC: function(ic, selector, argCount, lookupClass) {
        var entry = this.findSelectorInClass(selector, argCount, lookupClass);
        ic.c = lookupClass;
        ic.m = entry.method;
        ic.a = entry.argCount;
        ic.p = entry.primIndex;
        ic.k = entry.mClass;
    },
});
