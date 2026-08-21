/* VectorEnginePlugin>>#fillR:g:b:a: */
EXPORT(sqInt)
primFillRGBA(void)
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
	fillR = r * 255.0;
	fillG = g * 255.0;
	fillB = b * 255.0;
	fillA = a;
	if (!(failed())) {
		pop(4);
	}
	return null;
}
