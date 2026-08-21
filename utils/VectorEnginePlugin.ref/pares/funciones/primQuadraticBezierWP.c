/* VectorEnginePlugin>>#quadraticBezierWPFromX:y:toX:y:controlX:y: */
EXPORT(sqInt)
primQuadraticBezierWP(void)
{
	double xControl;
	double xFrom;
	double xTo;
	double yControl;
	double yFrom;
	double yTo;

	if (!((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	xFrom = stackFloatValue(5);
	yFrom = stackFloatValue(4);
	xTo = stackFloatValue(3);
	yTo = stackFloatValue(2);
	xControl = stackFloatValue(1);
	yControl = stackFloatValue(0);
	pvt_quadraticBezierWPFromXytoXycontrolXy(xFrom, yFrom, xTo, yTo, xControl, yControl);
	if (!(failed())) {
		pop(6);
	}
	return null;
}
