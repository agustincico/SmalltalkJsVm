/* VectorEnginePlugin>>#arcCenterX:centerY:radiusX:radiusY:start:sweep:rotationCos:rotationSin: */
EXPORT(sqInt)
primArc(void)
{
	float angle;
	double centerX;
	double centerY;
	float d;
	sqInt h;
	int hops;
	double radiusPointX;
	double radiusPointY;
	float scale;
	double startAngle;
	double sweepAngle;
	float tcx;
	float tcy;
	float trx;
	float try;
	double tthetaCos;
	double tthetaSin;
	float x;
	float xp;
	float y;
	float yp;

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
	centerX = stackFloatValue(7);
	centerY = stackFloatValue(6);
	radiusPointX = stackFloatValue(5);
	radiusPointY = stackFloatValue(4);
	startAngle = stackFloatValue(3);
	sweepAngle = stackFloatValue(2);
	tthetaCos = stackFloatValue(1);
	tthetaSin = stackFloatValue(0);
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	tcx = ((centerX * txA11) + (centerY * txA12)) + txA13;
	tcy = ((centerX * txA21) + (centerY * txA22)) + txA23;
	scale = sqrt(((txA11 * txA11)) + ((txA21 * txA21)));
	trx = radiusPointX * scale;
	try = radiusPointY * scale;
	hops = (((sqInt)(((((trx < try) ? try : trx)) * (fabs(sweepAngle))) / hop))) + 2;
	d = hops;
	for (h = 0; h <= hops; h += 1) {
		angle = ((h / d) * sweepAngle) + startAngle;
		xp = (cos(angle)) * trx;
		yp = (sin(angle)) * try;
		x = ((tthetaCos * xp) - (tthetaSin * yp)) + tcx;
		y = ((tthetaSin * xp) + (tthetaCos * yp)) + tcy;
		spanLeft = ((spanLeft < x) ? spanLeft : x);
		spanTop = ((spanTop < y) ? spanTop : y);
		spanRight = ((spanRight < x) ? x : spanRight);
		spanBottom = ((spanBottom < y) ? y : spanBottom);
		updateAlphasForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountAtXy(x, y);
		}
		updateContourForXy(x, y);
	}
	if (!(failed())) {
		pop(8);
	}
	return null;
}
