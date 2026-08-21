/* VectorEnginePlugin>>#blendFillOnlyWPLeft:top:right:bottom: */
primBlendFillOnlyWP = function(argCount) {
    var affectedBitsIndex, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var edgesThisPixel, edgesUpToThisPixel;
    var idx, l, lastSegmentIndex, mustResetColor, opaqueFillColorWord;
    var pixelIndex, r, realFillAlpha, realOpaqueFillColorWord;
    var segmentLength, strokeAntiAliasAlphaBits, t, toDoLimit;

    alphasOrEdgeCountsInThisSegment = 0;
    realOpaqueFillColorWord = 0;
    if (!((isIntegerObject((l = stackValue(3))))
        && ((isIntegerObject((t = stackValue(2))))
        && ((isIntegerObject((r = stackValue(1))))
        && (isIntegerObject((b = stackValue(0)))))))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    l = integerValueOf(l);
    t = integerValueOf(t);
    r = integerValueOf(r);
    b = integerValueOf(b);
    clippingSpecL = 0;
    clippingSpecR = targetWidth - 1;

    /* targetWidth means effectively no AA for clipping */
    antiAliasedClippedLeftPixel = targetWidth;

    /* targetWidth means effectively no AA for clipping */
    antiAliasedClippedRightPixel = targetWidth;
    clippingSpecIndex = ((t * 2) + 1) - 1;
    mustResetColor = 0;
    opaqueFillColorWord = 0;
    if (targetAssumedOpaque) {
        if (fillA === 1.0) {
            auxR = (Math.trunc(fillR + 0.5) << 16) >>> 0;
            auxG = (Math.trunc(fillG + 0.5) << 8) >>> 0;
            auxB = Math.trunc(fillB + 0.5);
            opaqueFillColorWord = (((0xFF000000 | auxR) | auxG) | auxB) >>> 0;
        }
    }
    lastSegmentIndex = -1;
    for (displayY = t; displayY <= b; displayY += 1) {
        if (clippingSpec) {
            clippingSpecL = clippingSpec[clippingSpecIndex];
            clippingSpecR = clippingSpec[clippingSpecIndex + 1];
            antiAliasedClippedLeftPixel = (clippingSpecL >= l
                        ? clippingSpecL
                        : targetWidth);
            antiAliasedClippedRightPixel = (clippingSpecR <= r
                        ? clippingSpecR
                        : targetWidth);
        }
        edgesUpToThisPixel = 0;
        pixelIndex = (displayY * targetWidth) + l;
        displayX = l;
        while (displayX <= r) {
            affectedBitsIndex = pixelIndex >>> 4;
            if (!(lastSegmentIndex === affectedBitsIndex)) {
                alphasOrEdgeCountsInThisSegment = (affectedBits[affectedBitsIndex]) === 1;
                lastSegmentIndex = affectedBitsIndex;
                if (alphasOrEdgeCountsInThisSegment) {
                    affectedBits[affectedBitsIndex] = 0;
                }
            }
            segmentLength = ((affectedBitsIndex + 1) << 4) - pixelIndex;
            if (alphasOrEdgeCountsInThisSegment || (edgesUpToThisPixel !== 0)) {
                aux1 = (r - displayX) + 1;
                toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
                for (idx = 1; idx <= toDoLimit; idx += 1) {
                    strokeAntiAliasAlphaBits = 0;
                    if (alphasOrEdgeCountsInThisSegment) {
                        edgesThisPixel = edgeCountsWP[pixelIndex];
                        if (edgesThisPixel) {
                            edgeCountsWP[pixelIndex] = 0;
                            edgesUpToThisPixel = (edgesUpToThisPixel + edgesThisPixel) & 0xFF;
                        }
                        strokeAntiAliasAlphaBits = alphaMaskWP[pixelIndex];
                        if (strokeAntiAliasAlphaBits) {
                            alphaMaskWP[pixelIndex] = 0;
                        }
                    }
                    if ((displayX >= clippingSpecL)
                     && (displayX <= clippingSpecR)) {
                        if ((displayX === antiAliasedClippedLeftPixel)
                         || (displayX === antiAliasedClippedRightPixel)) {
                            realFillAlpha = fillA;
                            fillA = fillA * 0.25;
                            realOpaqueFillColorWord = opaqueFillColorWord;
                            opaqueFillColorWord = 0;
                            mustResetColor = 1;
                        }
                        else {
                            if (((displayX - 1) === antiAliasedClippedLeftPixel)
                             || ((displayX + 1) === antiAliasedClippedRightPixel)) {
                                realFillAlpha = fillA;
                                fillA = fillA * 0.75;
                                realOpaqueFillColorWord = opaqueFillColorWord;
                                opaqueFillColorWord = 0;
                                mustResetColor = 1;
                            }
                        }
                        if (edgesUpToThisPixel) {
                            /* Inside the shape */
                            if ((opaqueFillColorWord !== 0)
                             && (strokeAntiAliasAlphaBits === 0)) {
                                /* Optimize common case: opaque fill, inside fill area, no anti aliasing, no clipping at this point. */
                                targetBits[pixelIndex] = opaqueFillColorWord;
                                morphIds[pixelIndex] = currentMorphId;
                            }
                            else {
                                /* Inside the shape. Turn stroke anti aliasing into fill anti aliasing. */
                                blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F - strokeAntiAliasAlphaBits);
                            }
                        }
                        else {
                            /* Still in the anti aliasing area, but outside the shape, strictly speaking. */
                            if (strokeAntiAliasAlphaBits) {
                                blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits);
                            }
                        }
                        if (mustResetColor) {
                            fillA = realFillAlpha;
                            opaqueFillColorWord = realOpaqueFillColorWord;
                            mustResetColor = 0;
                        }
                    }
                    displayX += 1;
                    pixelIndex += 1;
                }
            }
            else {
                /* All alphas and edgeCounts are zero in this segment of length delta */
                displayX += segmentLength;
                pixelIndex += segmentLength;
            }
        }
        clippingSpecIndex += 2;
    }
    if (!failed()) pop(4);
    return !failed();
};
