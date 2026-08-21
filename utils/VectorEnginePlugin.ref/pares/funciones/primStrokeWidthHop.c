/* VectorEnginePlugin>>#strokeWidth:hop: */
EXPORT(sqInt)
primStrokeWidthHop(void)
{
	double aFloat;
	double aNumber;
	float swErodedHalf;

	if (!((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aNumber = stackFloatValue(1);
	aFloat = stackFloatValue(0);
	strokeWidth = aNumber;
	hop = aFloat;
	auxStrokeWidthDilatedHalf = (strokeWidth + antiAliasingWidth) * 0.5;
	auxStrokeWidthDilatedHalfSquared = auxStrokeWidthDilatedHalf * auxStrokeWidthDilatedHalf;

	/* swErodedHalf is the inner radious of the alphas ring. */
	swErodedHalf = (((strokeWidth - antiAliasingWidth) * 0.5) - hop) - 2.0;
	auxStrokeWidthErodedHalfSquared = swErodedHalf * (fabsf(swErodedHalf));

	/* Set them later with a call to dashedStrokeBits if desired. */
	dashedStrokeBits = 0;
	dashBitCount = 0;
	dashBitLength = 0.0;
	dashBitOffset = 0;
	if (!(failed())) {
		pop(2);
	}
	return null;
}
