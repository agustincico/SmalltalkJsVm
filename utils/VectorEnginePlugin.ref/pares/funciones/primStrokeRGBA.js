function primStrokeRGBA(argCount) {
    if (!(isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    strokeR = stackFloatValue(3) * 255.0;
    strokeG = stackFloatValue(2) * 255.0;
    strokeB = stackFloatValue(1) * 255.0;
    strokeA = stackFloatValue(0);
    if (!failed()) pop(4);
    return !failed();
}
