/* VectorEnginePlugin>>#geometryTxA11:a12:a13:a21:a22:a23: */
EXPORT(sqInt)
primGeometryTxSet(void)
{
	double a11;
	double a12;
	double a13;
	double a21;
	double a22;
	double a23;

	if (!((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isFloatObject(stackValue(1)))
		 && (isFloatObject(stackValue(0))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	a11 = stackFloatValue(5);
	a12 = stackFloatValue(4);
	a13 = stackFloatValue(3);
	a21 = stackFloatValue(2);
	a22 = stackFloatValue(1);
	a23 = stackFloatValue(0);
	txA11 = a11;
	txA12 = a12;
	txA13 = a13;
	txA21 = a21;
	txA22 = a22;
	txA23 = a23;
	if (!(failed())) {
		pop(6);
	}
	return null;
}
