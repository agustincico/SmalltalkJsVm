/*** primitives, in the C file's order where possible ***/
function dashedStrokeBitsSet(argCount) {
    var onOffBitSequence, numberOfBitsInSequence, offset;
    if (!(isIntegerObject((onOffBitSequence = stackValue(3)))
        && isIntegerObject((numberOfBitsInSequence = stackValue(2)))
        && isFloatObject(stackValue(1))
        && isIntegerObject((offset = stackValue(0))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    dashedStrokeBits = onOffBitSequence;
    dashBitCount = numberOfBitsInSequence;
    dashBitLength = stackFloatValue(1);
    dashBitOffset = offset;
    if (!failed()) pop(4);
    return !failed();
}
