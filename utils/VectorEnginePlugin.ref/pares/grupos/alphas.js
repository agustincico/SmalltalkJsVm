/* VectorEnginePlugin>>#updateAlphasForX:y: */
function updateAlphasForXy(x, y) {
    var affectedBitsIndex;
    var alphaWord;
    var b;
    var bit;
    var blueAlpha;
    var candidateAlpha;
    var displayX;
    var displayY;
    var distanceToAxisSquared;
    var doUpdate;
    var dx;
    var dxp;
    var dy;
    var dySquared;
    var greenAlpha;
    var l;
    var lastUpdated;
    var pixelIndex;
    var r;
    var redAlpha;
    var t;

    /* If dashed strokes, only draw if in a dash, not in a gap. */
    if (!(dashBitLength === 0.0)) {
        /* Compute trajectory length. This is not precise. In many cases the actual hop used is smaller than this. */
        trajectoryLength += hop;

        /* Note: dashBitOffset must be positive. */
        bit = (Math.trunc(trajectoryLength / dashBitLength) + dashBitOffset) % dashBitCount;
        if (!(dashedStrokeBits & (1 << ((dashBitCount - bit) - 1)))) {
            needsFullAlphaCircle = 1;
            return 0;
        }
    }

    /* Compute affected rect. Honor clipRect */

    /* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
    t = Math.trunc((y - auxStrokeWidthDilatedHalf) + 1);
    if (t < clipTop) {
        t = clipTop;
    }
    b = Math.trunc(y + auxStrokeWidthDilatedHalf);
    if (b > clipBottom) {
        b = clipBottom;
    }

    /* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
    l = Math.trunc(((x - auxStrokeWidthDilatedHalf) - subPixelDelta) + 1);
    if (l < clipLeft) {
        l = clipLeft;
    }
    r = Math.trunc((x + auxStrokeWidthDilatedHalf) + subPixelDelta);
    if (r > clipRight) {
        r = clipRight;
    }
    lastUpdated = -1;
    for (displayY = t; displayY <= b; displayY += 1) {
        pixelIndex = ((displayY * targetWidth) + l) - 1;
        dy = displayY - y;
        dySquared = dy * dy;
        for (displayX = l; displayX <= r; displayX += 1) {
            pixelIndex += 1;
            dx = displayX - x;

            /* Use Green subpixel for this. */
            distanceToAxisSquared = (dx * dx) + dySquared;
            if (needsFullAlphaCircle
             || (distanceToAxisSquared > auxStrokeWidthErodedHalfSquared)) {
                alphaWord = alphaMask[pixelIndex];
                if (!(alphaWord === 0x7F7F7F)) {
                    redAlpha = alphaWord & 0x7F0000;
                    greenAlpha = alphaWord & 0x7F00;
                    blueAlpha = alphaWord & 0x7F;
                    doUpdate = 0;

                    /* Red */
                    dxp = dx - subPixelDelta;
                    distanceToAxisSquared = (dxp * dxp) + dySquared;
                    if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
                        candidateAlpha = Math.trunc((auxStrokeWidthDilatedHalf - Math.sqrt(distanceToAxisSquared)) * auxAntiAliasingWidthScaledInverse) >>> 0;
                        candidateAlpha = (candidateAlpha << 16) >>> 0;
                        if (candidateAlpha > redAlpha) {
                            doUpdate = 1;
                            redAlpha = (candidateAlpha < 0x7F0000) ? candidateAlpha : 0x7F0000;
                        }
                    }

                    /* Green */
                    distanceToAxisSquared = (dx * dx) + dySquared;
                    if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
                        candidateAlpha = Math.trunc((auxStrokeWidthDilatedHalf - Math.sqrt(distanceToAxisSquared)) * auxAntiAliasingWidthScaledInverse) >>> 0;
                        candidateAlpha = (candidateAlpha << 8) >>> 0;
                        if (candidateAlpha > greenAlpha) {
                            doUpdate = 1;
                            greenAlpha = (candidateAlpha < 0x7F00) ? candidateAlpha : 0x7F00;
                        }
                    }

                    /* Blue */
                    dxp = dx + subPixelDelta;
                    distanceToAxisSquared = (dxp * dxp) + dySquared;
                    if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
                        candidateAlpha = Math.trunc((auxStrokeWidthDilatedHalf - Math.sqrt(distanceToAxisSquared)) * auxAntiAliasingWidthScaledInverse) >>> 0;
                        if (candidateAlpha > blueAlpha) {
                            doUpdate = 1;
                            blueAlpha = (candidateAlpha < 0x7F) ? candidateAlpha : 0x7F;
                        }
                    }
                    if (doUpdate) {
                        affectedBitsIndex = pixelIndex >>> 4;
                        if (!(lastUpdated === affectedBitsIndex)) {
                            /* Slight optimization */
                            if (!((affectedBits[affectedBitsIndex]) === 1)) {
                                affectedBits[affectedBitsIndex] = 1;
                                lastUpdated = affectedBitsIndex;
                            }
                        }
                        alphaWord = (redAlpha | greenAlpha) | blueAlpha;
                        alphaMask[pixelIndex] = alphaWord;
                    }
                }
            }
        }
    }
    needsFullAlphaCircle = 0;
    return 0;
}

/* VectorEnginePlugin>>#updateAlphasWPForX:y: */
function updateAlphasWPForXy(x, y) {
    var affectedBitsIndex;
    var alphaByte;
    var aux1;
    var b;
    var bit;
    var candidateAlpha;
    var displayX;
    var displayY;
    var distanceToAxisSquared;
    var dx;
    var dy;
    var dySquared;
    var l;
    var lastUpdated;
    var pixelIndex;
    var r;
    var t;

    /* Use this optimized varsion if possible. */
    if ((strokeWidth === 0.0)
     && ((Math.abs(antiAliasingWidth - 1.6)) < 1.0e-6)) {
        return updateAlphasWPZeroStrokeForXy(x, y);
    }

    /* If dashed strokes, only draw if in a dash, not in a gap. */
    if (!(dashBitLength === 0.0)) {
        /* Compute trajectory length. This is not precise. In many cases the actual hop used is smaller than this. */
        trajectoryLength += hop;

        /* Note: dashBitOffset must be positive. */
        bit = (Math.trunc(trajectoryLength / dashBitLength) + dashBitOffset) % dashBitCount;
        if (!(dashedStrokeBits & (1 << ((dashBitCount - bit) - 1)))) {
            needsFullAlphaCircle = 1;
            return 0;
        }
    }

    /* Compute affected rect. Honor clipRect */

    /* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
    t = Math.trunc((y - auxStrokeWidthDilatedHalf) + 1);
    if (t < clipTop) {
        t = clipTop;
    }
    b = Math.trunc(y + auxStrokeWidthDilatedHalf);
    if (b > clipBottom) {
        b = clipBottom;
    }

    /* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
    l = Math.trunc((x - auxStrokeWidthDilatedHalf) + 1);
    if (l < clipLeft) {
        l = clipLeft;
    }
    r = Math.trunc(x + auxStrokeWidthDilatedHalf);
    if (r > clipRight) {
        r = clipRight;
    }
    lastUpdated = -1;
    for (displayY = t; displayY <= b; displayY += 1) {
        pixelIndex = ((displayY * targetWidth) + l) - 1;
        dy = displayY - y;
        dySquared = dy * dy;
        for (displayX = l; displayX <= r; displayX += 1) {
            pixelIndex += 1;
            dx = displayX - x;
            distanceToAxisSquared = (dx * dx) + dySquared;
            if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
                if (needsFullAlphaCircle
                 || (distanceToAxisSquared > auxStrokeWidthErodedHalfSquared)) {
                    alphaByte = alphaMaskWP[pixelIndex];
                    if (!(alphaByte === 0x7F)) {
                        aux1 = auxStrokeWidthDilatedHalf - Math.sqrt(distanceToAxisSquared);
                        candidateAlpha = Math.trunc(((aux1 < antiAliasingWidth) ? aux1 : antiAliasingWidth) * auxAntiAliasingWidthScaledInverse) & 0xFF;
                        if (candidateAlpha > alphaByte) {
                            affectedBitsIndex = pixelIndex >>> 4;
                            if (!(lastUpdated === affectedBitsIndex)) {
                                /* Slight optimization */
                                if (!((affectedBits[affectedBitsIndex]) === 1)) {
                                    affectedBits[affectedBitsIndex] = 1;
                                    lastUpdated = affectedBitsIndex;
                                }
                            }
                            alphaMaskWP[pixelIndex] = candidateAlpha;
                        }
                    }
                }
            }
        }
    }
    needsFullAlphaCircle = 0;
    return 0;
}

/* VectorEnginePlugin>>#updateAlphasWPZeroStrokeForX:y: */
function updateAlphasWPZeroStrokeForXy(x, y) {
    var affectedBitsIndex1;
    var affectedBitsIndex2;
    var alphaByte;
    var b;
    var candidateAlpha;
    var distanceToAxisSquared;
    var dx;
    var dx2;
    var dx2Squared;
    var dxSquared;
    var dy;
    var dy2;
    var dy2Squared;
    var dySquared;
    var l;
    var pixelIndex;
    var r;
    var t;

    /* Compute affected rect. Honor clipRect */
    t = Math.trunc(y);
    b = t + 1;
    l = Math.trunc(x);
    r = l + 1;
    if (t < clipTop) {
        t = clipTop;
    }
    if (b > clipBottom) {
        b = clipBottom;
    }
    if (l < clipLeft) {
        l = clipLeft;
    }
    if (r > clipRight) {
        r = clipRight;
    }
    if (t > b) {
        return 0;
    }
    if (l > r) {
        return 0;
    }
    pixelIndex = (t * targetWidth) + l;
    affectedBitsIndex1 = -1;
    dy = t - y;
    dySquared = dy * dy;
    dx = l - x;
    dxSquared = dx * dx;
    distanceToAxisSquared = dxSquared + dySquared;
    if (distanceToAxisSquared < 0.64) {
        alphaByte = alphaMaskWP[pixelIndex];
        if (!(alphaByte === 0x7F)) {
            candidateAlpha = Math.trunc((0.8 - Math.sqrt(distanceToAxisSquared)) * 79.375) & 0xFF;
            if (candidateAlpha > alphaByte) {
                affectedBitsIndex1 = pixelIndex >>> 4;
                if (!(affectedBits[affectedBitsIndex1])) {
                    affectedBits[affectedBitsIndex1] = 1;
                }
                alphaMaskWP[pixelIndex] = candidateAlpha;
            }
        }
        if (distanceToAxisSquared < 0.36) {
            return 0;
        }
    }
    if (!(r === l)) {
        dx2 = dx + 1;
        dx2Squared = dx2 * dx2;
        distanceToAxisSquared = dx2Squared + dySquared;
        if (distanceToAxisSquared < 0.64) {
            alphaByte = alphaMaskWP[pixelIndex + 1];
            if (!(alphaByte === 0x7F)) {
                candidateAlpha = Math.trunc((0.8 - Math.sqrt(distanceToAxisSquared)) * 79.375) & 0xFF;
                if (candidateAlpha > alphaByte) {
                    affectedBitsIndex2 = (pixelIndex + 1) >>> 4;
                    if (!(affectedBitsIndex2 === affectedBitsIndex1)) {
                        if (!(affectedBits[affectedBitsIndex2])) {
                            affectedBits[affectedBitsIndex2] = 1;
                        }
                    }
                    alphaMaskWP[pixelIndex + 1] = candidateAlpha;
                }
            }
            if (distanceToAxisSquared < 0.36) {
                return 0;
            }
        }
    }
    if (t === b) {
        return 0;
    }
    pixelIndex = (b * targetWidth) + l;
    affectedBitsIndex1 = -1;
    dy2 = dy + 1;
    dy2Squared = dy2 * dy2;
    distanceToAxisSquared = dxSquared + dy2Squared;
    if (distanceToAxisSquared < 0.64) {
        alphaByte = alphaMaskWP[pixelIndex];
        if (!(alphaByte === 0x7F)) {
            candidateAlpha = Math.trunc((0.8 - Math.sqrt(distanceToAxisSquared)) * 79.375) & 0xFF;
            if (candidateAlpha > alphaByte) {
                affectedBitsIndex1 = pixelIndex >>> 4;
                if (!(affectedBits[affectedBitsIndex1])) {
                    affectedBits[affectedBitsIndex1] = 1;
                }
                alphaMaskWP[pixelIndex] = candidateAlpha;
            }
        }
        if (distanceToAxisSquared < 0.36) {
            return 0;
        }
    }
    if (!(r === l)) {
        distanceToAxisSquared = dx2Squared + dy2Squared;
        if (distanceToAxisSquared < 0.64) {
            alphaByte = alphaMaskWP[pixelIndex + 1];
            if (!(alphaByte === 0x7F)) {
                candidateAlpha = Math.trunc((0.8 - Math.sqrt(distanceToAxisSquared)) * 79.375) & 0xFF;
                if (candidateAlpha > alphaByte) {
                    affectedBitsIndex2 = (pixelIndex + 1) >>> 4;
                    if (!(affectedBitsIndex2 === affectedBitsIndex1)) {
                        if (!(affectedBits[affectedBitsIndex2])) {
                            affectedBits[affectedBitsIndex2] = 1;
                        }
                    }
                    alphaMaskWP[pixelIndex + 1] = candidateAlpha;
                }
            }
        }
    }
    return 0;
}
