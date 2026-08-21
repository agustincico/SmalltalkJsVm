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
