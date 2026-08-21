/* VectorEnginePlugin>>#lineWPFromX:y:toX:y: */
EXPORT(sqInt)
primLineWP(void)
{
	double xFrom;
	double xTo;
	double yFrom;
	double yTo;

	if (!((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	xFrom = stackFloatValue(3);
	yFrom = stackFloatValue(2);
	xTo = stackFloatValue(1);
	yTo = stackFloatValue(0);
	pvt_lineWPFromXytoXy(xFrom, yFrom, xTo, yTo);
	if (!(failed())) {
		pop(4);
	}
	return null;
}
