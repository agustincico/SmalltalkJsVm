/* VectorEnginePlugin>>#strokeR:g:b:a: */
EXPORT(sqInt)
primStrokeRGBA(void)
{
	double a;
	double b;
	double g;
	double r;

	if (!((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	r = stackFloatValue(3);
	g = stackFloatValue(2);
	b = stackFloatValue(1);
	a = stackFloatValue(0);
	strokeR = r * 255.0;
	strokeG = g * 255.0;
	strokeB = b * 255.0;
	strokeA = a;
	if (!(failed())) {
		pop(4);
	}
	return null;
}
