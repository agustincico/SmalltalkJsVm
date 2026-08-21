/* VectorEnginePlugin>>#pvt_quadraticBezierFromX:y:toX:y:controlX:y: */
pvt_quadraticBezierFromXytoXycontrolXy = function(xFrom, yFrom, xTo, yTo, xControl, yControl) {
    var correction;
    var dx;
    var dx2;
    var dy;
    var dy2;
    var f1;
    var f2;
    var f3;
    var increment;
    var length;
    var oneLessT;
    var t;
    var t0;
    var txControl;
    var txFrom;
    var txTo;
    var tyControl;
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
    dx = Math.abs(txTo - txFrom);
    dx2 = Math.abs(txControl - txFrom);
    dy = Math.abs(tyTo - tyFrom);
    dy2 = Math.abs(tyControl - tyFrom);

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
        length = Math.sqrt((dx * dx) + (dy * dy));

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
