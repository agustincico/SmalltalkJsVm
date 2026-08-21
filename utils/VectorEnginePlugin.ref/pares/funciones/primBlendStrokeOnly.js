/* VectorEnginePlugin>>#blendStrokeOnlyLeft:top:right:bottom: */
primBlendStrokeOnly = function(argCount) {
    var affectedBitsIndex, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var idx, l, lastSegmentIndex, mustResetColor, opaqueStrokeColorWord;
    var pixelIndex, r, realOpaqueStrokeColorWord, realStrokeAlpha;
    var segmentLength, strokeAntiAliasAlphasWord, t, toDoLimit;

    alphasOrEdgeCountsInThisSegment = 0;
    realOpaqueStrokeColorWord = 0;
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
    opaqueStrokeColorWord = 0;
    if (targetAssumedOpaque) {
        if (strokeA === 1.0) {
            auxR = (Math.trunc(strokeR + 0.5) << 16) >>> 0;
            auxG = (Math.trunc(strokeG + 0.5) << 8) >>> 0;
            auxB = Math.trunc(strokeB + 0.5);
            opaqueStrokeColorWord = (((0xFF000000 | auxR) | auxG) | auxB) >>> 0;
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
            if (alphasOrEdgeCountsInThisSegment) {
                aux1 = (r - displayX) + 1;
                toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
                for (idx = 1; idx <= toDoLimit; idx += 1) {
                    strokeAntiAliasAlphasWord = alphaMask[pixelIndex];
                    if (strokeAntiAliasAlphasWord) {
                        alphaMask[pixelIndex] = 0;
                        if ((displayX >= clippingSpecL)
                         && (displayX <= clippingSpecR)) {
                            if ((displayX === antiAliasedClippedLeftPixel)
                             || (displayX === antiAliasedClippedRightPixel)) {
                                realStrokeAlpha = strokeA;
                                strokeA = strokeA * 0.25;
                                realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                                opaqueStrokeColorWord = 0;
                                mustResetColor = 1;
                            }
                            else {
                                if (((displayX - 1) === antiAliasedClippedLeftPixel)
                                 || ((displayX + 1) === antiAliasedClippedRightPixel)) {
                                    realStrokeAlpha = strokeA;
                                    strokeA = strokeA * 0.75;
                                    realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                                    opaqueStrokeColorWord = 0;
                                    mustResetColor = 1;
                                }
                            }
                            if ((opaqueStrokeColorWord !== 0)
                             && (strokeAntiAliasAlphasWord === 0x7F7F7F)) {
                                /* Fully inside the stroke, far from anti aliasing. Color is opaque. Target is too. Just overwrite with stroke color. */
                                targetBits[pixelIndex] = opaqueStrokeColorWord;
                                morphIds[pixelIndex] = currentMorphId;
                            }
                            else {
                                /* At least one subpixel in the anti aliasing area of the stroke, or color is translucent, or target translucency is desired. */
                                blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, strokeAntiAliasAlphasWord);
                            }
                        }
                        if (mustResetColor) {
                            strokeA = realStrokeAlpha;
                            opaqueStrokeColorWord = realOpaqueStrokeColorWord;
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
