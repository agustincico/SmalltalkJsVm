/* VectorEnginePlugin>>#cubicBezierFromX:y:toX:y:control1X:y:control2X:y: */
EXPORT(sqInt)
primCubicBezier(void)
{
	double xControl1;
	double xControl2;
	double xFrom;
	double xTo;
	double yControl1;
	double yControl2;
	double yFrom;
	double yTo;

	if (!((isFloatObject(stackValue(7)))
		 && ((isFloatObject(stackValue(6)))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	xFrom = stackFloatValue(7);
	yFrom = stackFloatValue(6);
	xTo = stackFloatValue(5);
	yTo = stackFloatValue(4);
	xControl1 = stackFloatValue(3);
	yControl1 = stackFloatValue(2);
	xControl2 = stackFloatValue(1);
	yControl2 = stackFloatValue(0);
	pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy(xFrom, yFrom, xTo, yTo, xControl1, yControl1, xControl2, yControl2);
	if (!(failed())) {
		pop(8);
	}
	return null;
}
