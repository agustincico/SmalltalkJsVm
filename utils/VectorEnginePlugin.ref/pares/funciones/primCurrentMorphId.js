function primCurrentMorphId(argCount) {
    var aNumber;
    if (!isIntegerObject((aNumber = stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    currentMorphId = aNumber >>> 0;
    if (!failed()) pop(1);
    return !failed();
}
