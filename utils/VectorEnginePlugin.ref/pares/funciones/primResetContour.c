/* VectorEnginePlugin>>#resetContourTop:bottom: */
EXPORT(sqInt)
primResetContour(void)
{
	sqInt b;
	sqInt t;
	sqInt y;

	if (!((isIntegerObject((t = stackValue(1))))
		 && (isIntegerObject((b = stackValue(0)))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	t = integerValueOf(t);
	b = integerValueOf(b);
	leftAtThisY = 1.0e6;
	rightAtThisY = 0.0;
	for (y = t; y <= b; y += 1) {
		contour[y * 2] = 1.0e6;
		contour[(y * 2) + 1] = 0.0;
	}
	if (!(failed())) {
		pop(2);
	}
	return null;
}
