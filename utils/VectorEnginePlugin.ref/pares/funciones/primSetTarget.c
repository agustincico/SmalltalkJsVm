/* VectorEnginePlugin>>#targetBits:morphIds:edgeCounts:alphaMask:affectedBits:contour:targetWidth:targetHeight: */
EXPORT(sqInt)
primSetTarget(void)
{
	unsigned *aBitmap;
	float *aFloat32Array;
	unsigned char *affectedBitsBA;
	sqInt aNumber;
	unsigned *anotherWordArray;
	unsigned *aWordArray;
	sqInt otherNumber;
	unsigned *otherWordArray;

	if (!((isWords(stackValue(7)))
		 && ((isWords(stackValue(6)))
		 && ((isWords(stackValue(5)))
		 && ((isWords(stackValue(4)))
		 && ((isBytes(stackValue(3)))
		 && ((isWordsOrBytes(stackValue(2)))
		 && ((isIntegerObject((aNumber = stackValue(1))))
		 && (isIntegerObject((otherNumber = stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aBitmap = firstIndexableField(stackValue(7));
	aWordArray = firstIndexableField(stackValue(6));
	otherWordArray = firstIndexableField(stackValue(5));
	anotherWordArray = firstIndexableField(stackValue(4));
	affectedBitsBA = firstIndexableField(stackValue(3));
	aFloat32Array = firstIndexableField(stackValue(2));
	aNumber = integerValueOf(aNumber);
	otherNumber = integerValueOf(otherNumber);
	targetBits = aBitmap;
	morphIds = aWordArray;
	edgeCounts = otherWordArray;
	alphaMask = anotherWordArray;
	affectedBits = affectedBitsBA;
	contour = aFloat32Array;
	targetWidth = aNumber;
	targetHeight = otherNumber;
	clippingSpec = null;
	if (!(failed())) {
		pop(8);
	}
	return null;
}
