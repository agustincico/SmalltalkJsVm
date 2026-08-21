function primClipLeftclipTopclipRightclipBottom(argCount) {
    var l, t, r, b;
    if (!(isIntegerObject((l = stackValue(3)))
        && isIntegerObject((t = stackValue(2)))
        && isIntegerObject((r = stackValue(1)))
        && isIntegerObject((b = stackValue(0))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    clipLeft = l; clipTop = t; clipRight = r; clipBottom = b;
    if (!failed()) pop(4);
    return !failed();
}
