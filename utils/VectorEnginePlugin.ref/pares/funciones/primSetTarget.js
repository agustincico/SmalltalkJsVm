function primSetTarget(argCount) {
    var aNumber, otherNumber;
    if (!(isWords(stackValue(7)) && isWords(stackValue(6))
        && isWords(stackValue(5)) && isWords(stackValue(4))
        && isBytes(stackValue(3)) && isWordsOrBytes(stackValue(2))
        && isIntegerObject((aNumber = stackValue(1)))
        && isIntegerObject((otherNumber = stackValue(0))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    targetBits = wordsOf(stackValue(7));
    morphIds = wordsOf(stackValue(6));
    edgeCounts = wordsOf(stackValue(5));
    alphaMask = wordsOf(stackValue(4));
    affectedBits = bytesOf(stackValue(3));
    contour = float32Of(stackValue(2));
    targetWidth = aNumber;
    targetHeight = otherNumber;
    clippingSpec = null;
    if (!failed()) pop(8);
    return !failed();
}
