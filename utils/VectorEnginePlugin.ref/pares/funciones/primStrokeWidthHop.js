function primStrokeWidthHop(argCount) {
    var swErodedHalf;
    if (!(isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    strokeWidth = stackFloatValue(1);
    hop = stackFloatValue(0);
    auxStrokeWidthDilatedHalf = (strokeWidth + antiAliasingWidth) * 0.5;
    auxStrokeWidthDilatedHalfSquared = auxStrokeWidthDilatedHalf * auxStrokeWidthDilatedHalf;
    // swErodedHalf is the inner radious of the alphas ring.
    swErodedHalf = (((strokeWidth - antiAliasingWidth) * 0.5) - hop) - 2.0;
    auxStrokeWidthErodedHalfSquared = swErodedHalf * Math.abs(swErodedHalf);
    // Set them later with a call to dashedStrokeBits if desired.
    dashedStrokeBits = 0;
    dashBitCount = 0;
    dashBitLength = 0.0;
    dashBitOffset = 0;
    if (!failed()) pop(2);
    return !failed();
}
