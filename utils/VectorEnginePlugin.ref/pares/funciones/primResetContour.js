function primResetContour(argCount) {
    var t, b, y;
    if (!(isIntegerObject((t = stackValue(1)))
        && isIntegerObject((b = stackValue(0))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    leftAtThisY = 1.0e6;
    rightAtThisY = 0.0;
    for (y = t; y <= b; y += 1) {
        contour[y * 2] = 1.0e6;
        contour[(y * 2) + 1] = 0.0;
    }
    if (!failed()) pop(2);
    return !failed();
}
