/* VectorEnginePlugin>>#updateEdgeCountWPAtX:y: */
static sqInt
updateEdgeCountWPAtXy(float x, float y)
{
	sqInt affectedBitsIndex;
	uint8_t count;
	uint8_t increment;
	sqInt pixelIndex;
	sqInt pixelOffset;
	sqInt pixelY;
	sqInt thisYTruncated;

	/* truncated, both in C and Smalltalk */
	thisYTruncated = ((sqInt)y);
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
	pixelOffset = (((((sqInt)(x + 1))) < clipLeft) ? clipLeft : (((sqInt)(x + 1))));
	if (pixelOffset <= clipRight) {
		pixelIndex = (pixelY * targetWidth) + pixelOffset;
		count = edgeCountsWP[pixelIndex];
		count += increment;
		edgeCountsWP[pixelIndex] = count;
		affectedBitsIndex = ((usqInt)(pixelIndex)) >> 4;
		if (!((affectedBits[affectedBitsIndex]) == 1)) {
			affectedBits[affectedBitsIndex] = 1;
		}
	}
	return 0;
}
