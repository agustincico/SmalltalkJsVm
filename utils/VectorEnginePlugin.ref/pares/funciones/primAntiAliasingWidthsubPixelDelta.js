function primAntiAliasingWidthsubPixelDelta(argCount) {
    if (!(isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    antiAliasingWidth = stackFloatValue(1);
    subPixelDelta = stackFloatValue(0);
    auxAntiAliasingWidthScaledInverse = 127.0 / antiAliasingWidth;
    if (!failed()) pop(2);
    return !failed();
}
