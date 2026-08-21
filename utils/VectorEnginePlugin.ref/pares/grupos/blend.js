/* VectorEnginePlugin>>#blendFillOnlyAt:redIsInside:greenIsInside:blueIsInside:antiAliasAlphasWord: */
function blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(pixelIndex, isRedInside, isGreenInside, isBlueInside, strokeAntiAliasAlphasWord) {
    var alphaB, alphaBBits, alphaG, alphaGBits, alphaR, alphaRBits;
    var resultAlphaB, resultAlphaBits, resultAlphaG, resultAlphaR;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlphaB, unAlphaG, unAlphaR;

    /* In this method, antiAliasAlphas are not used to blend stroke, but fill. This means that in the inside of the shape, and away from the stroke, they must be 1.0 (not 0.0). */
    alphaRBits = strokeAntiAliasAlphasWord & 0x7F0000;
    alphaGBits = strokeAntiAliasAlphasWord & 0x7F00;
    alphaBBits = strokeAntiAliasAlphasWord & 0x7F;
    if (isRedInside) {
        alphaRBits = 0x7F0000 - alphaRBits;
    }
    if (isGreenInside) {
        alphaGBits = 0x7F00 - alphaGBits;
    }
    if (isBlueInside) {
        alphaBBits = 0x7F - alphaBBits;
    }
    alphaR = alphaRBits * (1.0 / (8.323072e6));
    alphaG = alphaGBits * (1.0 / (32512.0));
    alphaB = alphaBBits * (1.0 / 127.0);
    alphaR = alphaR * fillA;
    alphaG = alphaG * fillA;
    alphaB = alphaB * fillA;
    targetWord = targetBits[pixelIndex];
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlphaBits = targetAlphaBits;
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;

    /* These if are not really needed. just ignore them if we use simd instructions. */
    if (!(alphaR === 0.0)) {
        unAlphaR = 1.0 - alphaR;
        resultAlphaR = alphaR + (unAlphaR * targetAlpha);
        resultR = (alphaR * fillR) + ((unAlphaR * (resultRBits >>> 16)) * targetAlpha);
        resultRBits = (Math.trunc((resultR / resultAlphaR) + 0.5) << 16) >>> 0;
    }
    if (!(alphaG === 0.0)) {
        unAlphaG = 1.0 - alphaG;
        resultAlphaG = alphaG + (unAlphaG * targetAlpha);
        resultG = (alphaG * fillG) + ((unAlphaG * (resultGBits >>> 8)) * targetAlpha);
        resultGBits = (Math.trunc((resultG / resultAlphaG) + 0.5) << 8) >>> 0;
        resultAlphaBits = (Math.trunc((resultAlphaG * 255.0) + 0.5) << 24) >>> 0;
    }
    if (!(alphaB === 0.0)) {
        unAlphaB = 1.0 - alphaB;
        resultAlphaB = alphaB + (unAlphaB * targetAlpha);
        resultB = (alphaB * fillB) + ((unAlphaB * resultBBits) * targetAlpha);
        resultBBits = Math.trunc((resultB / resultAlphaB) + 0.5);
    }
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}

/* VectorEnginePlugin>>#blendFillOnlyWPAt:antiAliasAlphaByte: */
function blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, antiAliasAlphaBits) {
    var alpha;
    var resultAlpha, resultAlphaBits;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlpha;

    alpha = antiAliasAlphaBits * (1.0 / 127.0);
    alpha = alpha * fillA;
    unAlpha = 1.0 - alpha;
    targetWord = targetBits[pixelIndex];
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlpha = alpha + (unAlpha * targetAlpha);
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;
    resultR = (alpha * fillR) + ((unAlpha * (resultRBits >>> 16)) * targetAlpha);
    resultG = (alpha * fillG) + ((unAlpha * (resultGBits >>> 8)) * targetAlpha);
    resultB = (alpha * fillB) + ((unAlpha * resultBBits) * targetAlpha);
    resultAlphaBits = (Math.trunc((resultAlpha * 0xFF) + 0.5) << 24) >>> 0;
    resultRBits = (Math.trunc((resultR / resultAlpha) + 0.5) << 16) >>> 0;
    resultGBits = (Math.trunc((resultG / resultAlpha) + 0.5) << 8) >>> 0;
    resultBBits = Math.trunc((resultB / resultAlpha) + 0.5);
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}

/* VectorEnginePlugin>>#blendStrokeOnlyAt:antiAliasAlphasWord: */
function blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, strokeAntiAliasAlphasWord) {
    var alphaB, alphaBBits, alphaG, alphaGBits, alphaR, alphaRBits;
    var resultAlphaB, resultAlphaBits, resultAlphaG, resultAlphaR;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlphaB, unAlphaG, unAlphaR;

    alphaRBits = strokeAntiAliasAlphasWord & 0x7F0000;
    alphaGBits = strokeAntiAliasAlphasWord & 0x7F00;
    alphaBBits = strokeAntiAliasAlphasWord & 0x7F;
    alphaR = alphaRBits * (1.0 / (8.323072e6));
    alphaG = alphaGBits * (1.0 / (32512.0));
    alphaB = alphaBBits * (1.0 / 127.0);
    alphaR = alphaR * strokeA;
    alphaG = alphaG * strokeA;
    alphaB = alphaB * strokeA;
    targetWord = targetBits[pixelIndex];
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlphaBits = targetAlphaBits;
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;

    /* These if are not really needed. just ignore them if we use simd instructions. */
    if (!(alphaR === 0.0)) {
        unAlphaR = 1.0 - alphaR;
        resultAlphaR = alphaR + (unAlphaR * targetAlpha);
        resultR = (alphaR * strokeR) + ((unAlphaR * (resultRBits >>> 16)) * targetAlpha);
        resultRBits = (Math.trunc((resultR / resultAlphaR) + 0.5) << 16) >>> 0;
    }
    if (!(alphaG === 0.0)) {
        unAlphaG = 1.0 - alphaG;
        resultAlphaG = alphaG + (unAlphaG * targetAlpha);
        resultG = (alphaG * strokeG) + ((unAlphaG * (resultGBits >>> 8)) * targetAlpha);
        resultGBits = (Math.trunc((resultG / resultAlphaG) + 0.5) << 8) >>> 0;
        resultAlphaBits = (Math.trunc((resultAlphaG * 255.0) + 0.5) << 24) >>> 0;
    }
    if (!(alphaB === 0.0)) {
        unAlphaB = 1.0 - alphaB;
        resultAlphaB = alphaB + (unAlphaB * targetAlpha);
        resultB = (alphaB * strokeB) + ((unAlphaB * resultBBits) * targetAlpha);
        resultBBits = Math.trunc((resultB / resultAlphaB) + 0.5);
    }
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}

/* VectorEnginePlugin>>#blendStrokeOnlyWPAt:antiAliasAlphaByte: */
function blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits) {
    var alpha;
    var resultAlpha, resultAlphaBits;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlpha;

    alpha = strokeAntiAliasAlphaBits * (1.0 / 127.0);
    alpha = alpha * strokeA;
    unAlpha = 1.0 - alpha;
    targetWord = targetBits[pixelIndex];
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlpha = alpha + (unAlpha * targetAlpha);
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;
    resultR = (alpha * strokeR) + ((unAlpha * (resultRBits >>> 16)) * targetAlpha);
    resultG = (alpha * strokeG) + ((unAlpha * (resultGBits >>> 8)) * targetAlpha);
    resultB = (alpha * strokeB) + ((unAlpha * resultBBits) * targetAlpha);
    resultAlphaBits = (Math.trunc((resultAlpha * 0xFF) + 0.5) << 24) >>> 0;
    resultRBits = (Math.trunc((resultR / resultAlpha) + 0.5) << 16) >>> 0;
    resultGBits = (Math.trunc((resultG / resultAlpha) + 0.5) << 8) >>> 0;
    resultBBits = Math.trunc((resultB / resultAlpha) + 0.5);
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}

/* VectorEnginePlugin>>#blendFillOnlyLeft:top:right:bottom: */
primBlendFillOnly = function(argCount) {
    var affectedBitsIndex, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var edgesThisPixelB, edgesThisPixelG, edgesThisPixelR, edgesThisPixelWord;
    var edgesUpToThisPixelB, edgesUpToThisPixelG, edgesUpToThisPixelR;
    var idx, isBlueInside, isGreenInside, isRedInside;
    var l, lastSegmentIndex, mustResetColor, opaqueFillColorWord;
    var pixelIndex, r, realFillAlpha, realOpaqueFillColorWord;
    var segmentLength, strokeAntiAliasAlphasWord, t, toDoLimit;

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
        edgesUpToThisPixelR = 0;
        edgesUpToThisPixelG = 0;
        edgesUpToThisPixelB = 0;
        isRedInside = (isGreenInside = (isBlueInside = 0));
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
            if (alphasOrEdgeCountsInThisSegment || isGreenInside) {
                aux1 = (r - displayX) + 1;
                toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
                for (idx = 1; idx <= toDoLimit; idx += 1) {
                    strokeAntiAliasAlphasWord = 0;
                    if (alphasOrEdgeCountsInThisSegment) {
                        edgesThisPixelWord = edgeCounts[pixelIndex];
                        if (edgesThisPixelWord) {
                            edgeCounts[pixelIndex] = 0;
                            edgesThisPixelR = (edgesThisPixelWord & 0xFF0000) >>> 16;
                            edgesThisPixelG = (edgesThisPixelWord & 0xFF00) >>> 8;
                            edgesThisPixelB = edgesThisPixelWord & 0xFF;
                            edgesUpToThisPixelR = (edgesUpToThisPixelR + edgesThisPixelR) & 0xFF;
                            edgesUpToThisPixelG = (edgesUpToThisPixelG + edgesThisPixelG) & 0xFF;
                            edgesUpToThisPixelB = (edgesUpToThisPixelB + edgesThisPixelB) & 0xFF;

                            /* In C, integers already behave like booleans */

                            isRedInside = edgesUpToThisPixelR;
                            isGreenInside = edgesUpToThisPixelG;
                            isBlueInside = edgesUpToThisPixelB;
                        }
                        strokeAntiAliasAlphasWord = alphaMask[pixelIndex];
                        if (strokeAntiAliasAlphasWord) {
                            alphaMask[pixelIndex] = 0;
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
                        if ((opaqueFillColorWord !== 0)
                         && ((strokeAntiAliasAlphasWord === 0)
                         && (isGreenInside))) {
                            /* Overwrite with fill color is ok and we are in the fill, far from anti aliasing
                               If no alpha, and isGreenInside is true, isRedInside and isBlueInside are also true */
                            targetBits[pixelIndex] = opaqueFillColorWord;
                            morphIds[pixelIndex] = currentMorphId;
                        }
                        else {
                            /* General case. (strokeAntiAliasAlphasWord = 0 and outside the shape means NOP) */
                            if ((strokeAntiAliasAlphasWord !== 0)
                             || (isGreenInside)) {
                                /* If no alpha, and isGreenInside is true, isRedInside and isBlueInside are also true
                                   If there is any alpha, isRedInside, isGreenInside, isBlueInside may be different. */
                                blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(pixelIndex, isRedInside, isGreenInside, isBlueInside, strokeAntiAliasAlphasWord);
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

/* VectorEnginePlugin>>#blendStrokeAndFillLeft:top:right:bottom: */
primBlendStrokeAndFill = function(argCount) {
    var affectedBitsIndex, alphaB, alphaG, alphaR, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var edgesThisPixelB, edgesThisPixelG, edgesThisPixelR, edgesThisPixelWord;
    var edgesUpToThisPixelB, edgesUpToThisPixelG, edgesUpToThisPixelR;
    var foreB, foreG, foreR;
    var idx, isBlueInside, isGreenInside, isRedInside;
    var l, lastSegmentIndex, mustResetColor;
    var opaqueFillColorWord, opaqueStrokeColorWord, pixelIndex, r;
    var realFillAlpha, realOpaqueFillColorWord, realOpaqueStrokeColorWord, realStrokeAlpha;
    var resultAlphaB, resultAlphaBits, resultAlphaG, resultAlphaR;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var segmentLength;
    var strokeAABlueAlpha, strokeAABlueAlphaBits;
    var strokeAAGreenAlpha, strokeAAGreenAlphaBits;
    var strokeAARedAlpha, strokeAARedAlphaBits;
    var strokeAntiAliasAlphasWord, t;
    var targetAlpha, targetAlphaBits, targetWord, toDoLimit;
    var unAlphaB, unAlphaG, unAlphaR;

    alphasOrEdgeCountsInThisSegment = 0;
    realOpaqueFillColorWord = 0;
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
    opaqueFillColorWord = 0;
    if (targetAssumedOpaque) {
        if ((strokeA * fillA) === 1.0) {
            auxR = (Math.trunc(strokeR + 0.5) << 16) >>> 0;
            auxG = (Math.trunc(strokeG + 0.5) << 8) >>> 0;
            auxB = Math.trunc(strokeB + 0.5);
            opaqueStrokeColorWord = (((0xFF000000 | auxR) | auxG) | auxB) >>> 0;
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
        edgesUpToThisPixelR = 0;
        edgesUpToThisPixelG = 0;
        edgesUpToThisPixelB = 0;
        isRedInside = (isGreenInside = (isBlueInside = 0));
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
            if (alphasOrEdgeCountsInThisSegment || isGreenInside) {
                aux1 = (r - displayX) + 1;
                toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
                for (idx = 1; idx <= toDoLimit; idx += 1) {
                    strokeAntiAliasAlphasWord = 0;
                    if (alphasOrEdgeCountsInThisSegment) {
                        edgesThisPixelWord = edgeCounts[pixelIndex];
                        if (edgesThisPixelWord) {
                            edgeCounts[pixelIndex] = 0;
                            edgesThisPixelR = (edgesThisPixelWord & 0xFF0000) >>> 16;
                            edgesThisPixelG = (edgesThisPixelWord & 0xFF00) >>> 8;
                            edgesThisPixelB = edgesThisPixelWord & 0xFF;
                            edgesUpToThisPixelR = (edgesUpToThisPixelR + edgesThisPixelR) & 0xFF;
                            edgesUpToThisPixelG = (edgesUpToThisPixelG + edgesThisPixelG) & 0xFF;
                            edgesUpToThisPixelB = (edgesUpToThisPixelB + edgesThisPixelB) & 0xFF;

                            /* In C, integers already behave like booleans */

                            isRedInside = edgesUpToThisPixelR;
                            isGreenInside = edgesUpToThisPixelG;
                            isBlueInside = edgesUpToThisPixelB;
                        }
                        strokeAntiAliasAlphasWord = alphaMask[pixelIndex];
                        if (strokeAntiAliasAlphasWord) {
                            alphaMask[pixelIndex] = 0;
                        }
                    }
                    if ((displayX >= clippingSpecL)
                     && (displayX <= clippingSpecR)) {
                        if ((displayX === antiAliasedClippedLeftPixel)
                         || (displayX === antiAliasedClippedRightPixel)) {
                            realStrokeAlpha = strokeA;
                            strokeA = strokeA * 0.25;
                            realFillAlpha = fillA;
                            fillA = fillA * 0.25;
                            realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                            opaqueStrokeColorWord = 0;
                            realOpaqueFillColorWord = opaqueFillColorWord;
                            opaqueFillColorWord = 0;
                            mustResetColor = 1;
                        }
                        else {
                            if (((displayX - 1) === antiAliasedClippedLeftPixel)
                             || ((displayX + 1) === antiAliasedClippedRightPixel)) {
                                realStrokeAlpha = strokeA;
                                strokeA = strokeA * 0.75;
                                realFillAlpha = fillA;
                                fillA = fillA * 0.75;
                                realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                                opaqueStrokeColorWord = 0;
                                realOpaqueFillColorWord = opaqueFillColorWord;
                                opaqueFillColorWord = 0;
                                mustResetColor = 1;
                            }
                        }
                        if (strokeAntiAliasAlphasWord) {
                            /* At least one subpixel in the stroke. */
                            if (strokeAntiAliasAlphasWord === 0x7F7F7F) {
                                /* Fully inside the stroke, far from anti aliasing. */
                                if (opaqueStrokeColorWord) {
                                    /* Stroke color is opaque. Target is too. Just overwrite with stroke color. */
                                    targetBits[pixelIndex] = opaqueStrokeColorWord;
                                    morphIds[pixelIndex] = currentMorphId;
                                }
                                else {
                                    /* Translucent color or target. Do proper blend of stroke over target. */
                                    blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, 0x7F7F7F);
                                }
                            }
                            else {
                                /* In an anti aliased part of the stroke. Either blend stroke over background, or pre-mix stroke and fill. */

                                /* begin blendStrokeAndFillAt:redIsInside:greenIsInside:blueIsInside:antiAliasAlphasWord: */
                                strokeAARedAlphaBits = strokeAntiAliasAlphasWord & 0x7F0000;
                                strokeAAGreenAlphaBits = strokeAntiAliasAlphasWord & 0x7F00;
                                strokeAABlueAlphaBits = strokeAntiAliasAlphasWord & 0x7F;
                                strokeAARedAlpha = strokeAARedAlphaBits * (1.0 / (8.323072e6));
                                strokeAAGreenAlpha = strokeAAGreenAlphaBits * (1.0 / (32512.0));
                                strokeAABlueAlpha = strokeAABlueAlphaBits * (1.0 / 127.0);
                                if (isRedInside) {
                                    /* Do gradient between stroke and fill. Blend the result over background */
                                    alphaR = (strokeAARedAlpha * strokeA) + ((1.0 - strokeAARedAlpha) * fillA);
                                    foreR = (strokeAARedAlpha * strokeR) + ((1.0 - strokeAARedAlpha) * fillR);
                                }
                                else {
                                    /* Blend stroke over background */
                                    alphaR = strokeAARedAlpha * strokeA;
                                    foreR = strokeR;
                                }
                                if (isGreenInside) {
                                    /* Do gradient between stroke and fill. Blend the result over background */
                                    alphaG = (strokeAAGreenAlpha * strokeA) + ((1.0 - strokeAAGreenAlpha) * fillA);
                                    foreG = (strokeAAGreenAlpha * strokeG) + ((1.0 - strokeAAGreenAlpha) * fillG);
                                }
                                else {
                                    /* Blend stroke over background */
                                    alphaG = strokeAAGreenAlpha * strokeA;
                                    foreG = strokeG;
                                }
                                if (isBlueInside) {
                                    /* Do gradient between stroke and fill. Blend the result over background */
                                    alphaB = (strokeAABlueAlpha * strokeA) + ((1.0 - strokeAABlueAlpha) * fillA);
                                    foreB = (strokeAABlueAlpha * strokeB) + ((1.0 - strokeAABlueAlpha) * fillB);
                                }
                                else {
                                    /* Blend stroke over background */
                                    alphaB = strokeAABlueAlpha * strokeA;
                                    foreB = strokeB;
                                }
                                targetWord = targetBits[pixelIndex];
                                targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
                                targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
                                resultAlphaBits = targetAlphaBits;
                                resultRBits = targetWord & 0xFF0000;
                                resultGBits = targetWord & 0xFF00;
                                resultBBits = targetWord & 0xFF;

                                /* These if are not really needed. just ignore them if we use simd instructions. */
                                if (!(alphaR === 0.0)) {
                                    unAlphaR = 1.0 - alphaR;
                                    resultAlphaR = alphaR + (unAlphaR * targetAlpha);
                                    resultR = (alphaR * foreR) + ((unAlphaR * (resultRBits >>> 16)) * targetAlpha);
                                    resultRBits = (Math.trunc((resultR / resultAlphaR) + 0.5) << 16) >>> 0;
                                }
                                if (!(alphaG === 0.0)) {
                                    unAlphaG = 1.0 - alphaG;
                                    resultAlphaG = alphaG + (unAlphaG * targetAlpha);
                                    resultG = (alphaG * foreG) + ((unAlphaG * (resultGBits >>> 8)) * targetAlpha);
                                    resultGBits = (Math.trunc((resultG / resultAlphaG) + 0.5) << 8) >>> 0;
                                    resultAlphaBits = (Math.trunc((resultAlphaG * 255.0) + 0.5) << 24) >>> 0;
                                }
                                if (!(alphaB === 0.0)) {
                                    unAlphaB = 1.0 - alphaB;
                                    resultAlphaB = alphaB + (unAlphaB * targetAlpha);
                                    resultB = (alphaB * foreB) + ((unAlphaB * resultBBits) * targetAlpha);
                                    resultBBits = Math.trunc((resultB / resultAlphaB) + 0.5);
                                }
                                targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
                                targetBits[pixelIndex] = targetWord;
                                morphIds[pixelIndex] = currentMorphId;
                            }
                        }
                        else {
                            /* Not in the stroke at all. Either fully in the fill, or outside the shape (pixel is unaffected). */
                            if (isGreenInside) {
                                /* Fully inside the fill, far from anti aliasing. (Here isGreenInside also implies isRedInside and isBlueInside) */
                                if (opaqueFillColorWord) {
                                    /* Fill color is opaque. Target is too. Just overwrite with fill color. */
                                    targetBits[pixelIndex] = opaqueFillColorWord;
                                    morphIds[pixelIndex] = currentMorphId;
                                }
                                else {
                                    /* Translucent color or target. Do proper blend of fill over target. */
                                    blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(pixelIndex, isRedInside, isGreenInside, isBlueInside, strokeAntiAliasAlphasWord);
                                }
                            }
                        }
                        if (mustResetColor) {
                            strokeA = realStrokeAlpha;
                            fillA = realFillAlpha;
                            opaqueStrokeColorWord = realOpaqueStrokeColorWord;
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

/* VectorEnginePlugin>>#blendStrokeAndFillWPLeft:top:right:bottom: */
primBlendStrokeAndFillWP = function(argCount) {
    var affectedBitsIndex, alpha, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var edgesThisPixel, edgesUpToThisPixel;
    var foreB, foreG, foreR;
    var idx, l, lastSegmentIndex, mustResetColor;
    var opaqueFillColorWord, opaqueStrokeColorWord, pixelIndex, r;
    var realFillAlpha, realOpaqueFillColorWord, realOpaqueStrokeColorWord, realStrokeAlpha;
    var resultAlpha, resultAlphaBits;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var segmentLength, strokeAAAlpha, strokeAAUnAlpha, strokeAntiAliasAlphaBits, t;
    var targetAlpha, targetAlphaBits, targetWord, toDoLimit, unAlpha;

    alphasOrEdgeCountsInThisSegment = 0;
    realOpaqueFillColorWord = 0;
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
    opaqueFillColorWord = 0;
    if (targetAssumedOpaque) {
        if ((strokeA * fillA) === 1.0) {
            auxR = (Math.trunc(strokeR + 0.5) << 16) >>> 0;
            auxG = (Math.trunc(strokeG + 0.5) << 8) >>> 0;
            auxB = Math.trunc(strokeB + 0.5);
            opaqueStrokeColorWord = (((0xFF000000 | auxR) | auxG) | auxB) >>> 0;
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
                            realStrokeAlpha = strokeA;
                            strokeA = strokeA * 0.25;
                            realFillAlpha = fillA;
                            fillA = fillA * 0.25;
                            realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                            opaqueStrokeColorWord = 0;
                            realOpaqueFillColorWord = opaqueFillColorWord;
                            opaqueFillColorWord = 0;
                            mustResetColor = 1;
                        }
                        else {
                            if (((displayX - 1) === antiAliasedClippedLeftPixel)
                             || ((displayX + 1) === antiAliasedClippedRightPixel)) {
                                realStrokeAlpha = strokeA;
                                strokeA = strokeA * 0.75;
                                realFillAlpha = fillA;
                                fillA = fillA * 0.75;
                                realOpaqueStrokeColorWord = opaqueStrokeColorWord;
                                opaqueStrokeColorWord = 0;
                                realOpaqueFillColorWord = opaqueFillColorWord;
                                opaqueFillColorWord = 0;
                                mustResetColor = 1;
                            }
                        }
                        if (strokeAntiAliasAlphaBits) {
                            /* At least partially in the stroke. */
                            if (strokeAntiAliasAlphaBits === 0x7F) {
                                /* Fully inside the stroke, far from anti aliasing. */
                                if (opaqueStrokeColorWord) {
                                    /* Stroke color is opaque. Target is too. Just overwrite with stroke color. */
                                    targetBits[pixelIndex] = opaqueStrokeColorWord;
                                    morphIds[pixelIndex] = currentMorphId;
                                }
                                else {
                                    /* Translucent color or target. Do proper blend of stroke over target. */
                                    blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F);
                                }
                            }
                            else {
                                /* In an anti aliased part of the stroke. Either blend stroke over background, or pre-mix stroke and fill. */
                                if (edgesUpToThisPixel) {
                                    /* Inside the shape. Blend stroke and fill, blend result over target. */

                                    /* begin blendStrokeAndFillWPAt:antiAliasAlphaByte: */
                                    strokeAAAlpha = strokeAntiAliasAlphaBits * (1.0 / 127.0);
                                    strokeAAUnAlpha = 1.0 - strokeAAAlpha;
                                    foreR = (strokeAAAlpha * strokeR) + (strokeAAUnAlpha * fillR);
                                    foreG = (strokeAAAlpha * strokeG) + (strokeAAUnAlpha * fillG);
                                    foreB = (strokeAAAlpha * strokeB) + (strokeAAUnAlpha * fillB);
                                    alpha = (strokeAAAlpha * strokeA) + (strokeAAUnAlpha * fillA);
                                    unAlpha = 1.0 - alpha;
                                    targetWord = targetBits[pixelIndex];
                                    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
                                    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
                                    resultAlpha = alpha + (unAlpha * targetAlpha);
                                    resultRBits = targetWord & 0xFF0000;
                                    resultGBits = targetWord & 0xFF00;
                                    resultBBits = targetWord & 0xFF;
                                    resultR = (alpha * foreR) + ((unAlpha * (resultRBits >>> 16)) * targetAlpha);
                                    resultG = (alpha * foreG) + ((unAlpha * (resultGBits >>> 8)) * targetAlpha);
                                    resultB = (alpha * foreB) + ((unAlpha * resultBBits) * targetAlpha);
                                    resultAlphaBits = (Math.trunc((resultAlpha * 0xFF) + 0.5) << 24) >>> 0;
                                    resultRBits = (Math.trunc((resultR / resultAlpha) + 0.5) << 16) >>> 0;
                                    resultGBits = (Math.trunc((resultG / resultAlpha) + 0.5) << 8) >>> 0;
                                    resultBBits = Math.trunc((resultB / resultAlpha) + 0.5);
                                    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
                                    targetBits[pixelIndex] = targetWord;
                                    morphIds[pixelIndex] = currentMorphId;
                                }
                                else {
                                    /* In the outer anti aliasing area of the stroke. Blend stroke over background. */
                                    blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits);
                                }
                            }
                        }
                        else {
                            /* Not in the stroke at all. Either fully in the fill, or outside the shape (pixel is unaffected). */
                            if (edgesUpToThisPixel) {
                                /* Fully inside the fill, far from anti aliasing. */
                                if (opaqueFillColorWord) {
                                    /* Fill color is opaque. Target is too. Just overwrite with fill color. */
                                    targetBits[pixelIndex] = opaqueFillColorWord;
                                    morphIds[pixelIndex] = currentMorphId;
                                }
                                else {
                                    /* Translucent color or target. Do proper blend of fill over target. */
                                    blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F);
                                }
                            }
                        }
                        if (mustResetColor) {
                            strokeA = realStrokeAlpha;
                            fillA = realFillAlpha;
                            opaqueStrokeColorWord = realOpaqueStrokeColorWord;
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

/* VectorEnginePlugin>>#blendStrokeOnlyWPLeft:top:right:bottom: */
primBlendStrokeOnlyWP = function(argCount) {
    var affectedBitsIndex, alphasOrEdgeCountsInThisSegment;
    var antiAliasedClippedLeftPixel, antiAliasedClippedRightPixel;
    var aux1, auxB, auxG, auxR, b;
    var clippingSpecIndex, clippingSpecL, clippingSpecR;
    var displayX, displayY;
    var idx, l, lastSegmentIndex, mustResetColor, opaqueStrokeColorWord;
    var pixelIndex, r, realOpaqueStrokeColorWord, realStrokeAlpha;
    var segmentLength, strokeAntiAliasAlphaBits, t, toDoLimit;

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
                    strokeAntiAliasAlphaBits = alphaMaskWP[pixelIndex];
                    if (strokeAntiAliasAlphaBits) {
                        /* In the stroke */
                        alphaMaskWP[pixelIndex] = 0;
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
                             && (strokeAntiAliasAlphaBits === 0x7F)) {
                                /* Optimize inner part of a wide stroke: Fully opaque stroke (and target), no anti aliasing, no clipping at this point. */
                                targetBits[pixelIndex] = opaqueStrokeColorWord;
                                morphIds[pixelIndex] = currentMorphId;
                            }
                            else {
                                /* General case. */
                                blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits);
                            }
                            if (mustResetColor) {
                                strokeA = realStrokeAlpha;
                                opaqueStrokeColorWord = realOpaqueStrokeColorWord;
                                mustResetColor = 0;
                            }
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
