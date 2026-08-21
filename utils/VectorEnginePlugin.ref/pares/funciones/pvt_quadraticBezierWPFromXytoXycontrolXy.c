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
