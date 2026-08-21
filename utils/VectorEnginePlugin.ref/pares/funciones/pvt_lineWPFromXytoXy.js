/* VectorEnginePlugin>>#pvt_lineWPFromX:y:toX:y: */
pvt_lineWPFromXytoXy = function(xFrom, yFrom, xTo, yTo) {
    var dx;
    var dy;
    var hops;
    var increment;
    var oneLessT;
    var t;
    var txFrom;
    var txTo;
    var tyFrom;
    var tyTo;
    var x;
    var y;

    trajectoryLength = 0.0;
    needsFullAlphaCircle = 1;
    txFrom = ((xFrom * txA11) + (yFrom * txA12)) + txA13;
    tyFrom = ((xFrom * txA21) + (yFrom * txA22)) + txA23;
    txTo = ((xTo * txA11) + (yTo * txA12)) + txA13;
    tyTo = ((xTo * txA21) + (yTo * txA22)) + txA23;
    dx = txTo - txFrom;
    dy = tyTo - tyFrom;
    dx = Math.abs(dx);
    dy = Math.abs(dy);
    hops = (Math.trunc((((dx < dy) ? dy : dx)) / hop)) + 1;
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
};
