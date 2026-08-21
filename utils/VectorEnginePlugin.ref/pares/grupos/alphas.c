
	/* VectorEnginePlugin>>#updateAlphasForX:y: */
static sqInt
updateAlphasForXy(float x, float y)
{
	sqInt affectedBitsIndex;
	uint32_t alphaWord;
	sqInt b;
	sqInt bit;
	uint32_t blueAlpha;
	uint32_t candidateAlpha;
	sqInt displayX;
	sqInt displayY;
	float distanceToAxisSquared;
	sqInt doUpdate;
	float dx;
	float dxp;
	float dy;
	float dySquared;
	uint32_t greenAlpha;
	sqInt l;
	sqInt lastUpdated;
	sqInt pixelIndex;
	sqInt r;
	uint32_t redAlpha;
	sqInt t;


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
	l = ((sqInt)(((x - auxStrokeWidthDilatedHalf) - subPixelDelta) + 1));
	if (l < clipLeft) {
		l = clipLeft;
	}
	r = ((sqInt)((x + auxStrokeWidthDilatedHalf) + subPixelDelta));
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
				if (!(alphaWord == 0x7F7F7F)) {
					redAlpha = alphaWord & 0x7F0000;
					greenAlpha = alphaWord & 0x7F00;
					blueAlpha = alphaWord & 0x7F;
					doUpdate = 0;

					/* Red */
					dxp = dx - subPixelDelta;
					distanceToAxisSquared = (dxp * dxp) + dySquared;
					if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
						candidateAlpha = ((sqInt)((auxStrokeWidthDilatedHalf - (sqrt(distanceToAxisSquared))) * auxAntiAliasingWidthScaledInverse));
						candidateAlpha = ((((usqInt)(candidateAlpha) << 16)));
						if (candidateAlpha > redAlpha) {
							doUpdate = 1;
							redAlpha = ((candidateAlpha < 0x7F0000) ? candidateAlpha : 0x7F0000);
						}
					}

					/* Green */
					distanceToAxisSquared = (dx * dx) + dySquared;
					if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
						candidateAlpha = ((sqInt)((auxStrokeWidthDilatedHalf - (sqrt(distanceToAxisSquared))) * auxAntiAliasingWidthScaledInverse));
						candidateAlpha = ((((usqInt)(candidateAlpha) << 8)));
						if (candidateAlpha > greenAlpha) {
							doUpdate = 1;
							greenAlpha = ((candidateAlpha < 0x7F00) ? candidateAlpha : 0x7F00);
						}
					}

					/* Blue */
					dxp = dx + subPixelDelta;
					distanceToAxisSquared = (dxp * dxp) + dySquared;
					if (distanceToAxisSquared < auxStrokeWidthDilatedHalfSquared) {
						candidateAlpha = ((sqInt)((auxStrokeWidthDilatedHalf - (sqrt(distanceToAxisSquared))) * auxAntiAliasingWidthScaledInverse));
						if (candidateAlpha > blueAlpha) {
							doUpdate = 1;
							blueAlpha = ((candidateAlpha < 0x7F) ? candidateAlpha : 0x7F);
						}
					}
					if (doUpdate) {
						affectedBitsIndex = ((usqInt)(pixelIndex)) >> 4;
						if (!(lastUpdated == affectedBitsIndex)) {
							/* Slight optimization */
							if (!((affectedBits[affectedBitsIndex]) == 1)) {
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


/* ===== */


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


/* ===== */


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
