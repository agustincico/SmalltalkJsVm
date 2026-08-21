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
