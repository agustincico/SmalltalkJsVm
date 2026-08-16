"use strict";
/*
 * Copyright (c) 2013-2025 Vanessa Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

Object.subclass('Squeak.Primitives',
'initialization', {
    initialize: function(vm, display) {
        this.vm = vm;
        this.oldPrims = !this.vm.image.hasClosures;
        this.allowAccessBeyondSP = this.oldPrims;
        this.deferDisplayUpdates = false;
        this.semaphoresToSignal = [];
        this.initDisplay(display);
        this.initAtCache();
        this.initModules();
        this.initPlugins();
        if (vm.image.isSpur) {
            this.charFromInt = this.charFromIntSpur;
            this.charToInt = this.charToIntSpur;
            this.identityHash = this.identityHashSpur;
        }
    },
    initDisplay: function(display) {
        // Placeholder (can be replaced by a display module at runtime, before starting the Squeak interpreter)
        this.display = display;
    },
    initModules: function() {
        this.loadedModules = {};
        this.builtinModules = {};
        this.patchModules = {};
        this.interpreterProxy = new Squeak.InterpreterProxy(this.vm);
    },
    initPlugins: function() {
        // Empty placeholder (can be replaced by a plugins module at runtime, before starting the Squeak interpreter)
    }
},
'dispatch', {
    quickSendOther: function(rcvr, lobits) {
        // returns true if it succeeds
        this.success = true;
        switch (lobits) {
            case 0x0: return this.popNandPushIfOK(2, this.objectAt(true,true,false)); // at:
            case 0x1: return this.popNandPushIfOK(3, this.objectAtPut(true,true,false)); // at:put:
            case 0x2: return this.popNandPushIfOK(1, this.objectSize(true)); // size
            //case 0x3: return false; // next
            //case 0x4: return false; // nextPut:
            //case 0x5: return false; // atEnd
            case 0x6: return this.popNandPushBoolIfOK(2, this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 0x7: return this.popNandPushIfOK(1,this.vm.getClass(this.vm.top())); // class
            case 0x8: return this.popNandPushIfOK(2,this.doBlockCopy()); // blockCopy:
            case 0x9: return this.primitiveBlockValue(0); // value
            case 0xA: return this.primitiveBlockValue(1); // value:
            //case 0xB: return false; // do:
            //case 0xC: return false; // new
            //case 0xD: return false; // new:
            //case 0xE: return false; // x
            //case 0xF: return false; // y
        }
        return false;
    },
    doPrimitive: function(index, argCount, primMethod) {
        this.success = true;
        switch (index) {
            // Integer Primitives (0-19)
            case 1: return this.popNandPushIntIfOK(argCount+1,this.stackInteger(1) + this.stackInteger(0));  // Integer.add
            case 2: return this.popNandPushIntIfOK(argCount+1,this.stackInteger(1) - this.stackInteger(0));  // Integer.subtract
            case 3: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) < this.stackInteger(0));   // Integer.less
            case 4: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) > this.stackInteger(0));   // Integer.greater
            case 5: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) <= this.stackInteger(0));  // Integer.leq
            case 6: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) >= this.stackInteger(0));  // Integer.geq
            case 7: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) === this.stackInteger(0)); // Integer.equal
            case 8: return this.popNandPushBoolIfOK(argCount+1, this.stackInteger(1) !== this.stackInteger(0)); // Integer.notequal
            case 9: return this.popNandPushIntIfOK(argCount+1,this.stackInteger(1) * this.stackInteger(0));  // Integer.multiply *
            case 10: return this.popNandPushIntIfOK(argCount+1,this.vm.quickDivide(this.stackInteger(1),this.stackInteger(0)));  // Integer.divide /  (fails unless exact)
            case 11: return this.popNandPushIntIfOK(argCount+1,this.vm.mod(this.stackInteger(1),this.stackInteger(0)));  // Integer.mod \\
            case 12: return this.popNandPushIntIfOK(argCount+1,this.vm.div(this.stackInteger(1),this.stackInteger(0)));  // Integer.div //
            case 13: return this.popNandPushIntIfOK(argCount+1,this.stackInteger(1) / this.stackInteger(0) | 0);  // Integer.quo
            case 14: return this.popNandPushIfOK(argCount+1,this.doBitAnd());  // SmallInt.bitAnd
            case 15: return this.popNandPushIfOK(argCount+1,this.doBitOr());  // SmallInt.bitOr
            case 16: return this.popNandPushIfOK(argCount+1,this.doBitXor());  // SmallInt.bitXor
            case 17: return this.popNandPushIfOK(argCount+1,this.doBitShift());  // SmallInt.bitShift
            case 18: return this.primitiveMakePoint(argCount, false);
            case 19: return false;                                 // Guard primitive for simulation -- *must* fail
            // LargeInteger Primitives (20-39)
            // 32-bit logic is aliased to Integer prims above
            case 20: return this.primitiveRemLargeIntegers(argCount);
            case 21: return this.primitiveAddLargeIntegers(argCount);
            case 22: return this.primitiveSubtractLargeIntegers(argCount);
            case 23: return this.primitiveLessThanLargeIntegers(argCount);
            case 24: return this.primitiveGreaterThanLargeIntegers(argCount);
            case 25: return this.primitiveLessOrEqualLargeIntegers(argCount);
            case 26: return this.primitiveGreaterOrEqualLargeIntegers(argCount);
            case 27: return this.primitiveEqualLargeIntegers(argCount);
            case 28: return this.primitiveNotEqualLargeIntegers(argCount);
            case 29: return this.primitiveMultiplyLargeIntegers(argCount);
            case 30: return this.primitiveDivideLargeIntegers(argCount);
            case 31: return this.primitiveModLargeIntegers(argCount);
            case 32: return this.primitiveDivLargeIntegers(argCount);
            case 33: return this.primitiveQuoLargeIntegers(argCount);
            case 34: return this.primitiveBitAndLargeIntegers(argCount);
            case 35: return this.primitiveBitOrLargeIntegers(argCount);
            case 36: return this.primitiveBitXorLargeIntegers(argCount);
            case 37: return this.primitiveBitShiftLargeIntegers(argCount);
            case 38: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,false)); // Float basicAt
            case 39: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,false)); // Float basicAtPut
            // Float Primitives (40-59)
            case 40: return this.popNandPushFloatIfOK(argCount+1,this.stackInteger(0)); // primitiveAsFloat
            case 41: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)+this.stackFloat(0));  // Float +
            case 42: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)-this.stackFloat(0));  // Float -
            case 43: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)<this.stackFloat(0));  // Float <
            case 44: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)>this.stackFloat(0));  // Float >
            case 45: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)<=this.stackFloat(0));  // Float <=
            case 46: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)>=this.stackFloat(0));  // Float >=
            case 47: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)===this.stackFloat(0));  // Float =
            case 48: return this.popNandPushBoolIfOK(argCount+1, this.stackFloat(1)!==this.stackFloat(0));  // Float !=
            case 49: return this.popNandPushFloatIfOK(argCount+1,this.stackFloat(1)*this.stackFloat(0));  // Float.mul
            case 50: return this.popNandPushFloatIfOK(argCount+1,this.safeFDiv(this.stackFloat(1),this.stackFloat(0)));  // Float.div
            case 51: return this.popNandPushIfOK(argCount+1,this.floatAsSmallInt(this.stackFloat(0)));  // Float.asInteger
            case 52: return this.popNandPushFloatIfOK(argCount+1,this.floatFractionPart(this.stackFloat(0)));
            case 53: return this.popNandPushIntIfOK(argCount+1, this.frexp_exponent(this.stackFloat(0)) - 1); // Float.exponent
            case 54: return this.popNandPushFloatIfOK(argCount+1, this.ldexp(this.stackFloat(1), this.stackFloat(0))); // Float.timesTwoPower
            case 55: return this.popNandPushFloatIfOK(argCount+1, Math.sqrt(this.stackFloat(0))); // SquareRoot
            case 56: return this.popNandPushFloatIfOK(argCount+1, Math.sin(this.stackFloat(0))); // Sine
            case 57: return this.popNandPushFloatIfOK(argCount+1, Math.atan(this.stackFloat(0))); // Arctan
            case 58: return this.popNandPushFloatIfOK(argCount+1, Math.log(this.stackFloat(0))); // LogN
            case 59: return this.popNandPushFloatIfOK(argCount+1, Math.exp(this.stackFloat(0))); // Exp
            // Subscript and Stream Primitives (60-67)
            case 60: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,false)); // basicAt:
            case 61: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,false)); // basicAt:put:
            case 62: return this.popNandPushIfOK(argCount+1, this.objectSize(false)); // size
            case 63: return this.popNandPushIfOK(argCount+1, this.objectAt(false,true,false)); // String.basicAt:
            case 64: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,true,false)); // String.basicAt:put:
            case 65: return this.primitiveStreamNext(argCount); // primitiveNext
            case 66: return this.primitiveStreamNextPut(argCount); // primitiveNextPut
            case 67: return this.primitiveStreamAtEnd(argCount); // primitiveAtEnd
            // StorageManagement Primitives (68-79)
            case 68: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // Method.objectAt:
            case 69: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // Method.objectAt:put:
            case 70: return this.popNandPushIfOK(argCount+1, this.instantiateClass(this.stackNonInteger(0), 0)); // Class.new
            case 71: return this.popNandPushIfOK(argCount+1, this.instantiateClass(this.stackNonInteger(1), this.stackPos32BitInt(0))); // Class.new:
            case 72: return this.primitiveArrayBecome(argCount, false, true); // one way, do copy hash
            case 73: return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // instVarAt:
            case 74: return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // instVarAt:put:
            case 75: return this.popNandPushIfOK(argCount+1, this.identityHash(this.stackNonInteger(0))); // Object.identityHash
            case 76: return this.primitiveStoreStackp(argCount);  // (Blue Book: primitiveAsObject)
            case 77: return this.popNandPushIfOK(argCount+1, this.someInstanceOf(this.stackNonInteger(0))); // Class.someInstance
            case 78: return this.popNandPushIfOK(argCount+1, this.nextInstanceAfter(this.stackNonInteger(0))); // Object.nextInstance
            case 79: return this.primitiveNewMethod(argCount); // Compiledmethod.new
            // Control Primitives (80-89)
            case 80: return this.popNandPushIfOK(argCount+1,this.doBlockCopy()); // blockCopy:
            case 81: return this.primitiveBlockValue(argCount); // BlockContext.value
            case 82: return this.primitiveBlockValueWithArgs(argCount); // BlockContext.valueWithArguments:
            case 83: return this.vm.primitivePerform(argCount); // Object.perform:(with:)*
            case 84: return this.vm.primitivePerformWithArgs(argCount, false); //  Object.perform:withArguments:
            case 85: return this.primitiveSignal(); // Semaphore.wait
            case 86: return this.primitiveWait(); // Semaphore.wait
            case 87: return this.primitiveResume(); // Process.resume
            case 88: return this.primitiveSuspend(); // Process.suspend
            case 89: return this.vm.flushMethodCache(); //primitiveFlushCache
            // Input/Output Primitives (90-109)
            case 90: return this.primitiveMousePoint(argCount); // mousePoint
            case 91: return this.primitiveTestDisplayDepth(argCount); // cursorLocPut in old images
            case 92: this.vm.warnOnce("missing primitive: 92 (primitiveSetDisplayMode)"); return false;
            case 93: return this.primitiveInputSemaphore(argCount);
            case 94: return this.primitiveGetNextEvent(argCount);
            case 95: return this.primitiveInputWord(argCount);
            case 96: return this.namedPrimitive('BitBltPlugin', 'primitiveCopyBits', argCount);
            case 97: return this.primitiveSnapshot(argCount);
            case 98: return this.primitiveStoreImageSegment(argCount);
            case 99: return this.primitiveLoadImageSegment(argCount);
            case 100: return this.vm.primitivePerformWithArgs(argCount, true); // Object.perform:withArguments:inSuperclass: (Blue Book: primitiveSignalAtTick)
            case 101: return this.primitiveBeCursor(argCount); // Cursor.beCursor
            case 102: return this.primitiveBeDisplay(argCount); // DisplayScreen.beDisplay
            case 103: return this.primitiveScanCharacters(argCount);
            case 104: this.vm.warnOnce("missing primitive: 104 (primitiveDrawLoop)"); return false;
            case 105: return this.popNandPushIfOK(argCount+1, this.doStringReplace()); // string and array replace
            case 106: return this.primitiveScreenSize(argCount); // actualScreenSize
            case 107: return this.primitiveMouseButtons(argCount); // Sensor mouseButtons
            case 108: return this.primitiveKeyboardNext(argCount); // Sensor kbdNext
            case 109: return this.primitiveKeyboardPeek(argCount); // Sensor kbdPeek
            // System Primitives (110-119)
            case 110: return this.popNandPushBoolIfOK(argCount+1, this.vm.stackValue(1) === this.vm.stackValue(0)); // ==
            case 111: return this.popNandPushIfOK(argCount+1, this.vm.getClass(this.vm.top())); // Object.class
            case 112: return this.popNandPushIfOK(argCount+1, this.vm.image.bytesLeft()); //primitiveBytesLeft
            case 113: return this.primitiveQuit(argCount);
            case 114: return this.primitiveExitToDebugger(argCount);
            case 115: return this.primitiveChangeClass(argCount);
            case 116: return this.vm.flushMethodCacheForMethod(this.vm.top());  // after Squeak 2.2 uses 119
            case 117: return this.doNamedPrimitive(argCount, primMethod); // named prims
            case 118: return this.primitiveDoPrimitiveWithArgs(argCount);
            case 119: return this.vm.flushMethodCacheForSelector(this.vm.top()); // before Squeak 2.3 uses 116
            // Miscellaneous Primitives (120-149)
            case 120: return this.primitiveCalloutToFFI(argCount, primMethod);
            case 121: return this.primitiveImageName(argCount); //get+set imageName
            case 122: return this.primitiveReverseDisplay(argCount); // Blue Book: primitiveImageVolume
            case 123: this.vm.warnOnce("missing primitive: 123 (primitiveValueUninterruptably)"); return false;
            case 124: return this.popNandPushIfOK(argCount+1, this.registerSemaphore(Squeak.splOb_TheLowSpaceSemaphore));
            case 125: return this.popNandPushIfOK(argCount+1, this.setLowSpaceThreshold());
            case 126: return this.primitiveDeferDisplayUpdates(argCount);
            case 127: return this.primitiveShowDisplayRect(argCount);
            case 128: return this.primitiveArrayBecome(argCount, true, true); // both ways, do copy hash
            case 129: return this.popNandPushIfOK(argCount+1, this.vm.image.specialObjectsArray); //specialObjectsOop
            case 130: return this.primitiveFullGC(argCount);
            case 131: return this.primitivePartialGC(argCount);
            case 132: return this.popNandPushBoolIfOK(argCount+1, this.pointsTo(this.stackNonInteger(1), this.vm.top())); //Object.pointsTo
            case 133: return this.popNIfOK(argCount); //TODO primitiveSetInterruptKey
            case 134: return this.popNandPushIfOK(argCount+1, this.registerSemaphore(Squeak.splOb_TheInterruptSemaphore));
            case 135: return this.popNandPushIfOK(argCount+1, this.millisecondClockValue());
            case 136: return this.primitiveSignalAtMilliseconds(argCount); //Delay signal:atMs:();
            case 137: return this.popNandPushIfOK(argCount+1, this.secondClock()); // seconds since Jan 1, 1901
            case 138: return this.popNandPushIfOK(argCount+1, this.someObject()); // Object.someObject
            case 139: return this.popNandPushIfOK(argCount+1, this.nextObject(this.vm.top())); // Object.nextObject
            case 140: return this.primitiveBeep(argCount);
            case 141: return this.primitiveClipboardText(argCount);
            case 142: return this.popNandPushIfOK(argCount+1, this.makeStString(this.filenameToSqueak(Squeak.vmPath)));
            case 143: // short at and shortAtPut
            case 144: return this.primitiveShortAtAndPut(argCount);
            case 145: return this.primitiveConstantFill(argCount);
            case 146: return this.namedPrimitive('JoystickTabletPlugin', 'primitiveReadJoystick', argCount);
            case 147: return this.namedPrimitive('BitBltPlugin', 'primitiveWarpBits', argCount);
            case 148: return this.popNandPushIfOK(argCount+1, this.vm.image.clone(this.vm.top())); //shallowCopy
            case 149: return this.primitiveGetAttribute(argCount);
            // File Primitives (150-169)
            case 150: if (this.oldPrims) return this.primitiveFileAtEnd(argCount);
            case 151: if (this.oldPrims) return this.primitiveFileClose(argCount);
            case 152: if (this.oldPrims) return this.primitiveFileGetPosition(argCount);
            case 153: if (this.oldPrims) return this.primitiveFileOpen(argCount);
            case 154: if (this.oldPrims) return this.primitiveFileRead(argCount);
            case 155: if (this.oldPrims) return this.primitiveFileSetPosition(argCount);
            case 156: if (this.oldPrims) return this.primitiveFileDelete(argCount);
                else return this.primitiveBytesEqual(argCount);
            case 157: if (this.oldPrims) return this.primitiveFileSize(argCount);
                break;  // fail 150-157 if fell through
            case 158: if (this.oldPrims) return this.primitiveFileWrite(argCount);
                else return this.primitiveCompareWith(argCount);
            case 159: if (this.oldPrims) return this.primitiveFileRename(argCount);
                return this.popNandPushIntIfOK(argCount+1, this.stackSigned53BitInt(0) * 1664525 & 0xFFFFFFF); // primitiveHashMultiply
            case 160: if (this.oldPrims) return this.primitiveDirectoryCreate(argCount);
                else return this.primitiveAdoptInstance(argCount);
            case 161: if (this.oldPrims) return this.primitiveDirectoryDelimitor(argCount);
                this.vm.warnOnce("missing primitive: 161 (primitiveSetIdentityHash)"); return false;
            case 162: if (this.oldPrims) return this.primitiveDirectoryLookup(argCount);
                break;  // fail
            case 163: if (this.oldPrims) return this.primitiveDirectoryDelete(argCount);
                else this.vm.warnOnce("missing primitive: 163 (primitiveGetImmutability)"); return false;
            case 164: return this.popNandPushIfOK(argCount+1, this.vm.trueObj); // Fake primitiveSetImmutability
            case 165:
            case 166: return this.primitiveIntegerAtAndPut(argCount);
            case 167: return false; // Processor.yield
            case 168: return this.primitiveCopyObject(argCount);
            case 169: if (this.oldPrims) return this.primitiveDirectorySetMacTypeAndCreator(argCount);
                else return this.popNandPushBoolIfOK(argCount+1, this.vm.stackValue(1) !== this.vm.stackValue(0)); //new: primitiveNotIdentical
            // Sound Primitives (170-199)
            case 170: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStart', argCount);
                else return this.primitiveAsCharacter(argCount);
            case 171: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartWithSemaphore', argCount);
                else return this.popNandPushIfOK(argCount+1, this.stackNonInteger(0).hash); //primitiveImmediateAsInteger
            case 172: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStop', argCount);
                this.vm.warnOnce("missing primitive: 172 (primitiveFetchMourner)");
                return this.popNandPushIfOK(argCount+1, this.vm.nilObj); // do not fail
            case 173: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundAvailableSpace', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,true)); // slotAt:
            case 174: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySamples', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,true)); // slotAt:put:
            case 175: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundPlaySilence', argCount);
                else if (!this.vm.image.isSpur) {
                    this.vm.warnOnce("primitive 175 called in non-spur image"); // workaround for Cuis
                    return this.popNandPushIfOK(argCount+1, this.identityHash(this.stackNonInteger(0)));
                } else return this.popNandPushIfOK(argCount+1, this.behaviorHash(this.stackNonInteger(0)));
            case 176: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primWaveTableSoundmixSampleCountintostartingAtpan', argCount);
                else return this.popNandPushIfOK(argCount+1, this.vm.image.isSpur ? 0x3FFFFF : 0xFFF); // primitiveMaxIdentityHash
            case 177: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primFMSoundmixSampleCountintostartingAtpan', argCount);
                return this.popNandPushIfOK(argCount+1, this.allInstancesOf(this.stackNonInteger(0)));
            case 178: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primPluckedSoundmixSampleCountintostartingAtpan', argCount);
                return false; // allObjectsDo fallback code is just as fast and uses less memory
            case 179: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primSampledSoundmixSampleCountintostartingAtpan', argCount);
                break;  // fail
            case 180: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixFMSound', argCount);
                return false; // growMemoryByAtLeast
            case 181: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixPluckedSound', argCount);
                return this.primitiveSizeInBytesOfInstance(argCount);
            case 182: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'oldprimSampledSoundmixSampleCountintostartingAtleftVolrightVol', argCount);
                return this.primitiveSizeInBytes(argCount);
            case 183: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveApplyReverb', argCount);
                else return this.primitiveIsPinned(argCount);
            case 184: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixLoopedSampledSound', argCount);
                else return this.primitivePin(argCount);
            case 185: if (this.oldPrims) return this.namedPrimitive('SoundGenerationPlugin', 'primitiveMixSampledSound', argCount);
                else return this.primitiveExitCriticalSection(argCount);
            case 186: if (this.oldPrims) break; // unused
                else return this.primitiveEnterCriticalSection(argCount);
            case 187: if (this.oldPrims) break; // unused
                else return this.primitiveTestAndSetOwnershipOfCriticalSection(argCount);
            case 188: if (this.oldPrims) break; // unused
                else return this.primitiveExecuteMethodArgsArray(argCount);
            case 189: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundInsertSamples', argCount);
                return false; // fail to fall back to primitiveExecuteMethodArgsArray (188)
            case 190: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStartRecording', argCount);
            case 191: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundStopRecording', argCount);
            case 192: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundGetRecordingSampleRate', argCount);
            case 193: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundRecordSamples', argCount);
            case 194: if (this.oldPrims) return this.namedPrimitive('SoundPlugin', 'primitiveSoundSetRecordLevel', argCount);
                break;  // fail 190-194 if fell through
            case 195: return false; // Context.findNextUnwindContextUpTo:
            case 196: return false; // Context.terminateTo:
            case 197: return false; // Context.findNextHandlerContextStarting
            case 198: return false; // MarkUnwindMethod (must fail)
            case 199: return false; // MarkHandlerMethod (must fail)
            // Networking Primitives (200-229)
            case 200: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveInitializeNetwork', argCount);
                else return this.primitiveClosureCopyWithCopiedValues(argCount);
            case 201: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartNameLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 202: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverNameLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 203: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStartAddressLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 204: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAddressLookupResult', argCount);
                else return this.primitiveClosureValue(argCount);
            case 205: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverAbortLookup', argCount);
                else return this.primitiveClosureValue(argCount);
            case 206: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverLocalAddress', argCount);
                else return  this.primitiveClosureValueWithArgs(argCount);
            case 207: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverStatus', argCount);
                else return this.primitiveFullClosureValue(argCount);
            case 208: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveResolverError', argCount);
                else return this.primitiveFullClosureValueWithArgs(argCount);
            case 209: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCreate', argCount);
                else return this.primitiveFullClosureValueNoContextSwitch(argCount);
            case 210: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketDestroy', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAt(false,false,false)); // contextAt:
            case 211: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectionStatus', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectAtPut(false,false,false)); // contextAt:put:
            case 212: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketError', argCount);
                else return this.popNandPushIfOK(argCount+1, this.objectSize(false)); // contextSize
            case 213: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalAddress', argCount);
            case 214: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketLocalPort', argCount);
            case 215: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemoteAddress', argCount);
            case 216: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketRemotePort', argCount);
            case 217: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketConnectToPort', argCount);
            case 218: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketListenWithOrWithoutBacklog', argCount);
                else return this.primitiveDoNamedPrimitive(argCount);
            case 219: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketCloseConnection', argCount);
            case 220: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketAbortConnection', argCount);
                break;  // fail 212-220 if fell through
            case 221: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataBufCount', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 222: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketReceiveDataAvailable', argCount);
                else return this.primitiveClosureValueNoContextSwitch(argCount);
            case 223: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDataBufCount', argCount);
            case 224: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketSendDone', argCount);
            case 225: if (this.oldPrims) return this.namedPrimitive('SocketPlugin', 'primitiveSocketAccept', argCount);
                break;  // fail 223-229 if fell through
            // 225-229: unused
            // Other Primitives (230-249)
            case 230: return this.primitiveRelinquishProcessorForMicroseconds(argCount);
            case 231: return this.primitiveForceDisplayUpdate(argCount);
            case 232: this.vm.warnOnce("missing primitive: 232 (primitiveFormPrint)"); return false;
            case 233: return this.primitiveSetFullScreen(argCount);
            case 234: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveDecompressFromByteArray', argCount);
            case 235: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompareString', argCount);
            case 236: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveConvert8BitSigned', argCount);
            case 237: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveCompressToByteArray', argCount);
                break;  // fail 234-237 if fell through
            case 238: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortOpen', argCount);
                else return this.namedPrimitive('FloatArrayPlugin', 'primitiveAt', argCount);
            case 239: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortClose', argCount);
                else return this.namedPrimitive('FloatArrayPlugin', 'primitiveAtPut', argCount);
            case 240: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortWrite', argCount);
                else return this.popNandPushIfOK(argCount+1, this.microsecondClockUTC());
            case 241: if (this.oldPrims) return this.namedPrimitive('SerialPlugin', 'primitiveSerialPortRead', argCount);
                else return this.popNandPushIfOK(argCount+1, this.microsecondClockLocal());
            case 242: if (this.oldPrims) break; // unused
                else return this.primitiveSignalAtUTCMicroseconds(argCount);
            case 243: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveTranslateStringWithTable', argCount);
                else this.vm.warnOnce("missing primitive: 243 (primitiveUpdateTimeZone)"); return false;
            case 244: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindFirstInString' , argCount);
            case 245: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveIndexOfAsciiInString', argCount);
            case 246: if (this.oldPrims) return this.namedPrimitive('MiscPrimitivePlugin', 'primitiveFindSubstring', argCount);
                break;  // fail 243-246 if fell through
            // 247: unused
            case 248: return this.primitiveArrayBecome(argCount, false, false); // one way, do not copy hash
            case 249: return this.primitiveArrayBecome(argCount, false, true); // one way, opt. copy hash
            case 254: return this.primitiveVMParameter(argCount);
            //MIDI Primitives (520-539)
            case 521: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIClosePort', argCount);
            case 522: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetClock', argCount);
            case 523: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortCount', argCount);
            case 524: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortDirectionality', argCount);
            case 525: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIGetPortName', argCount);
            case 526: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIOpenPort', argCount);
            case 527: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIParameterGetOrSet', argCount);
            case 528: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIRead', argCount);
            case 529: return this.namedPrimitive('MIDIPlugin', 'primitiveMIDIWrite', argCount);
            // 530-539: reserved for extended MIDI primitives
            // Sound Codec Primitives
            case 550: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeMono', argCount);
            case 551: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveDecodeStereo', argCount);
            case 552: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeMono', argCount);
            case 553: return this.namedPrimitive('ADPCMCodecPlugin', 'primitiveEncodeStereo', argCount);
            // External primitive support primitives (570-574)
            // case 570: return this.primitiveFlushExternalPrimitives(argCount);
            case 571: return this.primitiveUnloadModule(argCount);
            case 572: return this.primitiveListBuiltinModule(argCount);
            case 573: return this.primitiveListLoadedModule(argCount);
            case 575: return this.primitiveHighBit(argCount);
            // this is not really a primitive, see findSelectorInClass()
            case 576: return this.vm.primitiveInvokeObjectAsMethod(argCount, primMethod);
            case 578: return this.primitiveSuspendAndBackupPC(); // advertised by bit 5 of vmParameterAt: 65
        }
        console.error("primitive " + index + " not implemented yet");
        return false;
    },
    namedPrimitive: function(modName, functionName, argCount) {
        // duplicated in loadFunctionFrom()
        var mod = modName === "" ? this : this.loadedModules[modName];
        var justLoaded = false;
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
            justLoaded = true;
        }
        var result = false;
        var sp = this.vm.sp;
        if (mod) {
            this.interpreterProxy.argCount = argCount;
            this.interpreterProxy.primitiveName = functionName;
            var primitive = mod[functionName];
            if (typeof primitive === "function") {
                result = mod[functionName](argCount);
            } else if (typeof primitive === "string") {
                // allow late binding for built-ins
                result = this[primitive](argCount);
            } else {
                this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
            }
        } else if (justLoaded) {
            if (this.success) this.vm.warnOnce("missing module: " + modName + " (" + functionName + ")");
            else this.vm.warnOnce("failed to load module: " + modName + " (" + functionName + ")");
        }
        if ((result === true || (result !== false && this.success)) && this.vm.sp !== sp - argCount && !this.vm.frozen) {
            this.vm.warnOnce("stack unbalanced after primitive " + modName + "." + functionName, "error");
        }
        if (result === true || result === false) return result;
        return this.success;
    },
    doNamedPrimitive: function(argCount, primMethod) {
        // Module and function name live in the first literal and never change for a
        // given method, but decoding them with bytesAsString on every call was about
        // 10% of the work in primitive-117-heavy workloads, so they are cached on the
        // method itself.
        var moduleName = primMethod._primModName, functionName = primMethod._primFuncName;
        if (moduleName === undefined) {
            if (primMethod.pointersSize() < 2) return false;
            var firstLiteral = primMethod.pointers[1]; // skip method header
            if (firstLiteral.pointersSize() !== 4) return false;
            moduleName = primMethod._primModName = firstLiteral.pointers[0].bytesAsString();
            functionName = primMethod._primFuncName = firstLiteral.pointers[1].bytesAsString();
        }
        this.primMethod = primMethod;
        return this.namedPrimitive(moduleName, functionName, argCount);
    },
    fakePrimitive: function(prim, retVal, argCount) {
        // fake a named primitive
        // prim and retVal need to be curried when used:
        //  this.fakePrimitive.bind(this, "Module.primitive", 42)
        this.vm.warnOnce("faking primitive: " + prim);
        if (retVal === undefined) this.vm.popN(argCount);
        else this.vm.popNandPush(argCount+1, this.makeStObject(retVal));
        return true;
    },
},
'modules', {
    loadModule: function(modName) {
        var mod = Squeak.externalModules[modName] || this.builtinModules[modName] || this.loadModuleDynamically(modName);
        if (!mod) return null;
        if (this.patchModules[modName])
            this.patchModule(mod, modName);
        if (mod.setInterpreter) {
            if (!mod.setInterpreter(this.interpreterProxy)) {
                console.log("Wrong interpreter proxy version: " + modName);
                return null;
            }
        }
        var initFunc = mod.initialiseModule;
        if (typeof initFunc === 'function') {
            mod.initialiseModule();
        } else if (typeof initFunc === 'string') {
            // allow late binding for built-ins
            this[initFunc]();
        }
        if (this.interpreterProxy.failed()) {
            console.log("Module initialization failed: " + modName);
            return null;
        }
        if (mod.getModuleName) modName = mod.getModuleName();
        console.log("Loaded module: " + modName);
        return mod;
    },
    loadModuleDynamically: function(modName) {
        // Placeholder (can be replaced by a module loader at runtime, before starting the Squeak interpreter)
        return undefined;
    },
    patchModule: function(mod, modName) {
        var patch = this.patchModules[modName];
        for (var key in patch)
            mod[key] = patch[key];
    },
    unloadModule: function(modName) {
        var mod = this.loadedModules[modName];
        if (!modName || !mod|| mod === this) return null;
        delete this.loadedModules[modName];
        var unloadFunc = mod.unloadModule;
        if (typeof unloadFunc === 'function') {
            mod.unloadModule(this);
        } else if (typeof unloadFunc === 'string') {
            // allow late binding for built-ins
            this[unloadFunc](this);
        }
        console.log("Unloaded module: " + modName);
        return mod;
    },
    loadFunctionFrom: function(functionName, modName) {
        // copy of namedPrimitive() returning the bound function instead of calling it
        var mod = modName === "" ? this : this.loadedModules[modName];
        if (mod === undefined) { // null if earlier load failed
            mod = this.loadModule(modName);
            this.loadedModules[modName] = mod;
        }
        if (!mod) return null;
        var func = mod[functionName];
        if (typeof func === "function") {
            return func.bind(mod);
        } else if (typeof func === "string") {
            return (this[func]).bind(this);
        }
        this.vm.warnOnce("missing primitive: " + modName + "." + functionName);
        return null;
    },
    primitiveUnloadModule: function(argCount) {
        var moduleName = this.stackNonInteger(0).bytesAsString();
        if (!moduleName) return false;
        this.unloadModule(moduleName);
        return this.popNIfOK(argCount);
    },
    primitiveListBuiltinModule: function(argCount) {
        var index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = Object.keys(this.builtinModules);
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
    primitiveListLoadedModule: function(argCount) {
        var index = this.stackInteger(0) - 1;
        if (!this.success) return false;
        var moduleNames = [];
        for (var key in this.loadedModules) {
            var module = this.loadedModules[key];
            if (module) {
                var moduleName = module.getModuleName ? module.getModuleName() : key;
                moduleNames.push(moduleName);
            }
        }
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(moduleNames[index]));
    },
},
'stack access', {
    popNIfOK: function(nToPop) {
        if (!this.success) return false;
        this.vm.popN(nToPop);
        return true;
    },
    pop2andPushBoolIfOK: function(bool) {
        this.vm.success = this.success;
        return this.vm.pop2AndPushBoolResult(bool);
    },
    popNandPushBoolIfOK: function(nToPop, bool) {
        if (!this.success) return false;
        this.vm.popNandPush(nToPop, bool ? this.vm.trueObj : this.vm.falseObj);
        return true;
    },
    popNandPushIfOK: function(nToPop, returnValue) {
        if (!this.success || returnValue == null) return false;
        this.vm.popNandPush(nToPop, returnValue);
        return true;
    },
    popNandPushIntIfOK: function(nToPop, returnValue) {
        if (!this.success || !this.vm.canBeSmallInt(returnValue)) return false;
        this.vm.popNandPush(nToPop, returnValue);
        return true;
    },
    popNandPushFloatIfOK: function(nToPop, returnValue) {
        if (!this.success) return false;
        this.vm.popNandPush(nToPop, this.makeFloat(returnValue));
        return true;
    },
    stackNonInteger: function(nDeep) {
        return this.checkNonInteger(this.vm.stackValue(nDeep));
    },
    stackInteger: function(nDeep) {
        return this.checkSmallInt(this.vm.stackValue(nDeep));
    },
    stackPos32BitInt: function(nDeep) {
        return this.positive32BitValueOf(this.vm.stackValue(nDeep));
    },
    pos32BitIntFor: function(signed32) {
        // Return the 32-bit quantity as an unsigned 32-bit integer
        if (signed32 >= 0 && signed32 <= Squeak.MaxSmallInt) return signed32;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (signed32>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackPos64BitInt: function(nDeep) {
        // The inverse of pos64BitIntFor: a SmallInteger or LargePositiveInteger off the
        // stack, as a BigInt suitable for a DoubleWordArray slot.
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {
            if (stackVal >= 0) return BigInt(stackVal);
            this.success = false;
            return 0n;
        }
        if (!this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger) || !stackVal.bytes) {
            this.success = false;
            return 0n;
        }
        var big = 0n;
        for (var i = stackVal.bytes.length - 1; i >= 0; i--) big = (big << 8n) | BigInt(stackVal.bytes[i]);
        return big;
    },
    pos64BitIntFor: function(bigint) {
        // A whole 64-bit unsigned value, as read from a DoubleWordArray. Small enough
        // values come back as SmallIntegers; the rest as a LargePositiveInteger, which is
        // why this takes a BigInt — beyond 2^53 a JS number can no longer name them exactly.
        if (typeof bigint !== "bigint") bigint = BigInt(bigint);
        if (bigint <= 0x1FFFFFFFFFFFFFn) return this.pos53BitIntFor(Number(bigint));
        var bytes = [];
        for (var v = bigint; v > 0n; v >>= 8n) bytes.push(Number(v & 255n));
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, bytes.length);
        for (var i = 0; i < bytes.length; i++) lgIntObj.bytes[i] = bytes[i];
        return lgIntObj;
    },
    pos53BitIntFor: function(longlong) {
        // Return the quantity as an unsigned 64-bit integer
        if (longlong <= 0xFFFFFFFF) return this.pos32BitIntFor(longlong);
        if (longlong > 0x1FFFFFFFFFFFFF) {
            console.warn("Out of range: pos53BitIntFor(" + longlong + ")");
            this.success = false;
            return 0;
        };
        var sz = longlong <= 0xFFFFFFFFFF ? 5 :
                 longlong <= 0xFFFFFFFFFFFF ? 6 :
                 7;
        var lgIntClass = this.vm.specialObjects[Squeak.splOb_ClassLargePositiveInteger],
            lgIntObj = this.vm.instantiateClass(lgIntClass, sz),
            bytes = lgIntObj.bytes;
        for (var i = 0; i < sz; i++) {
            bytes[i] = longlong & 255;
            longlong /= 256;
        }
        return lgIntObj;
    },
    stackSigned32BitInt: function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        if (stackVal.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = stackVal.bytes,
            value = 0;
        for (var i = 0, f = 1; i < 4; i++, f *= 256)
            value += bytes[i] * f;
        if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger) && value <= 0x7FFFFFFF)
            return value;
        if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger) && -value >= -0x80000000)
            return -value;
        this.success = false;
        return 0;
    },
    signed32BitIntegerFor: function(signed32) {
        // Return the 32-bit quantity as a signed 32-bit integer
        if (signed32 >= Squeak.MinSmallInt && signed32 <= Squeak.MaxSmallInt) return signed32;
        var negative = signed32 < 0,
            unsigned = negative ? -signed32 : signed32,
            lgIntClass = negative ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger,
            lgIntObj = this.vm.instantiateClass(this.vm.specialObjects[lgIntClass], 4),
            bytes = lgIntObj.bytes;
        for (var i=0; i<4; i++)
            bytes[i] = (unsigned>>>(8*i)) & 255;
        return lgIntObj;
    },
    stackFloat: function(nDeep) {
        return this.checkFloat(this.vm.stackValue(nDeep));
    },
    stackBoolean: function(nDeep) {
        return this.checkBoolean(this.vm.stackValue(nDeep));
    },
    stackSigned53BitInt:function(nDeep) {
        var stackVal = this.vm.stackValue(nDeep);
        if (typeof stackVal === "number") {   // SmallInteger
            return stackVal;
        }
        var n = stackVal.bytesSize();
        if (n <= 7) {
            var bytes = stackVal.bytes,
                value = 0;
            for (var i = 0, f = 1; i < n; i++, f *= 256)
                value += bytes[i] * f;
            if (value <= 0x1FFFFFFFFFFFFF) {
                if (this.isA(stackVal, Squeak.splOb_ClassLargePositiveInteger))
                    return value;
                if (this.isA(stackVal, Squeak.splOb_ClassLargeNegativeInteger))
                    return -value;
            }
        }
        this.success = false;
        return 0;
    },
},
'numbers', {
    doBitAnd: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr & arg);
    },
    doBitOr: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr | arg);
    },
    doBitXor: function() {
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackPos32BitInt(0);
        if (!this.success) return 0;
        return this.pos32BitIntFor(rcvr ^ arg);
    },
    doBitShift: function() {
        // SmallInts are handled by the bytecode,
        // so rcvr is a LargeInteger
        var rcvr = this.stackPos32BitInt(1);
        var arg = this.stackInteger(0);
        if (!this.success) return 0;
        // we're not using safeShift() here because we want the full 32 bits
        // and we know the receiver is unsigned
        var result;
        if (arg < 0) {
            if (arg < -31) return 0; // JS would treat arg=32 as arg=0
            result = rcvr >>> -arg;
        } else {
            if (arg > 31) {
                this.success = false; // rcvr is never 0
                return 0;
            }
            result = rcvr << arg;
            // check for lost bits by seeing if computation is reversible
            if ((result >>> arg) !== rcvr) {
                this.success = false;
                return 0;
            }
        }
        return this.pos32BitIntFor(result);
    },
    safeFDiv: function(dividend, divisor) {
        if (divisor === 0.0) {
            this.success = false;
            return 1.0;
        }
        return dividend / divisor;
    },
    floatAsSmallInt: function(float) {
        var truncated = float >= 0 ? Math.floor(float) : Math.ceil(float);
        return this.ensureSmallInt(truncated);
    },
    floatFractionPart: function(float) {
        if (-9007199254740991 /* -((1 << 53) - 1) */ <= float && float <= 9007199254740991 /* (1 << 53) - 1 */) {
            return float - Math.floor(float);
        } else {
            this.success = false;
            return 0;
        }
    },
    frexp_exponent: function(value) {
        // frexp separates a float into its mantissa and exponent
        if (value == 0.0) return 0;     // zero is special
        var data = new DataView(new ArrayBuffer(8));
        data.setFloat64(0, value);      // for accessing IEEE-754 exponent bits
        var bits = (data.getUint32(0) >>> 20) & 0x7FF;
        if (bits === 0) { // we have a subnormal float (actual zero was handled above)
            // make it normal by multiplying a large number
            data.setFloat64(0, value * Math.pow(2, 64));
            // access its exponent bits, and subtract the large number's exponent
            bits = ((data.getUint32(0) >>> 20) & 0x7FF) - 64;
        }
        var exponent = bits - 1022;                 // apply bias
        // mantissa = this.ldexp(value, -exponent)  // not needed for Squeak
        return exponent;
    },
    ldexp: function(mantissa, exponent) {
        // construct a float as mantissa * 2 ^ exponent
        // avoid multiplying by Infinity and Zero and rounding errors
        // by splitting the exponent (thanks to Nicolas Cellier)
        // 3 multiplies needed for e.g. ldexp(5e-324, 1023+1074)
        var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
        var result = mantissa;
        for (var i = 0; i < steps; i++)
            result *= Math.pow(2, Math.floor((exponent + i) / steps));
        return result;
    },
    primitiveLessThanLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) < this.stackSigned53BitInt(0));
    },
    primitiveGreaterThanLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) > this.stackSigned53BitInt(0));
    },
    primitiveLessOrEqualLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) <= this.stackSigned53BitInt(0));
    },
    primitiveGreaterOrEqualLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) >= this.stackSigned53BitInt(0));
    },
    primitiveEqualLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) === this.stackSigned53BitInt(0));
    },
    primitiveNotEqualLargeIntegers: function(argCount) {
        return this.popNandPushBoolIfOK(argCount+1, this.stackSigned53BitInt(1) !== this.stackSigned53BitInt(0));
    },
    // --- LargeInteger arithmetic (20-22, 29-33) and bit operations (34-37) ---
    // SqueakJS had none of these, so every one of them fell back to the Smalltalk
    // implementation and its hundreds of sends. BigInt is exact at any size and
    // matches Squeak's semantics. Operands may be SmallInteger or LargeInteger, and
    // the result is normalized back to a SmallInteger when it fits. Which of the two
    // is actually faster depends on the shape of the operands -- see largeIntBytes.
    // primHandler.largeIntPrims = false restores the fallback, for A/B measurement.
    bigIntFromStackInt: function(nDeep) {
        var v = this.vm.stackValue(nDeep);
        if (typeof v === "number") return BigInt(v);       // SmallInteger
        var isPos = this.isA(v, Squeak.splOb_ClassLargePositiveInteger);
        if ((isPos || this.isA(v, Squeak.splOb_ClassLargeNegativeInteger)) && v.bytes) {
            // Shifting a BigInt that grows a byte at a time copies the whole thing every
            // time, so the obvious loop is quadratic: on a 2400-byte operand the round
            // trip cost 0.77 ms against 0.0003 ms for the multiplication it was feeding.
            // Going through one hex string is linear -- but it is also slower on small
            // operands, which are the common ones, so each way is used where it wins.
            // Measured crossover for this direction: 128 bytes (below it the loop is up
            // to 2x faster, above it the string is up to 1.6x faster and keeps growing).
            var bytes = v.bytes, n = bytes.length, val = 0n;
            if (n < 128) {
                for (var i = n - 1; i >= 0; i--) val = (val << 8n) | BigInt(bytes[i]);
            } else {
                var digits = new Array(n);
                for (var i = 0; i < n; i++) {
                    var b = bytes[n - 1 - i];
                    digits[i] = b < 16 ? "0" + b.toString(16) : b.toString(16);
                }
                val = BigInt("0x" + digits.join(""));
            }
            return isPos ? val : -val;
        }
        this.success = false;
        return 0n;
    },
    squeakIntFromBigInt: function(b) {
        if (b >= BigInt(Squeak.MinSmallInt) && b <= BigInt(Squeak.MaxSmallInt)) return Number(b);
        var neg = b < 0n, mag = neg ? -b : b, bytes, n;
        // same trade as above; the crossover in this direction is 256 bytes, i.e. 2048
        // bits, so the string only pays past 10^616. Cached: building the bound would
        // itself allocate a 256-byte BigInt on every call.
        if (this.twoPow2048 === undefined) this.twoPow2048 = 1n << 2048n;
        if (mag < this.twoPow2048) {
            bytes = [];
            while (mag > 0n) { bytes.push(Number(mag & 255n)); mag >>= 8n; }
            if (bytes.length === 0) bytes.push(0);
            n = bytes.length;
        } else {
            var hex = mag.toString(16);             // big-endian ...
            if (hex.length & 1) hex = "0" + hex;
            n = hex.length >> 1;
            bytes = new Array(n);
            for (var i = 0; i < n; i++)             // ... and the bytes are little-endian
                bytes[n - 1 - i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        var cls = this.vm.specialObjects[neg ? Squeak.splOb_ClassLargeNegativeInteger : Squeak.splOb_ClassLargePositiveInteger],
            obj = this.vm.instantiateClass(cls, n);
        for (var i = 0; i < n; i++) obj.bytes[i] = bytes[i];
        return obj;
    },
    // Size of an operand in bytes, 0 for a SmallInteger. Used to decide whether going
    // through BigInt is worth it: converting costs O(n) on every operand and on the
    // result, so it only pays when the operation itself is superlinear. Measured on
    // Pharo 13, microseconds per operation, VM primitive vs the image's own code (which
    // is backed by LargeIntegers.js and works on the bytes directly):
    //     add, equal sizes      32 B: 2.8 vs 1.5      512 B: 45 vs 1.3     -> image wins
    //     mul, equal sizes     512 B: 60 vs 602      2048 B: 250 vs 7300   -> BigInt wins
    //     mul, large x small    64 B: 4.9 vs 2.1     1024 B: 64 vs 8       -> image wins
    // The last row is the shape of factorial, and it is why 2000 factorial was slow.
    largeIntBytes: function(nDeep) {
        var v = this.vm.stackValue(nDeep);
        return typeof v === "number" || !v.bytes ? 0 : v.bytes.length;
    },
    primitiveAddLargeIntegers: function(argCount) {
        if (this.largeIntPrims === false) return false;
        if (this.largeIntBytes(1) >= 32 || this.largeIntBytes(0) >= 32) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a + b));
    },
    primitiveSubtractLargeIntegers: function(argCount) {
        if (this.largeIntPrims === false) return false;
        if (this.largeIntBytes(1) >= 32 || this.largeIntBytes(0) >= 32) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a - b));
    },
    primitiveMultiplyLargeIntegers: function(argCount) {
        if (this.largeIntPrims === false) return false;
        var na = this.largeIntBytes(1), nb = this.largeIntBytes(0);
        // Schoolbook multiplication is O(n*m), so with one operand tiny the image beats
        // us without ever converting anything -- and that lopsided shape is exactly what
        // factorial produces.
        var lopsided = (na >= 64 || nb >= 64) && (na <= 16 || nb <= 16);
        if (lopsided) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a * b));
    },
    primitiveDivideLargeIntegers: function(argCount) { // 30: / exacto (falla si no divide)
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || b === 0n || a % b !== 0n) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a / b));
    },
    primitiveDivLargeIntegers: function(argCount) { // 32: // división con piso
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || b === 0n) return false;
        var q = a / b, r = a % b;
        if (r !== 0n && ((r < 0n) !== (b < 0n))) q -= 1n;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(q));
    },
    primitiveModLargeIntegers: function(argCount) { // 31: \\ módulo con piso (signo del divisor)
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || b === 0n) return false;
        var r = a % b;
        if (r !== 0n && ((r < 0n) !== (b < 0n))) r += b;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(r));
    },
    primitiveQuoLargeIntegers: function(argCount) { // 33: quo: truncado hacia cero
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || b === 0n) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a / b));
    },
    primitiveRemLargeIntegers: function(argCount) { // 20: rem: (signo del dividendo)
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || b === 0n) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a % b));
    },
    primitiveBitAndLargeIntegers: function(argCount) { // 34
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || a < 0n || b < 0n) return false; // negativos: two's complement infinito, fallback
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a & b));
    },
    primitiveBitOrLargeIntegers: function(argCount) { // 35
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || a < 0n || b < 0n) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a | b));
    },
    primitiveBitXorLargeIntegers: function(argCount) { // 36
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), b = this.bigIntFromStackInt(0);
        if (!this.success || a < 0n || b < 0n) return false;
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(a ^ b));
    },
    primitiveBitShiftLargeIntegers: function(argCount) { // 37
        if (this.largeIntPrims === false) return false;
        var a = this.bigIntFromStackInt(1), shift = this.vm.stackValue(0);
        if (typeof shift !== "number" || a < 0n) { this.success = false; return false; }
        if (!this.success) return false;
        var s = BigInt(shift), res = s >= 0n ? (a << s) : (a >> -s);
        return this.popNandPushIfOK(argCount+1, this.squeakIntFromBigInt(res));
    },
},
'utils', {
    floatOrInt: function(obj) {
        if (obj.isFloat) return obj.float;
        if (typeof obj === "number") return obj;  // SmallInteger
        return 0;
    },
    positive32BitValueOf: function(obj) {
        if (typeof obj === "number") { // SmallInteger
            if (obj >= 0)
                return obj;
            this.success = false;
            return 0;
        }
        if (!this.isA(obj, Squeak.splOb_ClassLargePositiveInteger) || obj.bytesSize() !== 4) {
            this.success = false;
            return 0;
        }
        var bytes = obj.bytes,
            value = 0;
        for (var i = 0, f = 1; i < 4; i++, f *= 256)
            value += bytes[i] * f;
        return value;
    },
    checkFloat: function(maybeFloat) { // returns a number and sets success
        if (maybeFloat.isFloat)
            return maybeFloat.float;
        if (typeof maybeFloat === "number")  // SmallInteger
            return maybeFloat;
        this.success = false;
        return 0.0;
    },
    checkSmallInt: function(maybeSmall) { // returns an int and sets success
        if (typeof maybeSmall === "number")
            return maybeSmall;
        this.success = false;
        return 0;
    },
    checkNonInteger: function(obj) { // returns a SqObj and sets success
        if (typeof obj !== "number")
            return obj;
        this.success = false;
        return this.vm.nilObj;
    },
    checkBoolean: function(obj) { // returns true/false and sets success
        if (obj.isTrue) return true;
        if (obj.isFalse) return false;
        return this.success = false;
    },
    indexableSize: function(obj) {
        if (typeof obj === "number") return -1; // -1 means not indexable
        return obj.indexableSize(this);
    },
    isA: function(obj, knownClass) {
        return obj.sqClass === this.vm.specialObjects[knownClass];
    },
    isKindOf: function(obj, knownClass) {
        var classOrSuper = obj.sqClass;
        var theClass = typeof knownClass === "number" ? this.vm.specialObjects[knownClass] : knownClass;
        while (!classOrSuper.isNil) {
            if (classOrSuper === theClass) return true;
            classOrSuper = classOrSuper.superclass();
        }
        return false;
    },
    isAssociation: function(obj) {
        if (this.associationClass && obj.sqClass === this.associationClass) return true;
        if (!obj.pointers || obj.pointers.length !== 2) return false;
        // we know the Processor binding is "like" an association, but in newer images it's
        // actually a Binding object, which only shares the superclass LookupKey with Association
        var lookupKeyClass = this.vm.specialObjects[Squeak.splOb_SchedulerAssociation].sqClass;
        while (lookupKeyClass.superclass().classInstSize() > 0)
            lookupKeyClass = lookupKeyClass.superclass();
        var isAssociation = this.isKindOf(obj, lookupKeyClass);
        if (isAssociation) this.associationClass = obj.sqClass; // cache for next time
        return isAssociation;
    },
    ensureSmallInt: function(number) {
        if (number === (number|0) && this.vm.canBeSmallInt(number))
            return number;
        this.success = false;
        return 0;
    },
    charFromInt: function(ascii) {
        var charTable = this.vm.specialObjects[Squeak.splOb_CharacterTable];
        var char = charTable.pointers[ascii];
        if (char) return char;
        var charClass = this.vm.specialObjects[Squeak.splOb_ClassCharacter];
        char = this.vm.instantiateClass(charClass, 0);
        char.pointers[0] = ascii;
        return char;
    },
    charFromIntSpur: function(unicode) {
        return this.vm.image.getCharacter(unicode);
    },
    charToInt: function(obj) {
        return obj.pointers[0];
    },
    charToIntSpur: function(obj) {
        return obj.hash;
    },
    makeFloat: function(value) {
        var floatClass = this.vm.specialObjects[Squeak.splOb_ClassFloat];
        var newFloat = this.vm.instantiateClass(floatClass, 2);
        newFloat.float = value;
        return newFloat;
    },
    makeLargeIfNeeded: function(integer) {
        return this.vm.canBeSmallInt(integer) ? integer : this.makeLargeInt(integer);
    },
    makeLargeInt: function(integer) {
        if (integer < 0) throw Error("negative large ints not implemented yet");
        if (integer > 0xFFFFFFFF) throw Error("large large ints not implemented yet");
        return this.pos32BitIntFor(integer);
    },
    makePointWithXandY: function(x, y) {
        var pointClass = this.vm.specialObjects[Squeak.splOb_ClassPoint];
        var newPoint = this.vm.instantiateClass(pointClass, 0);
        newPoint.pointers[Squeak.Point_x] = x;
        newPoint.pointers[Squeak.Point_y] = y;
        return newPoint;
    },
    makeStArray: function(jsArray, proxyClass) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.pointers[i] = this.makeStObject(jsArray[i], proxyClass);
        return array;
    },
    makeStByteArray: function(jsArray) {
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassByteArray], jsArray.length);
        for (var i = 0; i < jsArray.length; i++)
            array.bytes[i] = jsArray[i] & 0xff;
        return array;
    },
    makeStString: function(jsString) {
        var stString = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassString], jsString.length);
        for (var i = 0; i < jsString.length; ++i)
            stString.bytes[i] = jsString.charCodeAt(i) & 0xFF;
        return stString;
    },
    makeStStringFromBytes: function(bytes, zeroTerminated) {
        var length = bytes.length;
        if (zeroTerminated) {
            length = bytes.indexOf(0);
            if (length < 0) length = bytes.length;
        }
        var stString = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassString], length);
        for (var i = 0; i < length; ++i)
            stString.bytes[i] = bytes[i];
        return stString;
    },
    makeStObject: function(obj, proxyClass) {
        if (obj === undefined || obj === null) return this.vm.nilObj;
        if (obj === true) return this.vm.trueObj;
        if (obj === false) return this.vm.falseObj;
        if (obj.sqClass) return obj;
        if (typeof obj === "number")
            if (obj === (obj|0)) return this.makeLargeIfNeeded(obj);
            else return this.makeFloat(obj);
        if (proxyClass) {   // wrap in JS proxy instance
            var stObj = this.vm.instantiateClass(proxyClass, 0);
            stObj.jsObject = obj;
            return stObj;
        }
        // A direct test of the buffer's constructor doesn't work on Safari 10.0.
        if (typeof obj === "string" || obj.constructor.name === "Uint8Array") return this.makeStString(obj);
        if (obj.constructor.name === "Array") return this.makeStArray(obj);
        throw Error("cannot make smalltalk object");
    },
    pointsTo: function(rcvr, arg) {
        if (!rcvr.pointers) return false;
        return rcvr.pointers.indexOf(arg) >= 0;
    },
    asUint8Array: function(buffer) {
        // A direct test of the buffer's constructor doesn't work on Safari 10.0.
        if (buffer.constructor.name === "Uint8Array") return buffer;
        if (buffer.constructor.name === "ArrayBuffer") return new Uint8Array(buffer);
        if (typeof buffer === "string") {
            var array = new Uint8Array(buffer.length);
            for (var i = 0; i < buffer.length; i++)
                array[i] = buffer.charCodeAt(i);
            return array;
        }
        throw Error("unknown buffer type");
    },
    filenameToSqueak: function(unixpath) {
        var slash = unixpath[0] !== "/" ? "/" : "",
            filepath = "/SqueakJS" + slash + unixpath;                      // add SqueakJS
        if (this.emulateMac)
            filepath = ("Macintosh HD" + filepath)                          // add Mac volume
                .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        return filepath;
    },
    filenameFromSqueak: function(filepath) {
        var unixpath = !this.emulateMac ? filepath :
            filepath.replace(/^[^:]*:/, ":")                            // remove volume
            .replace(/\//g, "€").replace(/:/g, "/").replace(/€/g, ":"); // substitute : for /
        unixpath = unixpath.replace(/^\/*SqueakJS\/?/, "/");            // strip SqueakJS /**/
        return unixpath;
    },
},
'indexing', {
    // Stream primitives 65/66/67 (PositionableStream). Like the real Squeak VM these
    // only handle Array and String collections; anything else, and any edge such as an
    // index out of bounds, answers false and lets the Smalltalk fallback decide, which
    // is always correct. Everything is validated before the position is touched, so a
    // fallback can never advance it twice. writeLimit is inst var 3 (WriteStream).
    primitiveStreamNext: function(argCount) {
        if (this.streamPrims === false) return false;
        var stream = this.stackNonInteger(0);
        if (!stream.pointers || stream.pointers.length <= Squeak.Stream_limit) return false;
        var array = stream.pointers[Squeak.Stream_array],
            index = stream.pointers[Squeak.Stream_position],
            limit = stream.pointers[Squeak.Stream_limit];
        if (typeof index !== "number" || typeof limit !== "number") return false;
        if (index >= limit || !array || !array.sqClass) return false;
        var result;
        if (array.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
            if (!array.pointers || index >= array.pointers.length) return false;
            result = array.pointers[index];
        } else if (array.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
            if (!array.bytes || index >= array.bytes.length) return false;
            result = this.charFromInt(array.bytes[index] & 0xFF);
        } else return false;
        if (result === undefined || result === null) return false;
        stream.pointers[Squeak.Stream_position] = index + 1;
        return this.popNandPushIfOK(argCount + 1, result);
    },
    primitiveStreamNextPut: function(argCount) {
        if (this.streamPrims === false) return false;
        var value = this.vm.stackValue(0),
            stream = this.stackNonInteger(1);
        if (!stream.pointers || stream.pointers.length <= 3) return false;
        var array = stream.pointers[Squeak.Stream_array],
            index = stream.pointers[Squeak.Stream_position],
            limit = stream.pointers[3]; // writeLimit
        if (typeof index !== "number" || typeof limit !== "number") return false;
        if (index >= limit || !array || !array.sqClass) return false;
        if (array.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
            if (!array.pointers || index >= array.pointers.length) return false;
            array.pointers[index] = value;
            array.dirty = true;
        } else if (array.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
            if (!array.bytes || index >= array.bytes.length) return false;
            if (!value || value.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter]) return false;
            var ascii = this.charToInt(value);
            if (typeof ascii !== "number" || ascii < 0 || ascii > 255) return false;
            array.bytes[index] = ascii;
        } else return false;
        stream.pointers[Squeak.Stream_position] = index + 1;
        return this.popNandPushIfOK(argCount + 1, value);
    },
    primitiveStreamAtEnd: function(argCount) {
        if (this.streamPrims === false) return false;
        var stream = this.stackNonInteger(0);
        if (!stream.pointers || stream.pointers.length <= Squeak.Stream_limit) return false;
        var index = stream.pointers[Squeak.Stream_position],
            limit = stream.pointers[Squeak.Stream_limit];
        if (typeof index !== "number" || typeof limit !== "number") return false;
        return this.popNandPushIfOK(argCount + 1, index >= limit ? this.vm.trueObj : this.vm.falseObj);
    },
    objectAt: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at: or sets success false
        var array = this.stackNonInteger(1);
        var index = this.stackPos32BitInt(0); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var floatData = array.floatData();
                if (index==1) return this.pos32BitIntFor(floatData.getUint32(0, false));
                if (index==2) return this.pos32BitIntFor(floatData.getUint32(4, false));
                this.success = false; return array;
            }
            info = this.makeAtCacheInfo(this.atCache, this.vm.specialSelectors[32], array, convertChars, includeInstVars);
        }
        if (index < 1 || index > info.size) {this.success = false; return array;}
        if (includeInstVars)  //pointers...   instVarAt and objectAt
            return array.pointers[index-1];
        if (array.isPointers())   //pointers...   normal at:
            return array.pointers[index-1+info.ivarOffset];
        if (array.isWords64()) // 64-bit words (DoubleWordArray)
            return this.pos64BitIntFor(array.words64[index-1]);
        if (array.isWords()) // words...
            if (info.convertChars) return this.charFromInt(array.words[index-1] & 0x3FFFFFFF);
            else return this.pos32BitIntFor(array.words[index-1]);
        if (array.isShorts()) // 16-bit words (DoubleByteArray), which live in words16
            return array.words16[index-1];
        if (array.isBytes()) // bytes...
            if (info.convertChars) return this.charFromInt(array.bytes[index-1] & 0xFF);
            else return array.bytes[index-1] & 0xFF;
        // methods must simulate Squeak's method indexing (4 bytes/literal even in 64-bit
        // images — pcs are normalized at load, see vm.image.js fixPCs)
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //reading lits as bytes
        return array.bytes[index-1-offset] & 0xFF;
    },
    objectAtPut: function(cameFromBytecode, convertChars, includeInstVars) {
        //Returns result of at:put: or sets success false
        var array = this.stackNonInteger(2);
        var index = this.stackPos32BitInt(1); //note non-int returns zero
        if (!this.success) return array;
        var info;
        if (cameFromBytecode) {// fast entry checks cache
            info = this.atPutCache[array.hash & this.atCacheMask];
            if (info.array !== array) {this.success = false; return array;}
        } else {// slow entry installs in cache if appropriate
            if (array.isFloat) { // present float as word array
                var wordToPut = this.stackPos32BitInt(0);
                if (this.success && (index == 1 || index == 2)) {
                    var floatData = array.floatData();
                    floatData.setUint32(index == 1 ? 0 : 4, wordToPut, false);
                    array.float = floatData.getFloat64(0);
                } else this.success = false;
                return this.vm.stackValue(0);
            }
            info = this.makeAtCacheInfo(this.atPutCache, this.vm.specialSelectors[34], array, convertChars, includeInstVars);
        }
        if (index<1 || index>info.size) {this.success = false; return array;}
        var objToPut = this.vm.stackValue(0);
        if (includeInstVars)  {// pointers...   instVarAtPut and objectAtPut
            array.dirty = true;
            if (index === 1 && array.isMethod()) {
                // A method's slot 1 is its header, and this VM keeps it in its own shape
                // (see methodHeaderFromStack). The compiler writes the header back here
                // after building a method, so storing the image's number as it comes
                // would undo the translation: in a 64-bit image it is a
                // LargeNegativeInteger, and leaving that object in pointers[0] makes
                // methodSignFlag answer false, so a Sista method gets run through the V3
                // dispatch and reads literals that are not there.
                array.pointers[0] = this.methodHeaderFromStack(0);
                return objToPut;
            }
            return array.pointers[index-1] = objToPut; //eg, objectAt:
        }
        if (array.isPointers())  {// pointers...   normal atPut
            array.dirty = true;
            return array.pointers[index-1+info.ivarOffset] = objToPut;
        }
        var intToPut;
        if (array.isWords64()) { // 64-bit words (DoubleWordArray)
            var big = this.stackPos64BitInt(0);
            if (!this.success) return array;
            array.words64[index-1] = big;
            return objToPut;
        }
        if (array.isWords()) {  // words...
            if (convertChars) {
                // put a character...
                if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                    {this.success = false; return objToPut;}
                intToPut = this.charToInt(objToPut);
                if (typeof intToPut !== "number") {this.success = false; return objToPut;}
            } else {
                intToPut = this.stackPos32BitInt(0);
            }
            if (this.success) array.words[index-1] = intToPut;
            return objToPut;
        }
        if (array.isShorts()) { // 16-bit words: the byte path below would clamp to 255
            intToPut = this.stackPos32BitInt(0);
            if (!this.success) return array;
            if (intToPut < 0 || intToPut > 65535) {this.success = false; return objToPut;}
            array.words16[index-1] = intToPut;
            return objToPut;
        }
        // bytes...
        if (convertChars) {
            // put a character...
            if (objToPut.sqClass !== this.vm.specialObjects[Squeak.splOb_ClassCharacter])
                {this.success = false; return objToPut;}
            intToPut = this.charToInt(objToPut);
            if (typeof intToPut !== "number") {this.success = false; return objToPut;}
        } else { // put a byte...
            if (typeof objToPut !== "number") {this.success = false; return objToPut;}
            intToPut = objToPut;
        }
        if (intToPut<0 || intToPut>255) {this.success = false; return objToPut;}
        if (array.isBytes())  // bytes...
            {array.bytes[index-1] = intToPut; return objToPut;}
        // methods must simulate Squeak's method indexing (4 bytes/literal even in 64-bit
        // images — pcs are normalized at load, see vm.image.js fixPCs)
        var offset = array.pointersSize() * 4;
        if (index-1-offset < 0) {this.success = false; return array;} //writing lits as bytes
        array.bytes[index-1-offset] = intToPut;
        return objToPut;
    },
    objectSize: function(cameFromBytecode) {
        var rcvr = this.vm.stackValue(0),
            size = -1;
        if (cameFromBytecode) {
            // must only handle classes with size == basicSize, fail otherwise
            if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassArray]) {
                size = rcvr.pointersSize();
            } else if (rcvr.sqClass === this.vm.specialObjects[Squeak.splOb_ClassString]) {
                size = rcvr.bytesSize();
            }
        } else { // basicSize
            size = this.indexableSize(rcvr);
        }
        if (size === -1) {this.success = false; return -1}; //not indexable
        return this.pos32BitIntFor(size);
    },
    initAtCache: function() {
        // The purpose of the at-cache is to allow fast (bytecode) access to at/atput code
        // without having to check whether this object has overridden at, etc.
        this.atCacheSize = 32; // must be power of 2
        this.atCacheMask = this.atCacheSize - 1; //...so this is a mask
        this.atCache = [];
        this.atPutCache = [];
        this.nonCachedInfo = {};
        for (var i= 0; i < this.atCacheSize; i++) {
            this.atCache.push({});
            this.atPutCache.push({});
        }
    },
    makeAtCacheInfo: function(atOrPutCache, atOrPutSelector, array, convertChars, includeInstVars) {
        //Make up an info object and store it in the atCache or the atPutCache.
        //If it's not cacheable (not a non-super send of at: or at:put:)
        //then return the info in nonCachedInfo.
        //Note that info for objectAt (includeInstVars) will have
        //a zero ivarOffset, and a size that includes the extra instVars
        var info;
        var cacheable =
            (this.vm.verifyAtSelector === atOrPutSelector)         //is at or atPut
            && (this.vm.verifyAtClass === array.sqClass)           //not a super send
            && !this.vm.isContext(array);                          //not a context (size can change)
        info = cacheable ? atOrPutCache[array.hash & this.atCacheMask] : this.nonCachedInfo;
        info.array = array;
        info.convertChars = convertChars;
        if (includeInstVars) {
            info.size = array.instSize() + Math.max(0, array.indexableSize(this));
            info.ivarOffset = 0;
        } else {
            info.size = array.indexableSize(this);
            info.ivarOffset = array.isPointers() ? array.instSize() : 0;
        }
        return info;
    },
},
'basic',{
    instantiateClass: function(clsObj, indexableSize) {
        if (indexableSize * 4 > this.vm.image.bytesLeft()) {
            // we're not really out of memory, we have no idea how much memory is available
            // but we need to stop runaway allocations
            console.warn("squeak: out of memory, failing allocation");
            this.success = false;
            this.vm.primFailCode = Squeak.PrimErrNoMemory;
            return null;
        } else {
            return this.vm.instantiateClass(clsObj, indexableSize);
        }
    },
    someObject: function() {
        return this.vm.image.firstOldObject;
    },
    nextObject: function(obj) {
        return this.vm.image.objectAfter(obj) || 0;
    },
    someInstanceOf: function(clsObj) {
        var someInstance = this.vm.image.someInstanceOf(clsObj);
        if (someInstance) return someInstance;
        this.success = false;
        return 0;
    },
    nextInstanceAfter: function(obj) {
        var nextInstance = this.vm.image.nextInstanceAfter(obj);
        if (nextInstance) return nextInstance;
        this.success = false;
        return 0;
    },
    allInstancesOf: function(clsObj) {
        var instances = this.vm.image.allInstancesOf(clsObj);
        var array = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], instances.length);
        array.pointers = instances;
        return array;
    },
    identityHash: function(obj) {
        return obj.hash;
    },
    identityHashSpur: function(obj) {
        var hash = obj.hash;
        if (hash > 0) return hash;
        return obj.hash = this.newObjectHash();
    },
    behaviorHash: function(obj) {
        var hash = obj.hash;
        if (hash > 0) return hash;
        return this.vm.image.enterIntoClassTable(obj);
    },
    newObjectHash: function(obj) {
        return Math.floor(Math.random() * 0x3FFFFE) + 1;
    },
    primitivePin: function(argCount) {
        // For us, pinning is a no-op, so we just toggle the pinned flag
        var rcvr = this.stackNonInteger(1),
            pin = this.stackBoolean(0);
        if (!this.success) return false;
        var wasPinned = rcvr.pinned;
        rcvr.pinned = pin;
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(!!wasPinned));
    },
    primitiveIsPinned: function(argCount) {
        var rcvr = this.stackNonInteger(0);
        if (!this.success) return false;
        return this.popNandPushIfOK(argCount + 1, this.makeStObject(!!rcvr.pinned));
    },
    primitiveSizeInBytesOfInstance: function(argCount) {
        if (argCount > 1) return false;
        var classObj = this.stackNonInteger(argCount),
            nElements = argCount ? this.stackInteger(0) : 0,
            bytes = classObj.classByteSizeOfInstance(nElements);
        return this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(bytes));
    },
    primitiveSizeInBytes: function(argCount) {
        var object = this.stackNonInteger(0),
            bytes = object.totalBytes();
        return this.popNandPushIfOK(argCount + 1, this.makeLargeIfNeeded(bytes));
    },
    primitiveAsCharacter: function(argCount) {
        var unicode = this.stackInteger(0);
        if (unicode < 0 || unicode > 0x3FFFFFFF) return false;
        var char = this.charFromInt(unicode);
        if (!char) return false;
        return this.popNandPushIfOK(argCount + 1, char);
    },
    primitiveFullGC: function(argCount) {
        this.vm.image.fullGC("primitive");
        var bytes = this.vm.image.bytesLeft();
        return this.popNandPushIfOK(argCount+1, this.makeLargeIfNeeded(bytes));
    },
    primitivePartialGC: function(argCount) {
        var young = this.vm.image.partialGC("primitive");
        var youngSpaceBytes = 0;
        while (young) {
            youngSpaceBytes += young.totalBytes();
            young = young.nextObject;
        }
        console.log("    old space: " + this.vm.image.oldSpaceBytes.toLocaleString() + " bytes, " +
            "young space: " + youngSpaceBytes.toLocaleString() + " bytes, " +
            "total: " + (this.vm.image.oldSpaceBytes + youngSpaceBytes).toLocaleString() + " bytes");
        var bytes = this.vm.image.bytesLeft() - youngSpaceBytes;
        return this.popNandPushIfOK(argCount+1, this.makeLargeIfNeeded(bytes));
    },
    primitiveHighBit: function(argCount) {
        // primitive 575: index (1-based) of the receiver's highest set bit; 0 highBit = 0
        var rcvr = this.stackSigned53BitInt(argCount);
        if (!this.success || rcvr < 0) return false;
        var high = Math.floor(rcvr / 0x100000000),
            highBit = high ? 64 - Math.clz32(high) : 32 - Math.clz32(rcvr);
        return this.popNandPushIfOK(argCount + 1, highBit);
    },
    primitiveMakePoint: function(argCount, checkNumbers) {
        var x = this.vm.stackValue(1);
        var y = this.vm.stackValue(0);
        if (checkNumbers) {
            this.checkFloat(x);
            this.checkFloat(y);
            if (!this.success) return false;
        }
        this.vm.popNandPush(1+argCount, this.makePointWithXandY(x, y));
        return true;
    },
    primitiveStoreStackp: function(argCount) {
        var ctxt = this.stackNonInteger(1),
            newStackp = this.stackInteger(0);
        if (!this.success || newStackp < 0 || this.vm.decodeSqueakSP(newStackp) >= ctxt.pointers.length)
            return false;
        var stackp = ctxt.pointers[Squeak.Context_stackPointer];
        while (stackp < newStackp)
            ctxt.pointers[this.vm.decodeSqueakSP(++stackp)] = this.vm.nilObj;
        ctxt.pointers[Squeak.Context_stackPointer] = newStackp;
        this.vm.popN(argCount);
        return true;
    },
    primitiveChangeClass: function(argCount) {
        if (argCount > 2) return false;
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0);
        if (!this.changeClassTo(rcvr, arg.sqClass)) {
            return false;
        }
        return this.popNIfOK(argCount);
    },
    primitiveAdoptInstance: function(argCount) {
        if (argCount > 2) return false;
        var cls = this.stackNonInteger(1),
            obj = this.stackNonInteger(0);
        if (!this.changeClassTo(obj, cls)) {
            return false;
        }
        return this.popNIfOK(argCount);
    },
    changeClassTo: function(rcvr, cls) {
        if (rcvr.sqClass.isCompact !== cls.isCompact) return false;
        var classInstIsPointers = cls.classInstIsPointers();
        if (rcvr.isPointers()) {
            if (!classInstIsPointers) return false;
            if (rcvr.sqClass.classInstSize() !== cls.classInstSize())
                return false;
        } else {
            if (classInstIsPointers) return false;
            var hasBytes = rcvr.isBytes(),
                needBytes = cls.classInstIsBytes();
            if (hasBytes && !needBytes) {
                if (rcvr.bytes) {
                    if (rcvr.bytes.length & 3) return false;
                    rcvr.words = new Uint32Array(rcvr.bytes.buffer);
                    delete rcvr.bytes;
                }
            } else if (!hasBytes && needBytes) {
                if (rcvr.words) {
                    rcvr.bytes = new Uint8Array(rcvr.words.buffer);
                    delete rcvr.words;
                }
            }
        }
        rcvr._format = cls.classInstFormat();
        rcvr.sqClass = cls;
        return true;
    },
    primitiveDoPrimitiveWithArgs: function(argCount) {
        var argumentArray = this.stackNonInteger(0),
            primIdx = this.stackInteger(1);
        if (!this.success) return false;
        var arraySize = argumentArray.pointersSize(),
            cntxSize = this.vm.activeContextObj().pointersSize();
        if (this.vm.sp + arraySize >= cntxSize) return false;
        // Pop primIndex and argArray, then push args in place...
        this.vm.popN(2);
        for (var i = 0; i < arraySize; i++)
            this.vm.push(argumentArray.pointers[i]);
        // Run the primitive
        if (this.vm.tryPrimitive(primIdx, arraySize))
            return true;
        // Primitive failed, restore state for failure code
        this.vm.popN(arraySize);
        this.vm.push(primIdx);
        this.vm.push(argumentArray);
        return false;
    },
    primitiveDoNamedPrimitive: function(argCount) {
        var argumentArray = this.stackNonInteger(0),
            rcvr = this.stackNonInteger(1),
            primMethod = this.stackNonInteger(2);
        if (!this.success) return false;
        var arraySize = argumentArray.pointersSize(),
            cntxSize = this.vm.activeContextObj().pointersSize();
        if (this.vm.sp + arraySize >= cntxSize) return false;
        // Pop primIndex, rcvr, and argArray, then push new receiver and args in place...
        this.vm.popN(3);
        this.vm.push(rcvr);
        for (var i = 0; i < arraySize; i++)
            this.vm.push(argumentArray.pointers[i]);
        // Run the primitive
        if (this.doNamedPrimitive(arraySize, primMethod))
            return true;
        // Primitive failed, restore state for failure code
        this.vm.popN(arraySize + 1);
        this.vm.push(primMethod);
        this.vm.push(rcvr);
        this.vm.push(argumentArray);
        return false;
    },
    primitiveShortAtAndPut: function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt16Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // shortAt:
            value = array[index];
        } else { // shortAt:put:
            value = this.stackInteger(0);
            if (value < -32768 || value > 32767)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveIntegerAtAndPut:  function(argCount) {
        var rcvr = this.stackNonInteger(argCount),
            index = this.stackInteger(argCount-1) - 1, // make zero-based
            array = rcvr.wordsAsInt32Array();
        if (!this.success || !array || index < 0 || index >= array.length)
            return false;
        var value;
        if (argCount < 2) { // integerAt:
            value = this.signed32BitIntegerFor(array[index]);
        } else { // integerAt:put:
            value = this.stackSigned32BitInt(0);
            if (!this.success)
                return false;
            array[index] = value;
        }
        this.popNandPushIfOK(argCount+1, value);
        return true;
    },
    primitiveConstantFill:  function(argCount) {
        var rcvr = this.stackNonInteger(1),
            value = this.stackPos32BitInt(0);
        if (!this.success || !rcvr.isWordsOrBytes())
            return false;
        var array = rcvr.words || rcvr.bytes;
        if (array) {
            if (array === rcvr.bytes && value > 255)
                return false;
            for (var i = 0; i < array.length; i++)
                array[i] = value;
        }
        this.vm.popN(argCount);
        return true;
    },
    primitiveNewMethod: function(argCount) {
        var header = this.methodHeaderFromStack(0);
        var bytecodeCount = this.stackInteger(1);
        if (!this.success) return 0;
        var method = this.vm.instantiateClass(this.vm.stackValue(2), bytecodeCount);
        method.pointers = [header];
        var litCount = method.methodNumLits();
        for (var i = 0; i < litCount; i++)
            method.pointers.push(this.vm.nilObj);
        this.vm.popNandPush(1+argCount, method);
        if (this.vm.breakOnNewMethod)               // break on doit
            this.vm.breakOnMethod = method;
        return true;
    },
    methodHeaderFromStack: function(nDeep) {
        // A method header as the image computes it, turned into the form this VM keeps
        // in pointers[0]: the low bits of the layout, plus bit 31 for the alternate
        // (Sista) bytecode set — the same shape readFromBuffer builds when it loads a
        // method out of an image.
        //
        // In a 64-bit image the flag is the sign of a 61-bit SmallInteger, so a Sista
        // method's header is a number near -2^60, past what a JS number holds exactly:
        // the image hands it over as a LargeNegativeInteger. Reading it with
        // stackInteger failed the primitive, and since every method the compiler builds
        // goes through here, nothing could be compiled at all — in Cuis 7.8 (64-bit,
        // Sista) any DoIt died with "newMethod:header: failed" and no code could be
        // evaluated or edited. A 32-bit image never hit it: there the whole header fits
        // in a SmallInteger.
        var value = this.vm.stackValue(nDeep);
        if (typeof value === "number") return value;         // 32-bit image: as it comes
        if (!value.bytes) { this.success = false; return 0; }
        var negative = this.isA(value, Squeak.splOb_ClassLargeNegativeInteger);
        if (!negative && !this.isA(value, Squeak.splOb_ClassLargePositiveInteger)) {
            this.success = false;
            return 0;
        }
        var bytes = value.bytes, low = 0;
        for (var i = Math.min(4, bytes.length) - 1; i >= 0; i--) low = low * 256 + bytes[i];
        low = low >>> 0;
        if (negative) low = (-low) >>> 0;                    // two's complement, low word
        return negative ? (low & 0x7FFFFFFF) | 0x80000000 : low & 0x7FFFFFFF;
    },
    primitiveExecuteMethodArgsArray: function(argCount) {
        // receiver, argsArray, then method are on top of stack.  Execute method with
        // receiver and args.
        var methodObj = this.stackNonInteger(0),
            argsArray = this.stackNonInteger(1),
            receiver = this.vm.stackValue(2);
        // Allow for up to two extra arguments (e.g. for mirror primitives).
        if (!this.success || !methodObj.isMethod() || argCount > 4) return false;
        var numArgs = methodObj.methodNumArgs();
        if (numArgs !== argsArray.pointersSize()) return false;
        // drop all args, push receiver, and new arguments
        this.vm.popNandPush(argCount+1, receiver);
        for (var i = 0; i < numArgs; i++)
            this.vm.push(argsArray.pointers[i]);
        this.vm.executeNewMethod(receiver, methodObj, numArgs, methodObj.methodPrimitiveIndex(), null, null);
        return true;
    },
    primitiveArrayBecome: function(argCount, doBothWays, copyHash) {
        var rcvr = this.stackNonInteger(argCount),
            arg = this.stackNonInteger(argCount-1);
        if (argCount > 1) copyHash = this.stackBoolean(argCount-2);
        if (!this.success) return false;
        this.success = this.vm.image.bulkBecome(rcvr.pointers, arg.pointers, doBothWays, copyHash);
        // become may have swapped the active context's pointers array
        if (!this.vm.useStackZone) {
            this.vm.stack = this.vm.activeContext.pointers;
            this.vm.temps = this.vm.homeContext.pointers;
        }
        return this.popNIfOK(argCount);
    },
    primitiveBytesEqual: function(argCount) {
        // ByteArray>>= and friends. The Smalltalk fallback is SequenceableCollection>>=,
        // which answers on identity, then on species, then on the elements. We only
        // answer when both are plain byte objects of the SAME class (which implies the
        // same species); anything else fails and the image decides, as before.
        if (argCount !== 1) return false;
        var other = this.stackNonInteger(0),
            rcvr = this.stackNonInteger(1);
        if (!this.success) return false;
        if (!rcvr.bytes || !other.bytes) return false;      // word-based arrays: not ours
        if (rcvr.sqClass !== other.sqClass) return false;
        var a = rcvr.bytes, b = other.bytes;
        if (a.length !== b.length) return this.popNandPushBoolIfOK(argCount + 1, false);
        for (var i = 0; i < a.length; i++)
            if (a[i] !== b[i]) return this.popNandPushBoolIfOK(argCount + 1, false);
        return this.popNandPushBoolIfOK(argCount + 1, true);
    },
    primitiveCompareWith: function(argCount) {
        // String>>compareWith: aString  /  compareWith: aString collated: order
        // Answers -1, 0 or 1. Both dialects agree on that: Pharo returns those
        // directly, Squeak computes (compare:with:collated:) - 2. Note this is
        // NOT the 1/2/3 of MiscPrimitivePlugin's primitiveCompareString.
        // Without a collation table (compareWith:) the bytes are their own order.
        if (argCount !== 1 && argCount !== 2) return false;
        var order = argCount === 2 ? this.stackNonInteger(0) : null,
            string2 = this.stackNonInteger(argCount - 1),
            string1 = this.stackNonInteger(argCount);
        if (!this.success) return false;
        var b1 = string1.bytes, b2 = string2.bytes;
        if (!b1 || !b2) return false;       // WideString and friends: let Smalltalk do it
        var map = null;
        if (order) {
            map = order.bytes;
            if (!map || map.length < 256) return false;
        }
        var len1 = b1.length, len2 = b2.length,
            n = len1 < len2 ? len1 : len2;
        for (var i = 0; i < n; i++) {
            var c1 = map ? map[b1[i]] : b1[i],
                c2 = map ? map[b2[i]] : b2[i];
            if (c1 !== c2) return this.popNandPushIntIfOK(argCount + 1, c1 < c2 ? -1 : 1);
        }
        return this.popNandPushIntIfOK(argCount + 1, len1 === len2 ? 0 : len1 < len2 ? -1 : 1);
    },
    doStringReplace: function() {
        var dst = this.stackNonInteger(4);
        var dstPos = this.stackInteger(3) - 1;
        var count = this.stackInteger(2) - dstPos;
        var src = this.stackNonInteger(1);
        var srcPos = this.stackInteger(0) - 1;
        if (!this.success) return dst; //some integer not right
        if (!src.sameFormatAs(dst)) {this.success = false; return dst;} //incompatible formats
        if (src.isPointers()) {//pointer type objects
            var totalLength = src.pointersSize();
            var srcInstSize = src.instSize();
            srcPos += srcInstSize;
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.pointersSize();
            var dstInstSize= dst.instSize();
            dstPos += dstInstSize;
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success= false; return dst;} //would go out of bounds
            for (var i = 0; i < count; i++)
                dst.pointers[dstPos + i] = src.pointers[srcPos + i];
            dst.dirty = true; // we may have just stored a young object into an old one
            return dst;
        } else if (src.isWords()) { //words type objects
            var totalLength = src.wordsSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.wordsSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            if (src.isFloat && dst.isFloat)
                dst.float = src.float;
            else if (src.isFloat)
                dst.wordsAsFloat64Array()[dstPos] = src.float;
            else if (dst.isFloat)
                dst.float = src.wordsAsFloat64Array()[srcPos];
            else {
                var sharedWords = dst.words === src.words,
                    // see the note on the byte copy below for why this one case stays on the loop
                    overlapsForward = sharedWords && dstPos > srcPos && dstPos < srcPos + count;
                if (count >= 32 && !overlapsForward)
                    sharedWords
                        ? dst.words.copyWithin(dstPos, srcPos, srcPos + count)
                        : dst.words.set(src.words.subarray(srcPos, srcPos + count), dstPos);
                else for (var i = 0; i < count; i++)
                    dst.words[dstPos + i] = src.words[srcPos + i];
            }
            return dst;
        } else { //bytes type objects
            var totalLength = src.bytesSize();
            if ((srcPos < 0) || (srcPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            totalLength = dst.bytesSize();
            if ((dstPos < 0) || (dstPos + count) > totalLength)
                {this.success = false; return dst;} //would go out of bounds
            // Copy through the typed array rather than element by element: this is
            // primitive 105, which is how Squeak moves every String, ByteArray and
            // Bitmap around, and it showed up at 8.8% of the time inside the longest
            // frames of a Dialogo session. set() is specified to handle a source and
            // target that share a buffer, and copyWithin behaves like memmove, so a
            // self-copy stays correct. Small copies stay on the loop: below a few
            // dozen elements the subarray view costs more than it saves.
            //
            // One case has to stay on the loop for a different reason. When an object
            // is copied onto itself and the destination starts INSIDE the source, the
            // element loop reads back what it has already written and smears the first
            // values across the range, while copyWithin behaves like memmove and does
            // not. Squeak's own Smalltalk fallback for this primitive is a forward
            // loop, so the smear is the behaviour images have always seen here; this
            // is a speed-up, not the place to change what it does.
            var sharedBytes = dst.bytes === src.bytes,
                overlapsForward = sharedBytes && dstPos > srcPos && dstPos < srcPos + count;
            if (count >= 32 && !overlapsForward)
                sharedBytes
                    ? dst.bytes.copyWithin(dstPos, srcPos, srcPos + count)
                    : dst.bytes.set(src.bytes.subarray(srcPos, srcPos + count), dstPos);
            else for (var i = 0; i < count; i++)
                dst.bytes[dstPos + i] = src.bytes[srcPos + i];
            return dst;
        }
    },
    primitiveCopyObject: function(argCount) {
        var rcvr = this.stackNonInteger(1),
            arg = this.stackNonInteger(0),
            length = rcvr.pointersSize();
        if (!this.success ||
            rcvr.isWordsOrBytes() ||
            rcvr.sqClass !== arg.sqClass ||
            length !== arg.pointersSize()) return false;
        for (var i = 0; i < length; i++)
            rcvr.pointers[i] = arg.pointers[i];
        rcvr.dirty = arg.dirty;
        this.vm.popN(argCount);
        return true;
    },
    primitiveStoreImageSegment: function(argCount) {
        var arrayOfRoots = this.stackNonInteger(2),
            segmentWordArray = this.stackNonInteger(1),
            outPointerArray = this.stackNonInteger(0);
        if (!arrayOfRoots.pointers || !segmentWordArray.words || !outPointerArray.pointers) return false;
        var success = this.vm.image.storeImageSegment(segmentWordArray, outPointerArray, arrayOfRoots);
        if (!success) return false;
        this.vm.popN(argCount); // return self
        return true;
    },
    primitiveLoadImageSegment: function(argCount) {
        var segmentWordArray = this.stackNonInteger(1),
            outPointerArray = this.stackNonInteger(0);
        if (!segmentWordArray.words || !outPointerArray.pointers) return false;
        var roots = this.vm.image.loadImageSegment(segmentWordArray, outPointerArray);
        if (!roots) return false;
        return this.popNandPushIfOK(argCount + 1, roots);
    },
},
'blocks/closures', {
    doBlockCopy: function() {
        var rcvr = this.vm.stackValue(1);
        var sqArgCount = this.stackInteger(0);
        var homeCtxt = rcvr;
        if (!this.vm.isContext(homeCtxt)) this.success = false;
        if (!this.success) return rcvr;
        if (typeof homeCtxt.pointers[Squeak.Context_method] === "number")
            // ctxt is itself a block; get the context for its enclosing method
            homeCtxt = homeCtxt.pointers[Squeak.BlockContext_home];
        var blockSize = homeCtxt.pointersSize() - homeCtxt.instSize(); // could use a const for instSize
        var newBlock = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassBlockContext], blockSize);
        var initialPC = this.vm.encodeSqueakPC(this.vm.pc + 2, this.vm.method); //*** check this...
        newBlock.pointers[Squeak.BlockContext_initialIP] = initialPC;
        newBlock.pointers[Squeak.Context_instructionPointer] = initialPC; // claim not needed; value will set it
        newBlock.pointers[Squeak.Context_stackPointer] = 0;
        newBlock.pointers[Squeak.BlockContext_argumentCount] = sqArgCount;
        newBlock.pointers[Squeak.BlockContext_home] = homeCtxt;
        newBlock.pointers[Squeak.Context_sender] = this.vm.nilObj; // claim not needed; just initialized
        return newBlock;
    },
    primitiveBlockValue: function(argCount) {
        var rcvr = this.vm.stackValue(argCount);
        if (!this.isA(rcvr, Squeak.splOb_ClassBlockContext)) return false;
        var block = rcvr;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != argCount) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(this.vm.stack, this.vm.sp-argCount+1, block.pointers, Squeak.Context_tempFrameStart, argCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = argCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContextObj();
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveBlockValueWithArgs: function(argCount) {
        var block = this.vm.stackValue(1);
        var array = this.vm.stackValue(0);
        if (!this.isA(block, Squeak.splOb_ClassBlockContext)) return false;
        if (!this.isA(array, Squeak.splOb_ClassArray)) return false;
        var blockArgCount = block.pointers[Squeak.BlockContext_argumentCount];
        if (typeof blockArgCount !== "number") return false;
        if (blockArgCount != array.pointersSize()) return false;
        if (!block.pointers[Squeak.BlockContext_caller].isNil) return false;
        this.vm.arrayCopy(array.pointers, 0, block.pointers, Squeak.Context_tempFrameStart, blockArgCount);
        var initialIP = block.pointers[Squeak.BlockContext_initialIP];
        block.pointers[Squeak.Context_instructionPointer] = initialIP;
        block.pointers[Squeak.Context_stackPointer] = blockArgCount;
        block.pointers[Squeak.BlockContext_caller] = this.vm.activeContextObj();
        this.vm.popN(argCount+1);
        this.vm.newActiveContext(block);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureCopyWithCopiedValues: function(argCount) {
        this.vm.breakNow("primitiveClosureCopyWithCopiedValues");
        debugger;
        return false;
    },
    primitiveClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewClosureMethod(blockClosure, argCount);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        this.activateNewClosureMethod(blockClosure, arraySize);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveClosureValueNoContextSwitch: function(argCount) {
        // An exact clone of primitiveClosureValue except that this version will not check for interrupts
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewClosureMethod(blockClosure, argCount);
        return true;
    },
    primitiveFullClosureValue: function(argCount) {
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewFullClosure(blockClosure, argCount);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveFullClosureValueWithArgs: function(argCount) {
        var array = this.vm.top(),
            arraySize = array.pointersSize(),
            blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (arraySize !== blockArgCount) return false;
        this.vm.pop();
        for (var i = 0; i < arraySize; i++)
            this.vm.push(array.pointers[i]);
        this.activateNewFullClosure(blockClosure, arraySize);
        if (this.vm.interruptCheckCounter-- <= 0) this.vm.checkForInterrupts();
        return true;
    },
    primitiveFullClosureValueNoContextSwitch: function(argCount) {
        // An exact clone of primitiveFullClosureValue except that this version will not check for interrupts
        var blockClosure = this.vm.stackValue(argCount),
            blockArgCount = blockClosure.pointers[Squeak.Closure_numArgs];
        if (argCount !== blockArgCount) return false;
        this.activateNewFullClosure(blockClosure, argCount);
        return true;
    },
    activateNewClosureMethod: function(blockClosure, argCount) {
        var outerContext = blockClosure.pointers[Squeak.Closure_outerContext],
            method = outerContext.pointers[Squeak.Context_method],
            newContext = this.vm.allocateOrRecycleContext(method.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.Closure_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = blockClosure.pointers[Squeak.Closure_startpc];
        newContext.pointers[Squeak.Context_stackPointer] = argCount + numCopied;
        newContext.pointers[Squeak.Context_method] = outerContext.pointers[Squeak.Context_method];
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = outerContext.pointers[Squeak.Context_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.Closure_firstCopiedValue + i];
        // The initial instructions in the block nil-out remaining temps.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
    },
    activateNewFullClosure: function(blockClosure, argCount) {
        var closureMethod = blockClosure.pointers[Squeak.ClosureFull_method],
            newContext = this.vm.allocateOrRecycleContext(closureMethod.methodNeedsLargeFrame()),
            numCopied = blockClosure.pointers.length - Squeak.ClosureFull_firstCopiedValue;
        newContext.pointers[Squeak.Context_sender] = this.vm.activeContext;
        newContext.pointers[Squeak.Context_instructionPointer] = this.vm.encodeSqueakPC(0, closureMethod);
        newContext.pointers[Squeak.Context_stackPointer] = closureMethod.methodTempCount(); // argCount + numCopied + numActualTemps
        newContext.pointers[Squeak.Context_method] = closureMethod;
        newContext.pointers[Squeak.Context_closure] = blockClosure;
        newContext.pointers[Squeak.Context_receiver] = blockClosure.pointers[Squeak.ClosureFull_receiver];
        // Copy the arguments and copied values ...
        var where = Squeak.Context_tempFrameStart;
        for (var i = 0; i < argCount; i++)
            newContext.pointers[where++] = this.vm.stackValue(argCount - i - 1);
        for (var i = 0; i < numCopied; i++)
            newContext.pointers[where++] = blockClosure.pointers[Squeak.ClosureFull_firstCopiedValue + i];
        // No need to nil-out remaining temps as context pointers are nil-initialized.
        this.vm.popN(argCount + 1);
        this.vm.newActiveContext(newContext);
        if (!closureMethod.compiled) this.vm.compileIfPossible(closureMethod);
    },
},
'scheduling', {
    primitiveResume: function() {
        this.resume(this.vm.top());
        return true;
    },
    primitiveSuspend: function() {
        var process = this.vm.top();
        if (process === this.activeProcess()) {
            this.vm.popNandPush(1, this.vm.nilObj);
            this.transferTo(this.wakeHighestPriority());
        } else {
            var oldList = process.pointers[Squeak.Proc_myList];
            if (oldList.isNil) return false;
            this.removeProcessFromList(process, oldList);
            if (!this.success) return false;
            process.pointers[Squeak.Proc_myList] = this.vm.nilObj;
            this.vm.popNandPush(1, oldList);
        }
        return true;
    },
    primitiveSuspendAndBackupPC: function() {
        // primitive 578: like primitiveSuspend (88), but a process that is blocked on a
        // condition variable rather than merely ready to run is rewound to just before
        // the send that blocked it, so that resuming it re-enters the wait instead of
        // proceeding as if the wait had returned. The debugger and Process>>terminate
        // rely on this to suspend other processes without corrupting them; images test
        // bit 5 of vmParameterAt: 65 for it, and Cuis calls it with a fallback to 88
        // whose own comment warns "some methods may not work as expected".
        // Answers the list for a runnable process, nil for a blocked or active one.
        var process = this.vm.top();
        if (process === this.activeProcess()) {
            this.vm.popNandPush(1, this.vm.nilObj);
            this.transferTo(this.wakeHighestPriority());
            return true;
        }
        var oldList = process.pointers[Squeak.Proc_myList];
        if (oldList.isNil || !oldList.pointers) return false;
        var onRunQueue = this.isRunQueue(oldList);
        if (!onRunQueue && !this.backupToBlockingSend(process, oldList)) return false;
        this.removeProcessFromList(process, oldList);
        if (!this.success) return false;
        process.pointers[Squeak.Proc_myList] = this.vm.nilObj;
        process.dirty = true;
        this.vm.popNandPush(1, onRunQueue ? oldList : this.vm.nilObj);
        return true;
    },
    isRunQueue: function(aList) {
        // Is the process merely ready to run rather than blocked on a condition? The
        // reference VM answers that by class: a plain LinkedList is a scheduler queue,
        // anything else (Semaphore, Mutex, an image's own condition variable) is what a
        // process waits *on*. Asking the class rather than comparing against the queue
        // for the process's priority matters, because Process>>priority: is a plain
        // assignment in Squeak, Pharo and Cuis: a runnable process can sit in a queue
        // that no longer matches its priority field, and reading that as "blocked" would
        // back up the pc of a process that never blocked. The LinkedList class is taken
        // from a queue the scheduler owns, so no special-object index is needed.
        var processLists = this.getScheduler().pointers[Squeak.ProcSched_processLists],
            aQueue = processLists.pointers[0];
        return !!aQueue && aList.sqClass === aQueue.sqClass;
    },
    backupToBlockingSend: function(process, conditionVariable) {
        // Rewind a process blocked on a condition variable to just before the send that
        // blocked it, so that resuming it re-enters the wait instead of proceeding as if
        // the wait had returned. Two things have to move, as in the reference VM's
        // backupContext:toBlockingSendTo: — the pc, and the top of the stack.
        //
        // The stack matters because the blocking primitives do not agree on what they
        // leave there. primitiveWait links the process to the semaphore without touching
        // the stack, so the receiver of `wait` is still on top; primitiveEnterCriticalSection
        // pops receiver and args and pushes false *before* blocking, so the top holds
        // false where the mutex used to be, and re-running the send would send it to
        // false. Writing the condition variable into the top slot fixes the second case
        // and is a no-op for the first, since there the top already is that object.
        var context = process.pointers[Squeak.Proc_suspendedContext];
        if (!context || !context.pointers) return false;
        var method = context.pointers[Squeak.Context_method],
            pcObj = context.pointers[Squeak.Context_instructionPointer],
            spObj = context.pointers[Squeak.Context_stackPointer];
        if (!method || !method.bytes || typeof pcObj !== "number" || typeof spObj !== "number") return false;
        var sendPC = this.startOfPrecedingSend(method, this.vm.decodeSqueakPC(pcObj, method));
        if (sendPC < 0) return false;       // odd state: let the image's fallback deal with it
        var top = this.vm.decodeSqueakSP(spObj);
        if (top < Squeak.Context_tempFrameStart || top >= context.pointers.length) return false;
        context.pointers[Squeak.Context_instructionPointer] = this.vm.encodeSqueakPC(sendPC, method);
        context.pointers[top] = conditionVariable;
        context.dirty = true;
        return true;
    },
    startOfPrecedingSend: function(method, targetPC) {
        // Walk the method from its first bytecode and answer the position of the send
        // that ends exactly at targetPC, or -1 if that spot is not right after a send.
        // The walking is done by the VM's own decoder rather than by a second size
        // table here: a table has to be kept in step with two bytecode sets forever,
        // and it does not know that a bytecode like doubleExtendedDoAnything is a send
        // in two of its eight cases and a push or a store in the other six.
        var Stream = method.methodSignFlag() ? Squeak.InstructionStreamSista : Squeak.InstructionStream;
        if (!Stream) return -1;                     // decoder not loaded in this build
        var spotter = this.sendSpotter || (this.sendSpotter = this.makeSendSpotter()),
            stream = new Stream(method, this.vm),
            start = -1, wasSend = false;
        while (stream.pc < targetPC) {
            start = stream.pc;
            spotter.sawSend = false;
            try { stream.interpretNextInstructionFor(spotter); }
            catch (e) { return -1; }                // undecodable: leave it to the image
            if (stream.pc <= start) return -1;      // no progress: refuse to guess
            wasSend = spotter.sawSend;
        }
        return stream.pc === targetPC && wasSend ? start : -1;
    },
    makeSendSpotter: function() {
        // A decoder client that ignores every instruction except sends. It has to
        // answer all of them: an unimplemented one would throw and be read as
        // "undecodable" (see the catch above), quietly disabling the backup.
        var spotter = { sawSend: false },
            sawSend = function() { spotter.sawSend = true; },
            ignore = function() {},
            selectors = ["blockReturnConstant", "blockReturnTop", "callPrimitive", "doDup",
                "doPop", "jump", "jumpIf", "methodReturnConstant", "methodReturnReceiver",
                "methodReturnTop", "nop", "popIntoLiteralVariable", "popIntoNewArray",
                "popIntoReceiverVariable", "popIntoRemoteTemp", "popIntoTemporaryVariable",
                "pushActiveContext", "pushClosureCopy", "pushConstant", "pushFullClosure",
                "pushLiteralVariable", "pushNewArray", "pushReceiver", "pushReceiverVariable",
                "pushRemoteTemp", "pushTemporaryVariable", "storeIntoLiteralVariable",
                "storeIntoReceiverVariable", "storeIntoRemoteTemp", "storeIntoTemporaryVariable"];
        for (var i = 0; i < selectors.length; i++) spotter[selectors[i]] = ignore;
        spotter.send = sawSend;
        spotter.sendSuperDirected = sawSend;
        return spotter;
    },
    getScheduler: function() {
        var assn = this.vm.specialObjects[Squeak.splOb_SchedulerAssociation];
        return assn.pointers[Squeak.Assn_value];
    },
    activeProcess: function() {
        return this.getScheduler().pointers[Squeak.ProcSched_activeProcess];
    },
    resume: function(newProc) {
        var activeProc = this.activeProcess();
        var activePriority = activeProc.pointers[Squeak.Proc_priority];
        var newPriority = newProc.pointers[Squeak.Proc_priority];
        if (newPriority > activePriority) {
            this.putToSleep(activeProc);
            this.transferTo(newProc);
        } else {
            this.putToSleep(newProc);
        }
    },
    putToSleep: function(aProcess) {
        //Save the given process on the scheduler process list for its priority.
        var priority = aProcess.pointers[Squeak.Proc_priority];
        var processLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var processList = processLists.pointers[priority - 1];
        this.linkProcessToList(aProcess, processList);
    },
    transferTo: function(newProc) {
        //Record a process to be awakened on the next interpreter cycle.
        var sched = this.getScheduler();
        var oldProc = sched.pointers[Squeak.ProcSched_activeProcess];
        sched.pointers[Squeak.ProcSched_activeProcess] = newProc;
        sched.dirty = true;
        oldProc.pointers[Squeak.Proc_suspendedContext] = this.vm.activeContextObj();
        oldProc.dirty = true;
        this.vm.newActiveContext(newProc.pointers[Squeak.Proc_suspendedContext]);
        newProc.pointers[Squeak.Proc_suspendedContext] = this.vm.nilObj;
        if (!this.oldPrims) newProc.pointers[Squeak.Proc_myList] = this.vm.nilObj;
        this.vm.reclaimableContextCount = 0;
        if (this.vm.breakOnContextChanged) {
            this.vm.breakOnContextChanged = false;
            this.vm.breakNow();
        }
        if (this.vm.logProcess) console.log(
            "\n============= Process Switch ==================\n"
            + this.vm.printProcess(newProc, true, this.vm.logSends ? '| ' : '')
            + "===============================================");
    },
    wakeHighestPriority: function() {
        //Return the highest priority process that is ready to run.
        //Note: It is a fatal VM error if there is no runnable process.
        var schedLists = this.getScheduler().pointers[Squeak.ProcSched_processLists];
        var p = schedLists.pointersSize() - 1;  // index of last indexable field
        var processList;
        do {
            if (p < 0) throw Error("scheduler could not find a runnable process");
            processList = schedLists.pointers[p--];
        } while (this.isEmptyList(processList));
        return this.removeFirstLinkOfList(processList);
    },
    linkProcessToList: function(proc, aList) {
        // Add the given process to the given linked list and set the backpointer
        // of process to its new list.
        if (this.isEmptyList(aList)) {
            aList.pointers[Squeak.LinkedList_firstLink] = proc;
        } else {
            var lastLink = aList.pointers[Squeak.LinkedList_lastLink];
            lastLink.pointers[Squeak.Link_nextLink] = proc;
            lastLink.dirty = true;
        }
        aList.pointers[Squeak.LinkedList_lastLink] = proc;
        aList.dirty = true;
        proc.pointers[Squeak.Proc_myList] = aList;
        proc.dirty = true;
    },
    isEmptyList: function(aLinkedList) {
        return aLinkedList.pointers[Squeak.LinkedList_firstLink].isNil;
    },
    removeFirstLinkOfList: function(aList) {
        //Remove the first process from the given linked list.
        var first = aList.pointers[Squeak.LinkedList_firstLink];
        var last = aList.pointers[Squeak.LinkedList_lastLink];
        if (first === last) {
            aList.pointers[Squeak.LinkedList_firstLink] = this.vm.nilObj;
            aList.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
        } else {
            var next = first.pointers[Squeak.Link_nextLink];
            aList.pointers[Squeak.LinkedList_firstLink] = next;
            aList.dirty = true;
        }
        first.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
        return first;
    },
    removeProcessFromList: function(process, list) {
        var first = list.pointers[Squeak.LinkedList_firstLink];
        var last = list.pointers[Squeak.LinkedList_lastLink];
        if (process === first) {
            var next = process.pointers[Squeak.Link_nextLink];
            list.pointers[Squeak.LinkedList_firstLink] = next;
            if (process === last) {
                list.pointers[Squeak.LinkedList_lastLink] = this.vm.nilObj;
            }
        } else {
            var temp = first;
            while (true) {
                if (temp.isNil) {
                    if (this.oldPrims) this.success = false;
                    return;
                }
                next = temp.pointers[Squeak.Link_nextLink];
                if (next === process) break;
                temp = next;
            }
            next = process.pointers[Squeak.Link_nextLink];
            temp.pointers[Squeak.Link_nextLink] = next;
            if (process === last) {
                list.pointers[Squeak.LinkedList_lastLink] = temp;
            }
        }
        process.pointers[Squeak.Link_nextLink] = this.vm.nilObj;
    },
    registerSemaphore: function(specialObjIndex) {
        var sema = this.vm.top();
        if (this.isKindOf(sema, Squeak.splOb_ClassSemaphore))
            this.vm.specialObjects[specialObjIndex] = sema;
        else
            this.vm.specialObjects[specialObjIndex] = this.vm.nilObj;
        return this.vm.stackValue(1);
    },
    primitiveWait: function() {
        // Subclasses count: Pharo 13 waits on a SymbolTableSemaphore, and an exact-class
        // check failed the primitive, so Symbol class>>intern: could never take its lock —
        // no symbol could be created and the image never finished starting up.
        var sema = this.vm.top();
        if (!this.isKindOf(sema, Squeak.splOb_ClassSemaphore)) return false;
        var excessSignals = sema.pointers[Squeak.Semaphore_excessSignals];
        if (excessSignals > 0)
            sema.pointers[Squeak.Semaphore_excessSignals] = excessSignals - 1;
        else {
            this.linkProcessToList(this.activeProcess(), sema);
            this.transferTo(this.wakeHighestPriority());
        }
        return true;
    },
    primitiveSignal: function() {
        var sema = this.vm.top();
        if (!this.isKindOf(sema, Squeak.splOb_ClassSemaphore)) return false;
        this.synchronousSignal(sema);
        return true;
    },
    synchronousSignal: function(sema) {
        if (this.isEmptyList(sema)) {
            // no process is waiting on this semaphore
            sema.pointers[Squeak.Semaphore_excessSignals]++;
        } else
            this.resume(this.removeFirstLinkOfList(sema));
        return;
    },
    signalAtMilliseconds: function(sema, msTime) {
        if (this.isKindOf(sema, Squeak.splOb_ClassSemaphore)) {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = sema;
            this.vm.nextWakeupTick = msTime;
        } else {
            this.vm.specialObjects[Squeak.splOb_TheTimerSemaphore] = this.vm.nilObj;
            this.vm.nextWakeupTick = 0;
        }
    },
    primitiveSignalAtMilliseconds: function(argCount) {
        var msTime = this.stackInteger(0);
        var sema = this.stackNonInteger(1);
        if (!this.success) return false;
        this.signalAtMilliseconds(sema, msTime);
        this.vm.popN(argCount); // return self
        return true;
    },
    primitiveSignalAtUTCMicroseconds: function(argCount) {
        var usecsUTC = this.stackSigned53BitInt(0);
        var sema = this.stackNonInteger(1);
        if (!this.success) return false;
        var msTime = (usecsUTC / 1000 + Squeak.EpochUTC - this.vm.startupTime) & Squeak.MillisecondClockMask;
        this.signalAtMilliseconds(sema, msTime);
        this.vm.popN(argCount); // return self
        return true;
    },
    signalSemaphoreWithIndex: function(semaIndex) {
        // asynch signal: will actually be signaled in checkForInterrupts()
        this.semaphoresToSignal.push(semaIndex);
    },
    signalExternalSemaphores: function() {
        var semaphores = this.vm.specialObjects[Squeak.splOb_ExternalObjectsArray].pointers,
            semaClass = this.vm.specialObjects[Squeak.splOb_ClassSemaphore];
        while (this.semaphoresToSignal.length) {
            var semaIndex = this.semaphoresToSignal.shift(),
                sema = semaphores[semaIndex - 1];
            if (sema.sqClass == semaClass)
                this.synchronousSignal(sema);
        }
    },
    primitiveEnterCriticalSection: function(argCount) {
        if (argCount > 1) return false;
        var mutex = this.vm.stackValue(argCount);
        var activeProc = argCount ? this.vm.top() : this.activeProcess();
        var owningProcess = mutex.pointers[Squeak.Mutex_owner];
        if (owningProcess.isNil) {
            mutex.pointers[Squeak.Mutex_owner] = activeProc;
            mutex.dirty = true;
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
        } else if (owningProcess === activeProc) {
            this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
        } else {
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
            this.linkProcessToList(activeProc, mutex);
            this.transferTo(this.wakeHighestPriority());
        }
        return true;
    },
    primitiveExitCriticalSection: function(argCount) {
        var criticalSection = this.vm.top();
        if (this.isEmptyList(criticalSection)) {
            criticalSection.pointers[Squeak.Mutex_owner] = this.vm.nilObj;
        } else {
            var owningProcess = this.removeFirstLinkOfList(criticalSection);
            criticalSection.pointers[Squeak.Mutex_owner] = owningProcess;
            criticalSection.dirty = true;
            this.resume(owningProcess);
        }
        return true;
    },
    primitiveTestAndSetOwnershipOfCriticalSection: function(argCount) {
        if (argCount > 1) return false;
        var mutex = this.vm.stackValue(argCount);
        var activeProc = argCount ? this.vm.top() : this.activeProcess();
        var owningProcess = mutex.pointers[Squeak.Mutex_owner];
        if (owningProcess.isNil) {
            mutex.pointers[Squeak.Mutex_owner] = activeProc;
            mutex.dirty = true;
            this.popNandPushIfOK(argCount + 1, this.vm.falseObj);
        } else if (owningProcess === activeProc) {
            this.popNandPushIfOK(argCount + 1, this.vm.trueObj);
        } else {
            this.popNandPushIfOK(argCount + 1, this.vm.nilObj);
        }
        return true;
    },
},
'vm functions', {
    primitiveGetAttribute: function(argCount) {
        var attr = this.stackInteger(0);
        if (!this.success) return false;
        var argv = this.display.argv,
            vmOptions = this.display.vmOptions,
            value = null;
        switch (attr) {
            case 0: value = (argv && argv[0]) || this.filenameToSqueak(Squeak.vmPath + Squeak.vmFile); break;
            case 1: value = (argv && argv[1]) || this.display.documentName; break; // 1.x images want document here
            case 2: value = (argv && argv[2]) || this.display.documentName; break; // later images want document here
            case 1001: value = this.vm.options.unix ? "unix" : Squeak.platformName; break;
            case 1002: value = Squeak.osVersion; break;
            case 1003: value = Squeak.platformSubtype; break;
            case 1004: value = Squeak.vmVersion + ' ' + Squeak.vmMakerVersion; break;
            case 1005: value = Squeak.windowSystem; break;
            case 1006: value = Squeak.vmBuild; break;
            case 1007: value = Squeak.vmInterpreterVersion; break; // Interpreter class
            // case 1008: Cogit class
            case 1009: value = Squeak.vmVersion + ' Date: ' + Squeak.vmDate; break; // Platform source version
            default:
                if (attr >= 0 && argv && argv.length > attr) {
                    value = argv[attr];
                } else if (attr < 0 && vmOptions && vmOptions.length > -attr - 1) {
                    value = vmOptions[-attr - 1];
                } else {
                    return false;
                }
        }
        this.vm.popNandPush(argCount+1, this.makeStObject(value));
        return true;
    },
    setLowSpaceThreshold: function() {
        var nBytes = this.stackInteger(0);
        if (this.success) this.vm.lowSpaceThreshold = nBytes;
        return this.vm.stackValue(1);
    },
    primitiveVMParameter: function(argCount) {
        /* Behaviour depends on argument count:
        0 args: return an Array of VM parameter values;
        1 arg:  return the indicated VM parameter;
        2 args: set the VM indicated parameter. */
        var paramsArraySize = this.vm.image.isSpur ? 71 : 44;
        switch (argCount) {
            case 0:
                var arrayObj = this.vm.instantiateClass(this.vm.specialObjects[Squeak.splOb_ClassArray], paramsArraySize);
                for (var i = 0; i < paramsArraySize; i++)
                    arrayObj.pointers[i] = this.makeStObject(this.vmParameterAt(i+1));
                return this.popNandPushIfOK(1, arrayObj);
            case 1:
                var parm = this.stackInteger(0);
                if (parm < 1 || parm > paramsArraySize) return false;
                return this.popNandPushIfOK(2, this.makeStObject(this.vmParameterAt(parm)));
            case 2:
                // ignore writes
                return this.popNandPushIfOK(3, 0);
        };
        return false;
    },
    vmParameterAt: function(index) {
        switch (index) {
            case 1: return this.vm.image.oldSpaceBytes;     // end of old-space (0-based, read-only)
            case 2: return this.vm.image.oldSpaceBytes;     // end of young-space (read-only)
            case 3: return this.vm.image.totalMemory;       // end of memory (read-only)
            case 4: return this.vm.image.allocationCount + this.vm.image.newSpaceCount; // allocationCount (read-only; nil in Cog VMs)
            // 5    allocations between GCs (read-write; nil in Cog VMs)
            // 6    survivor count tenuring threshold (read-write)
            case 7: return this.vm.image.gcCount;           // full GCs since startup (read-only)
            case 8: return this.vm.image.gcMilliseconds;    // total milliseconds in full GCs since startup (read-only)
            case 9: return this.vm.image.pgcCount;          // incremental GCs since startup (read-only)
            case 10: return this.vm.image.pgcMilliseconds;  // total milliseconds in incremental GCs since startup (read-only)
            case 11: return this.vm.image.gcTenured;        // tenures of surving objects since startup (read-only)
            // 12-20 specific to the translating VM
            case 15:
            case 16:                                        // idle microseconds
            case 17:
            case 18:
            case 19:
            case 20: return 0;                              // utc microseconds at VM start-up
            // 21   root table size (read-only)
            case 22: return 0;                              // root table overflows since startup (read-only)
            case 23: return this.vm.image.extraVMMemory;    // bytes of extra memory to reserve for VM buffers, plugins, etc.
            // 24   memory threshold above which to shrink object memory (read-write)
            // 25   memory headroom when growing object memory (read-write)
            // 26   interruptChecksEveryNms - force an ioProcessEvents every N milliseconds (read-write)
            // 27   number of times mark loop iterated for current IGC/FGC (read-only) includes ALL marking
            // 28   number of times sweep loop iterated for current IGC/FGC (read-only)
            // 29   number of times make forward loop iterated for current IGC/FGC (read-only)
            // 30   number of times compact move loop iterated for current IGC/FGC (read-only)
            // 31   number of grow memory requests (read-only)
            // 32   number of shrink memory requests (read-only)
            // 33   number of root table entries used for current IGC/FGC (read-only)
            // 34   number of allocations done before current IGC/FGC (read-only)
            // 35   number of survivor objects after current IGC/FGC (read-only)
            // 36   millisecond clock when current IGC/FGC completed (read-only)
            // 37   number of marked objects for Roots of the world, not including Root Table entries for current IGC/FGC (read-only)
            // 38   milliseconds taken by current IGC (read-only)
            // 39   Number of finalization signals for Weak Objects pending when current IGC/FGC completed (read-only)
            case 40: return 4; // BytesPerWord for this image
            case 41: return this.vm.image.formatVersion();
            //42    number of stack pages in use (Cog Stack VM only, otherwise nil)
            //43    desired number of stack pages (stored in image file header, max 65535; Cog VMs only, otherwise nil)
            case 44: return 0; // size of eden, in bytes
            // 45   desired size of eden, in bytes (stored in image file header; Cog VMs only, otherwise nil)
            // 46   size of machine code zone, in bytes (stored in image file header; Cog JIT VM only, otherwise nil)
            case 46: return 0;
            // 47   desired size of machine code zone, in bytes (applies at startup only, stored in image file header; Cog JIT VM only)
            case 48: return 0; // not yet using/modifying this.vm.image.headerFlags
            // 48	various properties stored in the image header (that instruct the VM) as an integer encoding an array of bit flags.
            //     Bit 0: in a threaded VM, if set, tells the VM that the image's Process class has threadAffinity as its 5th inst var
            //             (after nextLink, suspendedContext, priority & myList)
            //     Bit 1: in Cog JIT VMs, if set, asks the VM to set the flag bit in interpreted methods
            //     Bit 2: if set, preempting a process puts it to the head of its run queue, not the back,
            //             i.e. preempting a process by a higher priority one will not cause the preempted process to yield
            //                 to others at the same priority.
            //     Bit 3: in a muilt-threaded VM, if set, the Window system will only be accessed from the first VM thread (now unassigned)
            //     Bit 4: in a Spur VM, if set, causes weaklings and ephemerons to be queued individually for finalization
            //     Bit 5: if set, implies wheel events will be delivered as such and not mapped to arrow key events
            //     Bit 6: if set, implies arithmetic primitives will fail if given arguments of different types (float vs int)
            //     Bit 7: if set, causes times delivered from file primitives to be in UTC rather than local time
            //     Bit 8: if set, implies the VM will not upscale the display on high DPI monitors; older VMs did this by default.
            // 49   the size of the external semaphore table (read-write; Cog VMs only)
            // 50-51 reserved for VM parameters that persist in the image (such as eden above)
            // 52   root (remembered) table maximum size (read-only)
            // 53   the number of oldSpace segments (Spur only, otherwise nil)
            case 54: return this.vm.image.bytesLeft();  // total size of free old space (Spur only, otherwise nil)
            // 55   ratio of growth and image size at or above which a GC will be performed post scavenge (Spur only, otherwise nil)
            // 56   number of process switches since startup (read-only)
            // 57   number of ioProcessEvents calls since startup (read-only)
            // 58   number of forceInterruptCheck (Cog VMs) or quickCheckInterruptCalls (non-Cog VMs) calls since startup (read-only)
            // 59   number of check event calls since startup (read-only)
            // 60   number of stack page overflows since startup (read-only; Cog VMs only)
            // 61   number of stack page divorces since startup (read-only; Cog VMs only)
            // 62   number of machine code zone compactions since startup (read-only; Cog VMs only)
            // 63   milliseconds taken by machine code zone compactions since startup (read-only; Cog VMs only)
            // 64   current number of machine code methods (read-only; Cog VMs only)
            // 65   In newer Cog VMs a set of flags describing VM features,
            //      if non-zero bit 0 implies multiple bytecode set support;
            //      if non-zero bit 1 implies read-only object support;
            //      if non-zero bit 2 implies the VM suffers from using an ITIMER heartbeat (if 0 it has a thread that provides the heartbeat)
            //      if non-zero bit 3 implies the VM supports cross-platform BIT_IDENTICAL_FLOATING_POINT arithmetic
            //      if non-zero bit 4 implies the VM can catch exceptions in FFI calls and answer them as primitive failures
            //      if non-zero bit 5 implies the VM's suspend primitive backs up the process to before the wait if it was waiting on a condition variable
            //      (read-only; Cog VMs only; nil in older Cog VMs, a boolean answering multiple bytecode support in not so old Cog VMs)
            case 65: return 32; // bit 5: primitiveSuspendAndBackupPC (578)
            // 66   the byte size of a stack page in the stack zone  (read-only; Cog VMs only)
            // 67   the maximum allowed size of old space in bytes, 0 implies no internal limit (Spur VMs only).
            case 67: return this.vm.image.totalMemory;
            // 68 - 69 reserved for more Cog-related info
            // 70   the value of VM_PROXY_MAJOR (the interpreterProxy major version number)
            // 71   the value of VM_PROXY_MINOR (the interpreterProxy minor version number)
            // 72   total milliseconds in full GCs Mark phase since startup (read-only)
            // 73   total milliseconds in full GCs Sweep phase since startup (read-only, can be 0 depending on compactors)
            // 74   maximum pause time due to segment allocation
            // 75   whether arithmetic primitives will do mixed type arithmetic; if false they fail for different receiver and argument types
            // 76   the minimum unused headroom in all stack pages; Cog VMs only
        }
        return null;
    },
    primitiveImageName: function(argCount) {
        if (argCount == 0)
            return this.popNandPushIfOK(1, this.makeStString(this.filenameToSqueak(this.vm.image.name)));
        this.vm.image.name = this.filenameFromSqueak(this.vm.top().bytesAsString());
        Squeak.Settings['squeakImageName'] = this.vm.image.name;
        this.vm.popN(argCount);
        return true;
    },
    primitiveInterpreterSourceVersion: function(argCount) {
        // Pharo parses this via (version splitOn: 'Date: ') second asDate, and
        // DiskStore>>checkVMVersion requires that date >= 2019-01-05 — otherwise the
        // error aborts DiskStore's startUp before it sets its working directory
        // (breaking FileSystem workingDirectory and startup scripts). Use the same
        // "<version> Date: <iso date>" shape the real VM (and our attribute 1009) uses.
        return this.popNandPushIfOK(argCount + 1, this.makeStString(Squeak.vmVersion + " Date: " + Squeak.vmDate));
    },
    primitiveGetCurrentWorkingDirectory: function(argCount) {
        // Pharo's working-directory primitive (empty-module VM primitive, distinct
        // from Cuis's FilePlugin.primitiveGetWorkingDirectory). Report our virtual
        // FS root as a UTF-8 String.
        var cwd = Squeak.workingDirectory || Squeak.vmPath || "/";
        return this.popNandPushIfOK(argCount + 1, this.makeStString(this.filenameToSqueak(cwd)));
    },
    primitiveGetenv: function(argCount) {
        // Pharo's UnixResolver reads HOME / TEMP / USER at startup to locate its
        // work directories ("origin"). We expose a Unix-like FS rooted at "/", so
        // hand back "/" for the home/temp vars (nil for the rest → Pharo derives
        // XDG_* etc. from HOME). Without this it errors: "Can't find the requested origin".
        var nameObj = this.stackNonInteger(0);
        if (!this.success) return false;
        var name = nameObj.bytesAsString();
        var env = { HOME: "/", PWD: "/", TEMP: "/", TMP: "/", TMPDIR: "/",
                    USER: "squeak", LOGNAME: "squeak" };
        var val = env.hasOwnProperty(name) ? env[name] : null;
        var result = val == null ? this.vm.nilObj : this.makeStString(val);
        return this.popNandPushIfOK(argCount + 1, result);
    },
    primitiveSnapshot: function(argCount) {
        this.vm.popNandPush(1, this.vm.trueObj);        // put true on stack for saved snapshot
        this.vm.storeContextRegisters();                // store current state for snapshot
        this.activeProcess().pointers[Squeak.Proc_suspendedContext] = this.vm.activeContextObj(); // store initial context
        this.vm.image.fullGC("snapshot");               // before cleanup so traversal works
        var buffer = this.vm.image.writeToBuffer();
        // Write snapshot if files are supported
        if (Squeak.flushAllFiles) {
            Squeak.flushAllFiles();                         // so there are no more writes pending
            Squeak.filePut(this.vm.image.name, buffer);
        }
        this.vm.popNandPush(1, this.vm.falseObj);       // put false on stack for continuing
        return true;
    },
    primitiveQuit: function(argCount) {
        // Flush any files if files are supported
        if (Squeak.flushAllFiles)
            Squeak.flushAllFiles();
        this.display.quitFlag = true;
        this.vm.breakNow("quit");
        return true;
    },
    primitiveExitToDebugger: function(argCount) {
        this.vm.breakNow("debugger primitive");
        //console.error(this.vm.printStack(null));
        debugger;
        return true;
    },
    primitiveSetGCBiasToGrow: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrow", 0, argCount);
    },
    primitiveSetGCBiasToGrowGCLimit: function(argCount) {
        return this.fakePrimitive(".primitiveSetGCBiasToGrowGCLimit", 0, argCount);
    },
},
'time', {
    primitiveRelinquishProcessorForMicroseconds: function(argCount) {
        // we ignore the optional arg
        this.vm.popN(argCount);
        this.vm.goIdle();        // might switch process, so must be after pop
        return true;
    },
    millisecondClockValue: function() {
        //Return the value of the millisecond clock as an integer.
        //Note that the millisecond clock wraps around periodically.
        //The range is limited to SmallInteger maxVal / 2 to allow
        //delays of up to that length without overflowing a SmallInteger.
        return (Date.now() - this.vm.startupTime) & Squeak.MillisecondClockMask;
    },
    millisecondClockValueSet: function(clock) {
        // set millisecondClock to the (previously saved) clock value
        // to allow "stopping" the VM clock while debugging
        this.vm.startupTime = Date.now() - clock;
    },
    secondClock: function() {
        return this.pos32BitIntFor(Squeak.totalSeconds()); // will overflow 32 bits in 2037
    },
    microsecondClock: function(state) {
        var millis = Date.now() - state.epoch;
        if (typeof performance !== "object")
            return this.pos53BitIntFor(millis * 1000);
        // use high-res clock, adjust for roll-over
        var micros = performance.now() * 1000 % 1000 | 0,
            oldMillis = state.millis,
            oldMicros = state.micros;
        if (oldMillis > millis) millis = oldMillis;                 // rolled over previously
        if (millis === oldMillis && micros < oldMicros) millis++;   // roll over now
        state.millis = millis;
        state.micros = micros;
        return this.pos53BitIntFor(millis * 1000 + micros);
    },
    microsecondClockUTC: function() {
        if (!this.microsecondClockUTCState)
            this.microsecondClockUTCState = {epoch: Squeak.EpochUTC, millis: 0, micros: 0};
        return this.microsecondClock(this.microsecondClockUTCState);
    },
    microsecondClockLocal: function() {
        if (!this.microsecondClockLocalState)
            this.microsecondClockLocalState = {epoch: Squeak.Epoch, millis: 0, micros: 0};
        return this.microsecondClock(this.microsecondClockLocalState);
    },
    primitiveUtcWithOffset: function(argCount) {
        var d = new Date();
        var posixMicroseconds = this.pos53BitIntFor(d.getTime() * 1000);
        var offset = -60 * d.getTimezoneOffset();
        if (argCount > 0) {
            // either an Array or a DateAndTime in new UTC format with two ivars
            var stWordIndexableObject = this.vm.stackValue(0);
            stWordIndexableObject.pointers[0] = posixMicroseconds;
            stWordIndexableObject.pointers[1] = offset;
            this.popNandPushIfOK(argCount + 1, stWordIndexableObject);
            return true;
        }
        var timeAndOffset = [
            posixMicroseconds,
            offset,
        ];
        this.popNandPushIfOK(argCount + 1, this.makeStArray(timeAndOffset));
        return true;
    },
});
