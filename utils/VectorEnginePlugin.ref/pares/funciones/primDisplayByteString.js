/* VectorEnginePlugin>>#displayByteString:from:to:atx:y:scalex:y:contourData:contourDataIndexes: */
function primDisplayByteString(argCount) {
    var aByteString;
    var advanceWidth;
    var aux1;
    var byte;
    var contourData;
    var contourDataIndexes;
    var contourStartX;
    var contourStartY;
    var controlX;
    var controlY;
    var correction;
    var destX;
    var destY;
    var dx;
    var dy;
    var endX;
    var endY;
    var f1;
    var f2;
    var f3;
    var i;
    var idx;
    var idx2;
    var increment;
    var index;
    var iSqInt;
    var length;
    var nextGlyphX;
    var nextGlyphY;
    var numBeziers;
    var numContours;
    var oneLessT;
    var startIndex;
    var startX;
    var startY;
    var stopIndex;
    var sx;
    var sy;
    var t;
    var t0;
    var ttX;
    var ttY;
    var x;
    var x0;
    var xMaxEnd;
    var xMinEnd;
    var y;
    var y0;
    var yMaxEnd;
    var yMinEnd;
    var _return_value;

    if (!(isBytes(stackValue(8))
        && isIntegerObject((startIndex = stackValue(7)))
        && isIntegerObject((stopIndex = stackValue(6)))
        && isFloatObject(stackValue(5))
        && isFloatObject(stackValue(4))
        && isFloatObject(stackValue(3))
        && isFloatObject(stackValue(2))
        && isWordsOrBytes(stackValue(1))
        && isWords(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    aByteString = bytesOf(stackValue(8));
    startIndex = integerValueOf(startIndex);
    stopIndex = integerValueOf(stopIndex);
    destX = stackFloatValue(5);
    destY = stackFloatValue(4);
    sx = stackFloatValue(3);
    sy = stackFloatValue(2);
    contourData = float32Of(stackValue(1));
    contourDataIndexes = int32Of(stackValue(0));

    /* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
    trajectoryLength = 0.0;
    needsFullAlphaCircle = 1;
    txA11 = txA11 * sx;
    txA12 = txA12 * sy;
    txA21 = txA21 * sx;
    txA22 = txA22 * sy;
    nextGlyphX = destX / sx;
    nextGlyphY = destY / sy;
    for (index = startIndex - 1; index < stopIndex; index += 1) {
        /* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
        byte = aByteString[index];
        i = contourDataIndexes[byte];
        if (i < 1) {
            i = 1;
        }
        iSqInt = i;
        iSqInt -= 1;
        advanceWidth = contourData[iSqInt];

        /* boundsLeft := contourData at: i+1.
           boundsRight := contourData at: i+2.
           boundsBottom := contourData at: i+3.
           boundsTop := contourData at: i+4. */
        iSqInt += 5;
        numContours = Math.trunc(contourData[iSqInt]);
        iSqInt += 1;
        for (idx = 1; idx <= numContours; idx += 1) {
            numBeziers = Math.trunc(contourData[iSqInt]);
            ttX = contourData[iSqInt + 1] + nextGlyphX;
            ttY = contourData[iSqInt + 2] + nextGlyphY;
            iSqInt += 3;
            contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
            contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

            /* begin initializeTrajectoryFragment */
            prevYTruncated = 0x7FFFFFFF;
            for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
                ttX = contourData[iSqInt];
                ttY = contourData[iSqInt + 1];
                endX = ((ttX * txA11) + (ttY * txA12)) + startX;
                endY = ((ttX * txA21) + (ttY * txA22)) + startY;
                ttX = contourData[iSqInt + 2];
                ttY = contourData[iSqInt + 3];
                controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
                controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
                iSqInt += 4;

                /* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
                xMinEnd = Math.trunc((startX < endX) ? startX : endX);
                xMaxEnd = Math.trunc((startX < endX) ? endX : startX);
                yMinEnd = Math.trunc((startY < endY) ? startY : endY);
                yMaxEnd = Math.trunc((startY < endY) ? endY : startY);
                spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
                spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
                spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
                spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

                /* Compute Quadratic Bezier Curve,
                   Case t = 0.0 */
                x = startX;
                y = startY;
                updateAlphasForXy(x, y);
                updateEdgeCountAtXy(x, y);

                /* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
                dx = Math.abs(endX - startX);
                dy = Math.abs(endY - startY);
                aux1 = ((dx < dy) ? dy : dx);
                aux1 = 0.5 / aux1;
                increment = ((aux1 < 0.5) ? aux1 : 0.5);
                t = 0.0;
                while (true) {
                    t0 = t;
                    x0 = x;
                    y0 = y;

                    /* Compute next point */
                    t = t0 + increment;
                    oneLessT = 1.0 - t;
                    f1 = oneLessT * oneLessT;
                    f2 = (2.0 * oneLessT) * t;
                    f3 = t * t;
                    x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
                    y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

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
                        x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
                        y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
                        dx = x - x0;
                        dy = y - y0;
                        length = Math.sqrt((dx * dx) + (dy * dy));

                        /* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
                        correction = hop / (((length < 0.1) ? 0.1 : length));
                    } while (correction < 0.99);
                    if (!(t < 1.0)) break;
                    updateAlphasForXy(x, y);
                    updateEdgeCountAtXy(x, y);
                }

                /* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
                   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
                startX = endX;
                startY = endY;
            }
            updateAlphasForXy(endX, endY);
            updateEdgeCountAtXy(endX, endY);

            /* Similar effect to ensureClosePath in #finishPath:,
               but assume the TrueType definition is essentially right, and there might only be a rounding error.
               So, don't draw a line, but just (possibly) correct edgeCounts. The possibility of rounding error is most likely zero.
               Anyway, this is cheap. */
            updateEdgeCountAtXy(contourStartX, contourStartY);
        }
        nextGlyphX += advanceWidth;
    }
    txA11 = txA11 / sx;
    txA12 = txA12 / sy;
    txA21 = txA21 / sx;
    txA22 = txA22 / sy;
    _return_value = floatObjectOf(nextGlyphX * sx);
    if (!failed()) methodReturnValue(_return_value);
    return !failed();
}
