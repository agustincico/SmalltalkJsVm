
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


/* ===== */


	/* VectorEnginePlugin>>#arcWPCenterX:centerY:radiusX:radiusY:start:sweep:rotationCos:rotationSin: */
EXPORT(sqInt)
primArcWP(void)
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
		updateAlphasWPForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountWPAtXy(x, y);
		}
		updateContourForXy(x, y);
	}
	if (!(failed())) {
		pop(8);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_cubicBezierFromX:y:toX:y:control1X:y:control2X:y: */
static sqInt
pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy(float xFrom, float yFrom, float xTo, float yTo, float xControl1, float yControl1, float xControl2, float yControl2)
{
	float correction;
	float dx;
	float dy;
	float f1;
	float f2;
	float f23;
	float f3;
	float f4;
	float increment;
	float length;
	float oneLessT;
	float t;
	float t0;
	float txControl1;
	float txControl2;
	float txFrom;
	float txTo;
	float tyControl1;
	float tyControl2;
	float tyFrom;
	float tyTo;
	float x;
	float x0;
	float xMaxEnd;
	float xMinEnd;
	float y;
	float y0;
	float yMaxEnd;
	float yMinEnd;

	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	txControl1 = ((xControl1 * txA11) + (yControl1 * txA12)) + txA13;
	tyControl1 = ((xControl1 * txA21) + (yControl1 * txA22)) + txA23;
	txControl2 = ((xControl2 * txA11) + (yControl2 * txA12)) + txA13;
	tyControl2 = ((xControl2 * txA21) + (yControl2 * txA22)) + txA23;

	/* This computed span of the Bezier curve is a bit pessimistic (larger than strict bounds), but safe. */
	xMinEnd = ((txFrom < txTo) ? txFrom : txTo);
	xMaxEnd = ((txFrom < txTo) ? txTo : txFrom);
	yMinEnd = ((tyFrom < tyTo) ? tyFrom : tyTo);
	yMaxEnd = ((tyFrom < tyTo) ? tyTo : tyFrom);
	spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))) ? xMinEnd : ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))))) ? spanLeft : (((xMinEnd < ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))) ? xMinEnd : ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75)))));
	spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75))) ? ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75)) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75))) ? ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75)) : xMaxEnd)) : spanRight);
	spanTop = ((spanTop < (((yMinEnd < ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))) ? yMinEnd : ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))))) ? spanTop : (((yMinEnd < ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))) ? yMinEnd : ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75)))));
	spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75))) ? ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75)) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75))) ? ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75)) : yMaxEnd)) : spanBottom);

	/* Case t = 0.0 */
	x = txFrom;
	y = tyFrom;
	updateAlphasForXy(x, y);
	if (!(fillA == 0.0)) {
		updateEdgeCountAtXy(x, y);
	}
	updateContourForXy(x, y);
	dx = fabsf(txTo - txFrom);
	dy = fabsf(tyTo - tyFrom);

	/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
	increment = (((0.5 / (((dx < dy) ? dy : dx))) < 0.5) ? (0.5 / (((dx < dy) ? dy : dx))) : 0.5);
	t = 0.0;
	while (1) {
		t0 = t;
		x0 = x;
		y0 = y;

		/* Compute next point */
		t = t0 + increment;
		oneLessT = 1.0 - t;
		f1 = (oneLessT * oneLessT) * oneLessT;
		f23 = (3.0 * oneLessT) * t;
		f2 = f23 * oneLessT;
		f3 = f23 * t;
		f4 = (t * t) * t;
		x = (((f1 * txFrom) + (f2 * txControl1)) + (f3 * txControl2)) + (f4 * txTo);
		y = (((f1 * tyFrom) + (f2 * tyControl1)) + (f3 * tyControl2)) + (f4 * tyTo);

		/* Now adjust the increment to aim at the required hop length, and recompute next point. */
		dx = x - x0;
		dy = y - y0;
		length = sqrt((dx * dx) + (dy * dy));

		/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
		correction = hop / (((length < 0.1) ? 0.1 : length));
		do {
			increment = increment * correction;
			t = t0 + increment;
			oneLessT = 1.0 - t;
			f1 = (oneLessT * oneLessT) * oneLessT;
			f23 = (3.0 * oneLessT) * t;
			f2 = f23 * oneLessT;
			f3 = f23 * t;
			f4 = (t * t) * t;
			x = (((f1 * txFrom) + (f2 * txControl1)) + (f3 * txControl2)) + (f4 * txTo);
			y = (((f1 * tyFrom) + (f2 * tyControl1)) + (f3 * tyControl2)) + (f4 * tyTo);
			dx = x - x0;
			dy = y - y0;
			length = sqrt((dx * dx) + (dy * dy));

			/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
			correction = hop / (((length < 0.1) ? 0.1 : length));
		} while(correction < 0.99);
		if (!(t < 1.0)) break;
		updateAlphasForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountAtXy(x, y);
		}
		updateContourForXy(x, y);
	}

	/* Case t= 1.0 */
	updateAlphasForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_cubicBezierWPFromX:y:toX:y:control1X:y:control2X:y: */
static sqInt
pvt_cubicBezierWPFromXytoXycontrol1Xycontrol2Xy(float xFrom, float yFrom, float xTo, float yTo, float xControl1, float yControl1, float xControl2, float yControl2)
{
	float correction;
	float dx;
	float dy;
	float f1;
	float f2;
	float f23;
	float f3;
	float f4;
	float increment;
	float length;
	float oneLessT;
	float t;
	float t0;
	float txControl1;
	float txControl2;
	float txFrom;
	float txTo;
	float tyControl1;
	float tyControl2;
	float tyFrom;
	float tyTo;
	float x;
	float x0;
	float xMaxEnd;
	float xMinEnd;
	float y;
	float y0;
	float yMaxEnd;
	float yMinEnd;

	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	txControl1 = ((xControl1 * txA11) + (yControl1 * txA12)) + txA13;
	tyControl1 = ((xControl1 * txA21) + (yControl1 * txA22)) + txA23;
	txControl2 = ((xControl2 * txA11) + (yControl2 * txA12)) + txA13;
	tyControl2 = ((xControl2 * txA21) + (yControl2 * txA22)) + txA23;

	/* This computed span of the Bezier curve is a bit pessimistic (larger than strict bounds), but safe. */
	xMinEnd = ((txFrom < txTo) ? txFrom : txTo);
	xMaxEnd = ((txFrom < txTo) ? txTo : txFrom);
	yMinEnd = ((tyFrom < tyTo) ? tyFrom : tyTo);
	yMaxEnd = ((tyFrom < tyTo) ? tyTo : tyFrom);
	spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))) ? xMinEnd : ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))))) ? spanLeft : (((xMinEnd < ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75))) ? xMinEnd : ((xMinEnd * 0.25) + ((((txControl1 < txControl2) ? txControl1 : txControl2)) * 0.75)))));
	spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75))) ? ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75)) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75))) ? ((xMaxEnd * 0.25) + ((((txControl1 < txControl2) ? txControl2 : txControl1)) * 0.75)) : xMaxEnd)) : spanRight);
	spanTop = ((spanTop < (((yMinEnd < ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))) ? yMinEnd : ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))))) ? spanTop : (((yMinEnd < ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75))) ? yMinEnd : ((yMinEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl1 : tyControl2)) * 0.75)))));
	spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75))) ? ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75)) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75))) ? ((yMaxEnd * 0.25) + ((((tyControl1 < tyControl2) ? tyControl2 : tyControl1)) * 0.75)) : yMaxEnd)) : spanBottom);

	/* Case t = 0.0 */
	x = txFrom;
	y = tyFrom;
	updateAlphasWPForXy(x, y);
	if (!(fillA == 0.0)) {
		updateEdgeCountWPAtXy(x, y);
	}
	updateContourForXy(x, y);
	dx = fabsf(txTo - txFrom);
	dy = fabsf(tyTo - tyFrom);

	/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
	increment = (((0.5 / (((dx < dy) ? dy : dx))) < 0.5) ? (0.5 / (((dx < dy) ? dy : dx))) : 0.5);
	t = 0.0;
	while (1) {
		t0 = t;
		x0 = x;
		y0 = y;

		/* Compute next point */
		t = t0 + increment;
		oneLessT = 1.0 - t;
		f1 = (oneLessT * oneLessT) * oneLessT;
		f23 = (3.0 * oneLessT) * t;
		f2 = f23 * oneLessT;
		f3 = f23 * t;
		f4 = (t * t) * t;
		x = (((f1 * txFrom) + (f2 * txControl1)) + (f3 * txControl2)) + (f4 * txTo);
		y = (((f1 * tyFrom) + (f2 * tyControl1)) + (f3 * tyControl2)) + (f4 * tyTo);

		/* Now adjust the increment to aim at the required hop length, and recompute next point. */
		dx = x - x0;
		dy = y - y0;
		length = sqrt((dx * dx) + (dy * dy));

		/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
		correction = hop / (((length < 0.1) ? 0.1 : length));
		do {
			increment = increment * correction;
			t = t0 + increment;
			oneLessT = 1.0 - t;
			f1 = (oneLessT * oneLessT) * oneLessT;
			f23 = (3.0 * oneLessT) * t;
			f2 = f23 * oneLessT;
			f3 = f23 * t;
			f4 = (t * t) * t;
			x = (((f1 * txFrom) + (f2 * txControl1)) + (f3 * txControl2)) + (f4 * txTo);
			y = (((f1 * tyFrom) + (f2 * tyControl1)) + (f3 * tyControl2)) + (f4 * tyTo);
			dx = x - x0;
			dy = y - y0;
			length = sqrt((dx * dx) + (dy * dy));

			/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
			correction = hop / (((length < 0.1) ? 0.1 : length));
		} while(correction < 0.99);
		if (!(t < 1.0)) break;
		updateAlphasWPForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountWPAtXy(x, y);
		}
		updateContourForXy(x, y);
	}

	/* Case t= 1.0 */
	updateAlphasWPForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountWPAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_lineFromX:y:toX:y: */
static sqInt
pvt_lineFromXytoXy(float xFrom, float yFrom, float xTo, float yTo)
{
	float dx;
	float dy;
	int hops;
	float increment;
	float oneLessT;
	float t;
	float txFrom;
	float txTo;
	float tyFrom;
	float tyTo;
	float x;
	float y;

	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	dx = txTo - txFrom;
	dy = tyTo - tyFrom;
	dx = fabsf(dx);
	dy = fabsf(dy);
	hops = (((sqInt)((((dx < dy) ? dy : dx)) / hop))) + 1;
	spanLeft = ((spanLeft < (((txFrom < txTo) ? txFrom : txTo))) ? spanLeft : (((txFrom < txTo) ? txFrom : txTo)));
	spanRight = ((spanRight < (((txFrom < txTo) ? txTo : txFrom))) ? (((txFrom < txTo) ? txTo : txFrom)) : spanRight);
	spanTop = ((spanTop < (((tyFrom < tyTo) ? tyFrom : tyTo))) ? spanTop : (((tyFrom < tyTo) ? tyFrom : tyTo)));
	spanBottom = ((spanBottom < (((tyFrom < tyTo) ? tyTo : tyFrom))) ? (((tyFrom < tyTo) ? tyTo : tyFrom)) : spanBottom);
	t = 0.0;
	increment = 1.0 / hops;
	while (t < 1.0) {
		oneLessT = 1.0 - t;
		x = (oneLessT * txFrom) + (t * txTo);
		y = (oneLessT * tyFrom) + (t * tyTo);
		updateAlphasForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountAtXy(x, y);
		}
		updateContourForXy(x, y);
		t += increment;
	}
	updateAlphasForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_lineWPFromX:y:toX:y: */
static sqInt
pvt_lineWPFromXytoXy(float xFrom, float yFrom, float xTo, float yTo)
{
	float dx;
	float dy;
	int hops;
	float increment;
	float oneLessT;
	float t;
	float txFrom;
	float txTo;
	float tyFrom;
	float tyTo;
	float x;
	float y;

	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	dx = txTo - txFrom;
	dy = tyTo - tyFrom;
	dx = fabsf(dx);
	dy = fabsf(dy);
	hops = (((sqInt)((((dx < dy) ? dy : dx)) / hop))) + 1;
	spanLeft = ((spanLeft < (((txFrom < txTo) ? txFrom : txTo))) ? spanLeft : (((txFrom < txTo) ? txFrom : txTo)));
	spanRight = ((spanRight < (((txFrom < txTo) ? txTo : txFrom))) ? (((txFrom < txTo) ? txTo : txFrom)) : spanRight);
	spanTop = ((spanTop < (((tyFrom < tyTo) ? tyFrom : tyTo))) ? spanTop : (((tyFrom < tyTo) ? tyFrom : tyTo)));
	spanBottom = ((spanBottom < (((tyFrom < tyTo) ? tyTo : tyFrom))) ? (((tyFrom < tyTo) ? tyTo : tyFrom)) : spanBottom);
	t = 0.0;
	increment = 1.0 / hops;
	while (t < 1.0) {
		oneLessT = 1.0 - t;
		x = (oneLessT * txFrom) + (t * txTo);
		y = (oneLessT * tyFrom) + (t * tyTo);
		updateAlphasWPForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountWPAtXy(x, y);
		}
		updateContourForXy(x, y);
		t += increment;
	}
	updateAlphasWPForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountWPAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_quadraticBezierFromX:y:toX:y:controlX:y: */
static sqInt
pvt_quadraticBezierFromXytoXycontrolXy(float xFrom, float yFrom, float xTo, float yTo, float xControl, float yControl)
{
	float correction;
	float dx;
	float dx2;
	float dy;
	float dy2;
	float f1;
	float f2;
	float f3;
	float increment;
	float length;
	float oneLessT;
	float t;
	float t0;
	float txControl;
	float txFrom;
	float txTo;
	float tyControl;
	float tyFrom;
	float tyTo;
	float x;
	float x0;
	float xMaxEnd;
	float xMinEnd;
	float y;
	float y0;
	float yMaxEnd;
	float yMinEnd;


	/* If control point is bogus, just draw a line */
	if ((xControl == xTo)
	 && (yControl == yTo)) {
		return pvt_lineFromXytoXy(xFrom, yFrom, xTo, yTo);
	}
	if ((xControl == xFrom)
	 && (yControl == yFrom)) {
		return pvt_lineFromXytoXy(xFrom, yFrom, xTo, yTo);
	}
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	txControl = ((xControl * txA11) + (yControl * txA12)) + txA13;
	tyControl = ((xControl * txA21) + (yControl * txA22)) + txA23;
	dx = fabsf(txTo - txFrom);
	dx2 = fabsf(txControl - txFrom);
	dy = fabsf(tyTo - tyFrom);
	dy2 = fabsf(tyControl - tyFrom);

	/* If almost a vertical line, just draw a line. (Ignoring control point) */
	if ((dx < 1.0)
	 && (dx2 < 1.0)) {
		return pvt_lineFromXytoXy(xFrom, yFrom, xTo, yTo);
	}

	/* If almost an horizontal line, just draw a line. (Ignoring control point) */
	if ((dy < 1.0)
	 && (dy2 < 1.0)) {
		return pvt_lineFromXytoXy(xFrom, yFrom, xTo, yTo);
	}

	/* This computed span of the Bezier curve is a bit pessimistic (larger than strict bounds), but safe. */
	xMinEnd = ((txFrom < txTo) ? txFrom : txTo);
	xMaxEnd = ((txFrom < txTo) ? txTo : txFrom);
	yMinEnd = ((tyFrom < tyTo) ? tyFrom : tyTo);
	yMaxEnd = ((tyFrom < tyTo) ? tyTo : tyFrom);
	spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + txControl) / 2.0)) ? xMinEnd : ((xMinEnd + txControl) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + txControl) / 2.0)) ? xMinEnd : ((xMinEnd + txControl) / 2.0))));
	spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + txControl) / 2.0)) ? ((xMaxEnd + txControl) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + txControl) / 2.0)) ? ((xMaxEnd + txControl) / 2.0) : xMaxEnd)) : spanRight);
	spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + tyControl) / 2.0)) ? yMinEnd : ((yMinEnd + tyControl) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + tyControl) / 2.0)) ? yMinEnd : ((yMinEnd + tyControl) / 2.0))));
	spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + tyControl) / 2.0)) ? ((yMaxEnd + tyControl) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + tyControl) / 2.0)) ? ((yMaxEnd + tyControl) / 2.0) : yMaxEnd)) : spanBottom);

	/* Case t = 0.0 */
	x = txFrom;
	y = tyFrom;
	updateAlphasForXy(x, y);
	if (!(fillA == 0.0)) {
		updateEdgeCountAtXy(x, y);
	}
	updateContourForXy(x, y);

	/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
	increment = (((0.5 / (((dx < dy) ? dy : dx))) < 0.5) ? (0.5 / (((dx < dy) ? dy : dx))) : 0.5);
	t = 0.0;
	while (1) {
		t0 = t;
		x0 = x;
		y0 = y;

		/* Compute next point */
		t = t0 + increment;
		oneLessT = 1.0 - t;
		f1 = oneLessT * oneLessT;
		f2 = (2.0 * oneLessT) * t;
		f3 = t * t;
		x = ((f1 * txFrom) + (f2 * txControl)) + (f3 * txTo);
		y = ((f1 * tyFrom) + (f2 * tyControl)) + (f3 * tyTo);

		/* Now adjust the increment to aim at the required hop length, and recompute next point. */
		dx = x - x0;
		dy = y - y0;
		length = sqrt((dx * dx) + (dy * dy));

		/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
		correction = hop / (((length < 0.1) ? 0.1 : length));
		do {
			increment = increment * correction;
			t = t0 + increment;
			oneLessT = 1.0 - t;
			f1 = oneLessT * oneLessT;
			f2 = (2.0 * oneLessT) * t;
			f3 = t * t;
			x = ((f1 * txFrom) + (f2 * txControl)) + (f3 * txTo);
			y = ((f1 * tyFrom) + (f2 * tyControl)) + (f3 * tyTo);
			dx = x - x0;
			dy = y - y0;
			length = sqrt((dx * dx) + (dy * dy));

			/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
			correction = hop / (((length < 0.1) ? 0.1 : length));
		} while(correction < 0.99);
		if (!(t < 1.0)) break;
		updateAlphasForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountAtXy(x, y);
		}
		updateContourForXy(x, y);
	}

	/* Case t= 1.0 */
	updateAlphasForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#pvt_quadraticBezierWPFromX:y:toX:y:controlX:y: */
static sqInt
pvt_quadraticBezierWPFromXytoXycontrolXy(float xFrom, float yFrom, float xTo, float yTo, float xControl, float yControl)
{
	float correction;
	float dx;
	float dx2;
	float dy;
	float dy2;
	float f1;
	float f2;
	float f3;
	float increment;
	float length;
	float oneLessT;
	float t;
	float t0;
	float txControl;
	float txFrom;
	float txTo;
	float tyControl;
	float tyFrom;
	float tyTo;
	float x;
	float x0;
	float xMaxEnd;
	float xMinEnd;
	float y;
	float y0;
	float yMaxEnd;
	float yMinEnd;


	/* If control point is bogus, just draw a line */
	if ((xControl == xTo)
	 && (yControl == yTo)) {
		return pvt_lineWPFromXytoXy(xFrom, yFrom, xTo, yTo);
	}
	if ((xControl == xFrom)
	 && (yControl == yFrom)) {
		return pvt_lineWPFromXytoXy(xFrom, yFrom, xTo, yTo);
	}
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
	tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
	txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
	tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
	txControl = ((xControl * txA11) + (yControl * txA12)) + txA13;
	tyControl = ((xControl * txA21) + (yControl * txA22)) + txA23;
	dx = fabsf(txTo - txFrom);
	dx2 = fabsf(txControl - txFrom);
	dy = fabsf(tyTo - tyFrom);
	dy2 = fabsf(tyControl - tyFrom);

	/* If almost a vertical line, just draw a line. (Ignoring control point) */
	if ((dx < 1.0)
	 && (dx2 < 1.0)) {
		return pvt_lineWPFromXytoXy(xFrom, yFrom, xTo, yTo);
	}

	/* If almost an horizontal line, just draw a line. (Ignoring control point) */
	if ((dy < 1.0)
	 && (dy2 < 1.0)) {
		return pvt_lineWPFromXytoXy(xFrom, yFrom, xTo, yTo);
	}

	/* This computed span of the Bezier curve is a bit pessimistic (larger than strict bounds), but safe. */
	xMinEnd = ((txFrom < txTo) ? txFrom : txTo);
	xMaxEnd = ((txFrom < txTo) ? txTo : txFrom);
	yMinEnd = ((tyFrom < tyTo) ? tyFrom : tyTo);
	yMaxEnd = ((tyFrom < tyTo) ? tyTo : tyFrom);
	spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + txControl) / 2.0)) ? xMinEnd : ((xMinEnd + txControl) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + txControl) / 2.0)) ? xMinEnd : ((xMinEnd + txControl) / 2.0))));
	spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + txControl) / 2.0)) ? ((xMaxEnd + txControl) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + txControl) / 2.0)) ? ((xMaxEnd + txControl) / 2.0) : xMaxEnd)) : spanRight);
	spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + tyControl) / 2.0)) ? yMinEnd : ((yMinEnd + tyControl) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + tyControl) / 2.0)) ? yMinEnd : ((yMinEnd + tyControl) / 2.0))));
	spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + tyControl) / 2.0)) ? ((yMaxEnd + tyControl) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + tyControl) / 2.0)) ? ((yMaxEnd + tyControl) / 2.0) : yMaxEnd)) : spanBottom);

	/* Case t = 0.0 */
	x = txFrom;
	y = tyFrom;
	updateAlphasWPForXy(x, y);
	if (!(fillA == 0.0)) {
		updateEdgeCountWPAtXy(x, y);
	}
	updateContourForXy(x, y);

	/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
	increment = (((0.5 / (((dx < dy) ? dy : dx))) < 0.5) ? (0.5 / (((dx < dy) ? dy : dx))) : 0.5);
	t = 0.0;
	while (1) {
		t0 = t;
		x0 = x;
		y0 = y;

		/* Compute next point */
		t = t0 + increment;
		oneLessT = 1.0 - t;
		f1 = oneLessT * oneLessT;
		f2 = (2.0 * oneLessT) * t;
		f3 = t * t;
		x = ((f1 * txFrom) + (f2 * txControl)) + (f3 * txTo);
		y = ((f1 * tyFrom) + (f2 * tyControl)) + (f3 * tyTo);

		/* Now adjust the increment to aim at the required hop length, and recompute next point. */
		dx = x - x0;
		dy = y - y0;
		length = sqrt((dx * dx) + (dy * dy));

		/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
		correction = hop / (((length < 0.1) ? 0.1 : length));
		do {
			increment = increment * correction;
			t = t0 + increment;
			oneLessT = 1.0 - t;
			f1 = oneLessT * oneLessT;
			f2 = (2.0 * oneLessT) * t;
			f3 = t * t;
			x = ((f1 * txFrom) + (f2 * txControl)) + (f3 * txTo);
			y = ((f1 * tyFrom) + (f2 * tyControl)) + (f3 * tyTo);
			dx = x - x0;
			dy = y - y0;
			length = sqrt((dx * dx) + (dy * dy));

			/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
			correction = hop / (((length < 0.1) ? 0.1 : length));
		} while(correction < 0.99);
		if (!(t < 1.0)) break;
		updateAlphasWPForXy(x, y);
		if (!(fillA == 0.0)) {
			updateEdgeCountWPAtXy(x, y);
		}
		updateContourForXy(x, y);
	}

	/* Case t= 1.0 */
	updateAlphasWPForXy(txTo, tyTo);
	if (!(fillA == 0.0)) {
		updateEdgeCountWPAtXy(txTo, tyTo);
	}
	updateContourForXy(txTo, tyTo);
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#updateContourForX:y: */
static sqInt
updateContourForXy(float x, float y)
{
	sqInt thisYRounded;

	thisYRounded = ((sqInt)(y + 0.5));
	if (((thisYRounded >= 0) && (thisYRounded <= (targetHeight - 1)))) {
		if (!(thisYRounded == prevYRounded)) {
			if (!(prevYRounded == 0x7FFFFFFF)) {
				contour[prevYRounded * 2] = leftAtThisY;
				contour[(prevYRounded * 2) + 1] = rightAtThisY;
			}
			leftAtThisY = contour[thisYRounded * 2];
			rightAtThisY = contour[(thisYRounded * 2) + 1];
			prevYRounded = thisYRounded;
		}
		leftAtThisY = ((leftAtThisY < x) ? leftAtThisY : x);
		rightAtThisY = ((rightAtThisY < x) ? x : rightAtThisY);
	}
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#updateEdgeCountAtX:y: */
static sqInt
updateEdgeCountAtXy(float x, float y)
{
	sqInt affectedBitsIndex;
	sqInt affectedBitsIndex2;
	uint32_t blueCount;
	uint32_t blueIncrement;
	sqInt blueOffset;
	sqInt bluePixelIndex;
	uint32_t countWord;
	uint32_t greenCount;
	uint32_t greenIncrement;
	sqInt greenOffset;
	sqInt greenPixelIndex;
	sqInt pixelIndexBase;
	sqInt pixelY;
	uint32_t redCount;
	uint32_t redIncrement;
	sqInt redOffset;
	sqInt redPixelIndex;
	unsigned int rest;
	sqInt thisYTruncated;

	/* truncated, both in C and Smalltalk */
	thisYTruncated = ((sqInt)y);
	if (thisYTruncated == prevYTruncated) {
		return 0;
	}
	if (!(((thisYTruncated >= (clipTop - 1)) && (thisYTruncated <= clipBottom)))) {
		return 0;
	}
	if (prevYTruncated == 0x7FFFFFFF) {
		prevYTruncated = thisYTruncated;
		return 0;
	}
	if (thisYTruncated > prevYTruncated) {
		pixelY = thisYTruncated;
		redIncrement = 0x10000;
		greenIncrement = 0x100;
		blueIncrement = 1;
	}
	else {
		pixelY = prevYTruncated;
		redIncrement = 0xFF0000;
		greenIncrement = 0xFF00;
		blueIncrement = 0xFF;
	}
	prevYTruncated = thisYTruncated;

	/* All edge count at the left of the clipRect are added there (at the left of the clipRect).
	   The effect is the same, and we need to clean up less stuff afterwards.
	   More important, it avoids trying to acess pixels outside our form, i.e. invalid array acesses. */
	pixelIndexBase = pixelY * targetWidth;

	/* take the next red subpixel center to the right of x */
	redOffset = (((((sqInt)((x + subPixelDelta) + 1))) < clipLeft) ? clipLeft : (((sqInt)((x + subPixelDelta) + 1))));

	/* take the next green subpixel center to the right of x */
	greenOffset = (((((sqInt)(x + 1))) < clipLeft) ? clipLeft : (((sqInt)(x + 1))));

	/* take the next blue subpixel center to the right of x */
	blueOffset = (((((sqInt)((x - subPixelDelta) + 1))) < clipLeft) ? clipLeft : (((sqInt)((x - subPixelDelta) + 1))));
	redPixelIndex = pixelIndexBase + redOffset;
	greenPixelIndex = pixelIndexBase + greenOffset;
	bluePixelIndex = pixelIndexBase + blueOffset;

	/* Three possible cases here: RGB in one word (pixel); RG in one, and G in another; R in one, GB in another */
	if (redPixelIndex == bluePixelIndex) {
		/* First case: RGB in the same word */
		if (redOffset <= clipRight) {
			countWord = edgeCounts[redPixelIndex];
			redCount = (countWord + redIncrement) & 0xFF0000;
			greenCount = (countWord + greenIncrement) & 0xFF00;
			blueCount = (countWord + blueIncrement) & 0xFF;
			countWord = (redCount | greenCount) | blueCount;
			edgeCounts[redPixelIndex] = countWord;
			affectedBitsIndex = ((usqInt)(redPixelIndex)) >> 4;
			if (!((affectedBits[affectedBitsIndex]) == 1)) {
				affectedBits[affectedBitsIndex] = 1;
			}
		}
	}
	else {
		if (redPixelIndex == greenPixelIndex) {
			/* Second case: RG in one word, B in previous */
			if (redOffset <= clipRight) {
				countWord = edgeCounts[redPixelIndex];
				redCount = (countWord + redIncrement) & 0xFF0000;
				greenCount = (countWord + greenIncrement) & 0xFF00;
				rest = countWord & 0xFF;
				countWord = (redCount | greenCount) | rest;
				edgeCounts[redPixelIndex] = countWord;
			}
			if (blueOffset <= clipRight) {
				countWord = edgeCounts[bluePixelIndex];
				rest = countWord & 0xFFFF00;
				blueCount = (countWord + blueIncrement) & 0xFF;
				countWord = rest | blueCount;
				edgeCounts[bluePixelIndex] = countWord;
			}
		}
		else {
			/* Third case: R in one word, GB in the previous */
			if (redOffset <= clipRight) {
				countWord = edgeCounts[redPixelIndex];
				redCount = (countWord + redIncrement) & 0xFF0000;
				rest = countWord & 0xFFFF;
				countWord = redCount | rest;
				edgeCounts[redPixelIndex] = countWord;
			}
			if (blueOffset <= clipRight) {
				countWord = edgeCounts[bluePixelIndex];
				rest = countWord & 0xFF0000;
				greenCount = (countWord + greenIncrement) & 0xFF00;
				blueCount = (countWord + blueIncrement) & 0xFF;
				countWord = (rest | greenCount) | blueCount;
				edgeCounts[bluePixelIndex] = countWord;
			}
		}
		affectedBitsIndex = ((usqInt)(redPixelIndex)) >> 4;
		if (!((affectedBits[affectedBitsIndex]) == 1)) {
			affectedBits[affectedBitsIndex] = 1;
		}
		affectedBitsIndex2 = ((usqInt)(bluePixelIndex)) >> 4;
		if (!(affectedBitsIndex2 == affectedBitsIndex)) {
			if (!((affectedBits[affectedBitsIndex2]) == 1)) {
				affectedBits[affectedBitsIndex2] = 1;
			}
		}
	}
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#updateEdgeCountWPAtX:y: */
static sqInt
updateEdgeCountWPAtXy(float x, float y)
{
	sqInt affectedBitsIndex;
	uint8_t count;
	uint8_t increment;
	sqInt pixelIndex;
	sqInt pixelOffset;
	sqInt pixelY;
	sqInt thisYTruncated;

	/* truncated, both in C and Smalltalk */
	thisYTruncated = ((sqInt)y);
	if (thisYTruncated == prevYTruncated) {
		return 0;
	}
	if (!(((thisYTruncated >= (clipTop - 1)) && (thisYTruncated <= clipBottom)))) {
		return 0;
	}
	if (prevYTruncated == 0x7FFFFFFF) {
		prevYTruncated = thisYTruncated;
		return 0;
	}
	if (thisYTruncated > prevYTruncated) {
		pixelY = thisYTruncated;
		increment = 1;
	}
	else {
		pixelY = prevYTruncated;
		increment = 0xFF;
	}
	prevYTruncated = thisYTruncated;

	/* All edge count at the left of the clipRect are added there (at the left of the clipRect).
	   The effect is the same, and we need to clean up less stuff afterwards.
	   More important, it avoids trying to acess pixels outside our form, i.e. invalid array acesses. */

	/* take the next pixel center to the right of x */
	pixelOffset = (((((sqInt)(x + 1))) < clipLeft) ? clipLeft : (((sqInt)(x + 1))));
	if (pixelOffset <= clipRight) {
		pixelIndex = (pixelY * targetWidth) + pixelOffset;
		count = edgeCountsWP[pixelIndex];
		count += increment;
		edgeCountsWP[pixelIndex] = count;
		affectedBitsIndex = ((usqInt)(pixelIndex)) >> 4;
		if (!((affectedBits[affectedBitsIndex]) == 1)) {
			affectedBits[affectedBitsIndex] = 1;
		}
	}
	return 0;
}
