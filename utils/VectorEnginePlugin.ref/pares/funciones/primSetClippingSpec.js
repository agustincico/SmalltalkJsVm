function primSetClippingSpec(argCount) {
    if (!isWords(stackValue(0))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    clippingSpec = int32Of(stackValue(0));
    if (!failed()) pop(1);
    return !failed();
}
