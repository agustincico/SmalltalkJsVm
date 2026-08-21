/* VectorEnginePlugin>>#antiAliasingWidth:subPixelDelta: */
EXPORT(sqInt)
primAntiAliasingWidthsubPixelDelta(void)
{
	double aFloat;
	double otherFloat;

	if (!((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aFloat = stackFloatValue(1);
	otherFloat = stackFloatValue(0);
	antiAliasingWidth = aFloat;
	subPixelDelta = otherFloat;
	auxAntiAliasingWidthScaledInverse = 127.0 / antiAliasingWidth;
	if (!(failed())) {
		pop(2);
	}
	return null;
}
