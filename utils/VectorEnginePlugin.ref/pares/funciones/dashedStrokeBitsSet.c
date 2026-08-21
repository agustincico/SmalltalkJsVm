/* VectorEnginePlugin>>#dashedStrokeBits:dashBitCount:dashBitLength:dashBitOffset: */
EXPORT(sqInt)
dashedStrokeBitsSet(void)
{
	double lengthOfEachBit;
	sqInt numberOfBitsInSequence;
	sqInt offset;
	sqInt onOffBitSequence;

	if (!((isIntegerObject((onOffBitSequence = stackValue(3))))
		 && ((isIntegerObject((numberOfBitsInSequence = stackValue(2))))
		 && ((isFloatObject(stackValue(1)))
		 && (isIntegerObject((offset = stackValue(0)))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	onOffBitSequence = integerValueOf(onOffBitSequence);
	numberOfBitsInSequence = integerValueOf(numberOfBitsInSequence);
	lengthOfEachBit = stackFloatValue(1);
	offset = integerValueOf(offset);
	dashedStrokeBits = onOffBitSequence;
	dashBitCount = numberOfBitsInSequence;
	dashBitLength = lengthOfEachBit;
	dashBitOffset = offset;
	if (!(failed())) {
		pop(4);
	}
	return null;
}
