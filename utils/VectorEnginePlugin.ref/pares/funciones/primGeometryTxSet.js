function primGeometryTxSet(argCount) {
    if (!(isFloatObject(stackValue(5)) && isFloatObject(stackValue(4))
        && isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    txA11 = stackFloatValue(5); txA12 = stackFloatValue(4); txA13 = stackFloatValue(3);
    txA21 = stackFloatValue(2); txA22 = stackFloatValue(1); txA23 = stackFloatValue(0);
    if (!failed()) pop(6);
    return !failed();
}
