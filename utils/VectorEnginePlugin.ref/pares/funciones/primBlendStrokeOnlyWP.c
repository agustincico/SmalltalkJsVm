/* VectorEnginePlugin>>#blendStrokeOnlyWPLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendStrokeOnlyWP(void)
{
	sqInt affectedBitsIndex;
	int alphasOrEdgeCountsInThisSegment;
	sqInt antiAliasedClippedLeftPixel;
	sqInt antiAliasedClippedRightPixel;
	sqInt aux1;
	uint32_t auxB;
	uint32_t auxG;
	uint32_t auxR;
	sqInt b;
	sqInt clippingSpecIndex;
	int clippingSpecL;
	sqInt clippingSpecR;
	sqInt displayX;
	sqInt displayY;
	sqInt idx;
	sqInt l;
	sqInt lastSegmentIndex;
	sqInt mustResetColor;
	uint32_t opaqueStrokeColorWord;
	sqInt pixelIndex;
	sqInt r;
	uint32_t realOpaqueStrokeColorWord;
	float realStrokeAlpha;
	sqInt segmentLength;
	uint8_t strokeAntiAliasAlphaBits;
	sqInt t;
	sqInt toDoLimit;

	alphasOrEdgeCountsInThisSegment = 0;
	realOpaqueStrokeColorWord = 0;
	if (!((isIntegerObject((l = stackValue(3))))
		 && ((isIntegerObject((t = stackValue(2))))
		 && ((isIntegerObject((r = stackValue(1))))
		 && (isIntegerObject((b = stackValue(0)))))))) {
		return primitiveFailFor(PrimErrBadArgument);
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
		if (strokeA == 1.0) {
			auxR = (((sqInt)((usqInt)((((sqInt)(strokeR + 0.5)))) << 16)));
			auxG = (((sqInt)((usqInt)((((sqInt)(strokeG + 0.5)))) << 8)));
			auxB = ((sqInt)(strokeB + 0.5));
			opaqueStrokeColorWord = ((0xFF000000U | auxR) | auxG) | auxB;
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
			affectedBitsIndex = ((usqInt)(pixelIndex)) >> 4;
			if (!(lastSegmentIndex == affectedBitsIndex)) {
				alphasOrEdgeCountsInThisSegment = (affectedBits[affectedBitsIndex]) == 1;
				lastSegmentIndex = affectedBitsIndex;
				if (alphasOrEdgeCountsInThisSegment) {
					affectedBits[affectedBitsIndex] = 0;
				}
			}
			segmentLength = ((((usqInt)((affectedBitsIndex + 1)) << 4))) - pixelIndex;
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
							if ((displayX == antiAliasedClippedLeftPixel)
							 || (displayX == antiAliasedClippedRightPixel)) {
								realStrokeAlpha = strokeA;
								strokeA = strokeA * 0.25;
								realOpaqueStrokeColorWord = opaqueStrokeColorWord;
								opaqueStrokeColorWord = 0;
								mustResetColor = 1;
							}
							else {
								if (((displayX - 1) == antiAliasedClippedLeftPixel)
								 || ((displayX + 1) == antiAliasedClippedRightPixel)) {
									realStrokeAlpha = strokeA;
									strokeA = strokeA * 0.75;
									realOpaqueStrokeColorWord = opaqueStrokeColorWord;
									opaqueStrokeColorWord = 0;
									mustResetColor = 1;
								}
							}
							if ((opaqueStrokeColorWord != 0)
							 && (strokeAntiAliasAlphaBits == 0x7F)) {
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
	if (!(failed())) {
		pop(4);
	}
	return null;
}
