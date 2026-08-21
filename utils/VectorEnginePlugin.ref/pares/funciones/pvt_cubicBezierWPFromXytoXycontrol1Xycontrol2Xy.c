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
