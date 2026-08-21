function primSpanLeft(argCount) {
    // (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z))
    methodReturnValue(integerObjectOf(Math.trunc(((spanLeft - auxStrokeWidthDilatedHalf) - subPixelDelta) + 1)));
    return true;
}
