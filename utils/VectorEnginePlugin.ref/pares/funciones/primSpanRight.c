/* VectorEnginePlugin>>#spanRight */
EXPORT(sqInt)
primSpanRight(void)
{
	/* Make room not just for updated mask, but also edges (hence, +1) */
	methodReturnValue(integerObjectOf(((((sqInt)((spanRight + auxStrokeWidthDilatedHalf) + subPixelDelta))) + 1)));
	return null;
}
