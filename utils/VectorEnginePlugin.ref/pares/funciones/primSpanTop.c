/* VectorEnginePlugin>>#spanTop */
EXPORT(sqInt)
primSpanTop(void)
{
	/* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
	methodReturnValue(integerObjectOf((((sqInt)((spanTop - auxStrokeWidthDilatedHalf) + 1)))));
	return null;
}
