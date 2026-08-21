/* VectorEnginePlugin>>#updateAlphasWPForX:y: */
static sqInt
updateAlphasWPForXy(float x, float y)
{
	sqInt affectedBitsIndex;
	uint8_t alphaByte;
	float aux1;
	sqInt b;
	sqInt bit;
	uint8_t candidateAlpha;
	sqInt displayX;
	sqInt displayY;
	float distanceToAxisSquared;
	float dx;
	float dy;
	float dySquared;
	sqInt l;
	sqInt lastUpdated;
	sqInt pixelIndex;
	sqInt r;
	sqInt t;


	/* Use this optimized varsion if possible. */
	if ((strokeWidth == 0.0)
	 && ((fabs(antiAliasingWidth - 1.6)) < 1.0e-6)) {
		return updateAlphasWPZeroStrokeForXy(x, y);
	}

	/* If dashed strokes, only draw if in a dash, not in a gap. */
	if (!(dashBitLength == 0.0)) {
		/* Compute trajectory length. This is not precise. In many cases the actual hop used is smaller than this. */
		trajectoryLength += hop;

		/* Note: dashBitOffset must be positive. */
		bit = ((((sqInt)(trajectoryLength / dashBitLength))) + dashBitOffset) % dashBitCount;
		if (!(dashedStrokeBits & (1U << ((dashBitCount - bit) - 1)))) {
			needsFullAlphaCircle = 1;
			return 0;
		}
	}

	/* Compute affected rect. Honor clipRect */

	/* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
	t = ((sqInt)((y - auxStrokeWidthDilatedHalf) + 1));
	if (t < clipTop) {
		t = clipTop;
	}
	b = ((sqInt)(y + auxStrokeWidthDilatedHalf));
	if (b > clipBottom) {
		b = clipBottom;
	}

	/* (int(z+1)) works equally well than the more intuitive but slower (int(ceil(z)) */
	l = ((sqInt)((x - auxStrokeWidthDilatedHalf) + 1));
	if (l < clipLeft) {
		l = clipLeft;
	}
	r = ((sqInt)(x + auxStrokeWidthDilatedHalf));
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
					if (!(alphaByte == 0x7F)) {
						aux1 = auxStrokeWidthDilatedHalf - (sqrt(distanceToAxisSquared));
						candidateAlpha = ((sqInt)((((aux1 < antiAliasingWidth) ? aux1 : antiAliasingWidth)) * auxAntiAliasingWidthScaledInverse));
						if (candidateAlpha > alphaByte) {
							affectedBitsIndex = ((usqInt)(pixelIndex)) >> 4;
							if (!(lastUpdated == affectedBitsIndex)) {
								/* Slight optimization */
								if (!((affectedBits[affectedBitsIndex]) == 1)) {
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
