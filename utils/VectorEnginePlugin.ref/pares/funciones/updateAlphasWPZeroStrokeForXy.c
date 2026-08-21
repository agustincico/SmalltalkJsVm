/* VectorEnginePlugin>>#updateAlphasWPZeroStrokeForX:y: */
static sqInt
updateAlphasWPZeroStrokeForXy(float x, float y)
{
	sqInt affectedBitsIndex1;
	sqInt affectedBitsIndex2;
	uint8_t alphaByte;
	sqInt b;
	uint8_t candidateAlpha;
	float distanceToAxisSquared;
	float dx;
	float dx2;
	float dx2Squared;
	float dxSquared;
	float dy;
	float dy2;
	float dy2Squared;
	float dySquared;
	sqInt l;
	sqInt pixelIndex;
	sqInt r;
	sqInt t;


	/* Compute affected rect. Honor clipRect */
	t = ((sqInt)y);
	b = t + 1;
	l = ((sqInt)x);
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
		if (!(alphaByte == 0x7F)) {
			candidateAlpha = ((sqInt)((0.8 - (sqrt(distanceToAxisSquared))) * 79.375));
			if (candidateAlpha > alphaByte) {
				affectedBitsIndex1 = ((usqInt)(pixelIndex)) >> 4;
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
	if (!(r == l)) {
		dx2 = dx + 1;
		dx2Squared = dx2 * dx2;
		distanceToAxisSquared = dx2Squared + dySquared;
		if (distanceToAxisSquared < 0.64) {
			alphaByte = alphaMaskWP[pixelIndex + 1];
			if (!(alphaByte == 0x7F)) {
				candidateAlpha = ((sqInt)((0.8 - (sqrt(distanceToAxisSquared))) * 79.375));
				if (candidateAlpha > alphaByte) {
					affectedBitsIndex2 = ((usqInt)((pixelIndex + 1))) >> 4;
					if (!(affectedBitsIndex2 == affectedBitsIndex1)) {
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
	if (t == b) {
		return 0;
	}
	pixelIndex = (b * targetWidth) + l;
	affectedBitsIndex1 = -1;
	dy2 = dy + 1;
	dy2Squared = dy2 * dy2;
	distanceToAxisSquared = dxSquared + dy2Squared;
	if (distanceToAxisSquared < 0.64) {
		alphaByte = alphaMaskWP[pixelIndex];
		if (!(alphaByte == 0x7F)) {
			candidateAlpha = ((sqInt)((0.8 - (sqrt(distanceToAxisSquared))) * 79.375));
			if (candidateAlpha > alphaByte) {
				affectedBitsIndex1 = ((usqInt)(pixelIndex)) >> 4;
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
	if (!(r == l)) {
		distanceToAxisSquared = dx2Squared + dy2Squared;
		if (distanceToAxisSquared < 0.64) {
			alphaByte = alphaMaskWP[pixelIndex + 1];
			if (!(alphaByte == 0x7F)) {
				candidateAlpha = ((sqInt)((0.8 - (sqrt(distanceToAxisSquared))) * 79.375));
				if (candidateAlpha > alphaByte) {
					affectedBitsIndex2 = ((usqInt)((pixelIndex + 1))) >> 4;
					if (!(affectedBitsIndex2 == affectedBitsIndex1)) {
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
