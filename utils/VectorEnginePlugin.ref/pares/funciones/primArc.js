/* VectorEnginePlugin>>#arcCenterX:centerY:radiusX:radiusY:start:sweep:rotationCos:rotationSin: */
primArc = function(argCount) {
    var angle;
    var centerX;
    var centerY;
    var d;
    var h;
    var hops;
    var radiusPointX;
    var radiusPointY;
    var scale;
    var startAngle;
    var sweepAngle;
    var tcx;
    var tcy;
    var trx;
    var try_;   // "try" in the C; renamed, reserved word in JS
    var tthetaCos;
    var tthetaSin;
    var x;
    var xp;
    var y;
    var yp;

    if (!(isFloatObject(stackValue(7)) && isFloatObject(stackValue(6))
        && isFloatObject(stackValue(5)) && isFloatObject(stackValue(4))
        && isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
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
    scale = Math.sqrt(((txA11 * txA11)) + ((txA21 * txA21)));
    trx = radiusPointX * scale;
    try_ = radiusPointY * scale;
    hops = (Math.trunc(((((trx < try_) ? try_ : trx)) * (Math.abs(sweepAngle))) / hop)) + 2;
    d = hops;
    for (h = 0; h <= hops; h += 1) {
        angle = ((h / d) * sweepAngle) + startAngle;
        xp = (Math.cos(angle)) * trx;
        yp = (Math.sin(angle)) * try_;
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
    if (!failed()) pop(8);
    return !failed();
};
