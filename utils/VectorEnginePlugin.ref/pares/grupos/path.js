/* VectorEnginePlugin>>#pathSequence:size: */
primPathSequence = function(argCount) {
    var aFloat32Array;
    var commandType;
    var control1X;
    var control1Y;
    var control2X;
    var control2Y;
    var endX;
    var endY;
    var i;
    var size;
    var startX;
    var startY;

    if (!((isWordsOrBytes(stackValue(1)))
         && (isIntegerObject((size = stackValue(0)))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    aFloat32Array = float32Of(stackValue(1));
    size = integerValueOf(size);
    i = 0;
    while (i < size) {
        commandType = Math.trunc(aFloat32Array[i]);
        i += 1;
        switch (commandType) {
        case 0:
            if (!((i + 1) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            startX = aFloat32Array[i];
            i += 1;
            startY = aFloat32Array[i];
            i += 1;

            /* begin initializeTrajectoryFragment */
            prevYTruncated = 0x7FFFFFFF;
            break;
        case 1:
            if (!((i + 1) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            pvt_lineFromXytoXy(startX, startY, endX, endY);
            startX = endX;
            startY = endY;
            break;
        case 2:
            if (!((i + 3) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            control1X = aFloat32Array[i];
            i += 1;
            control1Y = aFloat32Array[i];
            i += 1;
            pvt_quadraticBezierFromXytoXycontrolXy(startX, startY, endX, endY, control1X, control1Y);
            startX = endX;
            startY = endY;
            break;
        case 3:
            if (!((i + 5) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            control1X = aFloat32Array[i];
            i += 1;
            control1Y = aFloat32Array[i];
            i += 1;
            control2X = aFloat32Array[i];
            i += 1;
            control2Y = aFloat32Array[i];
            i += 1;
            pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy(startX, startY, endX, endY, control1X, control1Y, control2X, control2Y);
            startX = endX;
            startY = endY;
            break;
        default:
            if (!failed()) pop(2);
            return !failed();
        }
    }
    if (!failed()) pop(2);
    return !failed();
};

/* VectorEnginePlugin>>#pathSequenceWP:size: */
primPathSequenceWP = function(argCount) {
    var aFloat32Array;
    var commandType;
    var control1X;
    var control1Y;
    var control2X;
    var control2Y;
    var endX;
    var endY;
    var i;
    var size;
    var startX;
    var startY;

    if (!((isWordsOrBytes(stackValue(1)))
         && (isIntegerObject((size = stackValue(0)))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    aFloat32Array = float32Of(stackValue(1));
    size = integerValueOf(size);
    i = 0;
    while (i < size) {
        commandType = Math.trunc(aFloat32Array[i]);
        i += 1;
        switch (commandType) {
        case 0:
            if (!((i + 1) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            startX = aFloat32Array[i];
            i += 1;
            startY = aFloat32Array[i];
            i += 1;

            /* begin initializeTrajectoryFragment */
            prevYTruncated = 0x7FFFFFFF;
            break;
        case 1:
            if (!((i + 1) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            pvt_lineWPFromXytoXy(startX, startY, endX, endY);
            startX = endX;
            startY = endY;
            break;
        case 2:
            if (!((i + 3) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            control1X = aFloat32Array[i];
            i += 1;
            control1Y = aFloat32Array[i];
            i += 1;
            pvt_quadraticBezierWPFromXytoXycontrolXy(startX, startY, endX, endY, control1X, control1Y);
            startX = endX;
            startY = endY;
            break;
        case 3:
            if (!((i + 5) < size)) {
                if (!failed()) pop(2);
                return !failed();
            }
            endX = aFloat32Array[i];
            i += 1;
            endY = aFloat32Array[i];
            i += 1;
            control1X = aFloat32Array[i];
            i += 1;
            control1Y = aFloat32Array[i];
            i += 1;
            control2X = aFloat32Array[i];
            i += 1;
            control2Y = aFloat32Array[i];
            i += 1;
            pvt_cubicBezierWPFromXytoXycontrol1Xycontrol2Xy(startX, startY, endX, endY, control1X, control1Y, control2X, control2Y);
            startX = endX;
            startY = endY;
            break;
        default:
            if (!failed()) pop(2);
            return !failed();
        }
    }
    if (!failed()) pop(2);
    return !failed();
};
