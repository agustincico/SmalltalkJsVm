/* VectorEnginePlugin>>#updateEdgeCountWPAtX:y: */
function updateEdgeCountWPAtXy(x, y) {
    var affectedBitsIndex;
    var count;
    var increment;
    var pixelIndex;
    var pixelOffset;
    var pixelY;
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
        increment = 1;
    }
    else {
        pixelY = prevYTruncated;
        increment = 0xFF;
    }
    prevYTruncated = thisYTruncated;

    /* All edge count at the left of the clipRect are added there (at the left of the clipRect).
       The effect is the same, and we need to clean up less stuff afterwards.
       More important, it avoids trying to acess pixels outside our form, i.e. invalid array acesses. */

    /* take the next pixel center to the right of x */
    pixelOffset = (((Math.trunc(x + 1)) < clipLeft) ? clipLeft : (Math.trunc(x + 1)));
    if (pixelOffset <= clipRight) {
        pixelIndex = (pixelY * targetWidth) + pixelOffset;
        count = edgeCountsWP[pixelIndex];
        count = (count + increment) & 0xFF;   // count += increment; on a uint8_t in the C
        edgeCountsWP[pixelIndex] = count;
        affectedBitsIndex = pixelIndex >>> 4;
        if (!((affectedBits[affectedBitsIndex]) == 1)) {
            affectedBits[affectedBitsIndex] = 1;
        }
    }
    return 0;
}
