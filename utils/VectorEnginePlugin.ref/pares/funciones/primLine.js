function primLine(argCount) {
    if (!(isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    pvt_lineFromXytoXy(stackFloatValue(3), stackFloatValue(2),
                       stackFloatValue(1), stackFloatValue(0));
    if (!failed()) pop(4);
    return !failed();
}
