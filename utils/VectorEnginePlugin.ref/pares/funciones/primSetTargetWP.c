/* VectorEnginePlugin>>#targetBits:morphIds:edgeCountsWP:alphaMaskWP:affectedBits:contour:targetWidth:targetHeight: */
EXPORT(sqInt)
primSetTargetWP(void)
{
	unsigned *aBitmap;
	float *aFloat32Array;
	unsigned char *affectedBitsBA;
	sqInt aNumber;
	unsigned char *anotherByteArray;
	unsigned *aWordArray;
	unsigned char *otherByteArray;
	sqInt otherNumber;

	if (!((isWords(stackValue(7)))
		 && ((isWords(stackValue(6)))
		 && ((isBytes(stackValue(5)))
		 && ((isBytes(stackValue(4)))
		 && ((isBytes(stackValue(3)))
		 && ((isWordsOrBytes(stackValue(2)))
		 && ((isIntegerObject((aNumber = stackValue(1))))
		 && (isIntegerObject((otherNumber = stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aBitmap = firstIndexableField(stackValue(7));
	aWordArray = firstIndexableField(stackValue(6));
	otherByteArray = firstIndexableField(stackValue(5));
	anotherByteArray = firstIndexableField(stackValue(4));
	affectedBitsBA = firstIndexableField(stackValue(3));
	aFloat32Array = firstIndexableField(stackValue(2));
	aNumber = integerValueOf(aNumber);
	otherNumber = integerValueOf(otherNumber);
	targetBits = aBitmap;
	morphIds = aWordArray;
	edgeCountsWP = otherByteArray;
	alphaMaskWP = anotherByteArray;
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
