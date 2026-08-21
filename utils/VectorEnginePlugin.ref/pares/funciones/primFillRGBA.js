function primFillRGBA(argCount) {
    if (!(isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    fillR = stackFloatValue(3) * 255.0;
    fillG = stackFloatValue(2) * 255.0;
    fillB = stackFloatValue(1) * 255.0;
    fillA = stackFloatValue(0);
    if (!failed()) pop(4);
    return !failed();
}
