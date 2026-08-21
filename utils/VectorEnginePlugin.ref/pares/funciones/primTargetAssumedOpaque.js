function primTargetAssumedOpaque(argCount) {
    if (!isBooleanObject(stackValue(0))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    targetAssumedOpaque = booleanValueOf(stackValue(0));
    if (!failed()) pop(1);
    return !failed();
}
