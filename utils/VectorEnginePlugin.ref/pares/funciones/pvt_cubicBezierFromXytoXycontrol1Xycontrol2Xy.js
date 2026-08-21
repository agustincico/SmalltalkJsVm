/* VectorEnginePlugin>>#pvt_cubicBezierFromX:y:toX:y:control1X:y:control2X:y: */
pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy = function(xFrom, yFrom, xTo, yTo, xControl1, yControl1, xControl2, yControl2) {
    var correction;
    var dx;
    var dy;
    var f1;
    var f2;
    var f23;
    var f3;
    var f4;
    var increment;
    var length;
    var oneLessT;
    var t;
    var t0;
    var txControl1;
    var txControl2;
    var txFrom;
    var txTo;
    var tyControl1;
    var tyControl2;
    var tyFrom;
    var tyTo;
    var x;
    var x0;
    var xMaxEnd;
    var xMinEnd;
    var y;
    var y0;
    var yMaxEnd;
    var yMinEnd;

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
    dx = Math.abs(txTo - txFrom);
    dy = Math.abs(tyTo - tyFrom);

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
        length = Math.sqrt((dx * dx) + (dy * dy));

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
            length = Math.sqrt((dx * dx) + (dy * dy));

            /* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
            correction = hop / (((length < 0.1) ? 0.1 : length));
        } while (correction < 0.99);
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
};
