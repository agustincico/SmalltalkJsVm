/* VectorEnginePlugin>>#spanLeft */
EXPORT(sqInt)
primSpanLeft(void)
{
	/* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
	methodReturnValue(integerObjectOf((((sqInt)(((spanLeft - auxStrokeWidthDilatedHalf) - subPixelDelta) + 1)))));
	return null;
}
