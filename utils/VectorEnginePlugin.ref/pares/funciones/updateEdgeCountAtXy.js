/* VectorEnginePlugin>>#updateEdgeCountAtX:y: */
function updateEdgeCountAtXy(x, y) {
    var affectedBitsIndex;
    var affectedBitsIndex2;
    var blueCount;
    var blueIncrement;
    var blueOffset;
    var bluePixelIndex;
    var countWord;
    var greenCount;
    var greenIncrement;
    var greenOffset;
    var greenPixelIndex;
    var pixelIndexBase;
    var pixelY;
    var redCount;
    var redIncrement;
    var redOffset;
    var redPixelIndex;
    var rest;
    var thisYTruncated;

    /* truncated, both in C and Smalltalk */
    thisYTruncated = Math.trunc(y);
    if (thisYTruncated == prevYTruncated) {
        return 0;
    }
    if (!(((thisYTruncated >= (clipTop - 1)) && (thisYTruncated <= clipBottom)))) {
        return 0;
    }
    if (prevYTruncated == 0x7FFFFFFF) {
        prevYTruncated = thisYTruncated;
        return 0;
    }
    if (thisYTruncated > prevYTruncated) {
        pixelY = thisYTruncated;
        redIncrement = 0x10000;
        greenIncrement = 0x100;
        blueIncrement = 1;
    }
    else {
        pixelY = prevYTruncated;
        redIncrement = 0xFF0000;
        greenIncrement = 0xFF00;
        blueIncrement = 0xFF;
    }
    prevYTruncated = thisYTruncated;

    /* All edge count at the left of the clipRect are added there (at the left of the clipRect).
       The effect is the same, and we need to clean up less stuff afterwards.
       More important, it avoids trying to acess pixels outside our form, i.e. invalid array acesses. */
    pixelIndexBase = pixelY * targetWidth;

    /* take the next red subpixel center to the right of x */
    redOffset = (((Math.trunc((x + subPixelDelta) + 1)) < clipLeft) ? clipLeft : (Math.trunc((x + subPixelDelta) + 1)));

    /* take the next green subpixel center to the right of x */
    greenOffset = (((Math.trunc(x + 1)) < clipLeft) ? clipLeft : (Math.trunc(x + 1)));

    /* take the next blue subpixel center to the right of x */
    blueOffset = (((Math.trunc((x - subPixelDelta) + 1)) < clipLeft) ? clipLeft : (Math.trunc((x - subPixelDelta) + 1)));
    redPixelIndex = pixelIndexBase + redOffset;
    greenPixelIndex = pixelIndexBase + greenOffset;
    bluePixelIndex = pixelIndexBase + blueOffset;

    /* Three possible cases here: RGB in one word (pixel); RG in one, and G in another; R in one, GB in another */
    if (redPixelIndex == bluePixelIndex) {
        /* First case: RGB in the same word */
        if (redOffset <= clipRight) {
            countWord = edgeCounts[redPixelIndex];
            redCount = (countWord + redIncrement) & 0xFF0000;
            greenCount = (countWord + greenIncrement) & 0xFF00;
            blueCount = (countWord + blueIncrement) & 0xFF;
            countWord = (redCount | greenCount) | blueCount;
            edgeCounts[redPixelIndex] = countWord;
            affectedBitsIndex = redPixelIndex >>> 4;
            if (!((affectedBits[affectedBitsIndex]) == 1)) {
                affectedBits[affectedBitsIndex] = 1;
            }
        }
    }
    else {
        if (redPixelIndex == greenPixelIndex) {
            /* Second case: RG in one word, B in previous */
            if (redOffset <= clipRight) {
                countWord = edgeCounts[redPixelIndex];
                redCount = (countWord + redIncrement) & 0xFF0000;
                greenCount = (countWord + greenIncrement) & 0xFF00;
                rest = countWord & 0xFF;
                countWord = (redCount | greenCount) | rest;
                edgeCounts[redPixelIndex] = countWord;
            }
            if (blueOffset <= clipRight) {
                countWord = edgeCounts[bluePixelIndex];
                rest = countWord & 0xFFFF00;
                blueCount = (countWord + blueIncrement) & 0xFF;
                countWord = rest | blueCount;
                edgeCounts[bluePixelIndex] = countWord;
            }
        }
        else {
            /* Third case: R in one word, GB in the previous */
            if (redOffset <= clipRight) {
                countWord = edgeCounts[redPixelIndex];
                redCount = (countWord + redIncrement) & 0xFF0000;
                rest = countWord & 0xFFFF;
                countWord = redCount | rest;
                edgeCounts[redPixelIndex] = countWord;
            }
            if (blueOffset <= clipRight) {
                countWord = edgeCounts[bluePixelIndex];
                rest = countWord & 0xFF0000;
                greenCount = (countWord + greenIncrement) & 0xFF00;
                blueCount = (countWord + blueIncrement) & 0xFF;
                countWord = (rest | greenCount) | blueCount;
                edgeCounts[bluePixelIndex] = countWord;
            }
        }
        affectedBitsIndex = redPixelIndex >>> 4;
        if (!((affectedBits[affectedBitsIndex]) == 1)) {
            affectedBits[affectedBitsIndex] = 1;
        }
        affectedBitsIndex2 = bluePixelIndex >>> 4;
        if (!(affectedBitsIndex2 == affectedBitsIndex)) {
            if (!((affectedBits[affectedBitsIndex2]) == 1)) {
                affectedBits[affectedBitsIndex2] = 1;
            }
        }
    }
    return 0;
}
