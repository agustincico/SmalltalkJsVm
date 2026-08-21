/* VectorEnginePlugin>>#blendFillOnlyLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendFillOnly(void)
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
	uint8_t edgesThisPixelB;
	uint8_t edgesThisPixelG;
	uint8_t edgesThisPixelR;
	uint32_t edgesThisPixelWord;
	uint8_t edgesUpToThisPixelB;
	uint8_t edgesUpToThisPixelG;
	uint8_t edgesUpToThisPixelR;
	sqInt idx;
	sqInt isBlueInside;
	sqInt isGreenInside;
	sqInt isRedInside;
	sqInt l;
	sqInt lastSegmentIndex;
	sqInt mustResetColor;
	uint32_t opaqueFillColorWord;
	sqInt pixelIndex;
	sqInt r;
	float realFillAlpha;
	uint32_t realOpaqueFillColorWord;
	sqInt segmentLength;
	uint32_t strokeAntiAliasAlphasWord;
	sqInt t;
	sqInt toDoLimit;

	alphasOrEdgeCountsInThisSegment = 0;
	realOpaqueFillColorWord = 0;
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
	opaqueFillColorWord = 0;
	if (targetAssumedOpaque) {
		if (fillA == 1.0) {
			auxR = (((sqInt)((usqInt)((((sqInt)(fillR + 0.5)))) << 16)));
			auxG = (((sqInt)((usqInt)((((sqInt)(fillG + 0.5)))) << 8)));
			auxB = ((sqInt)(fillB + 0.5));
			opaqueFillColorWord = ((0xFF000000U | auxR) | auxG) | auxB;
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
		edgesUpToThisPixelR = 0;
		edgesUpToThisPixelG = 0;
		edgesUpToThisPixelB = 0;
		isRedInside = (isGreenInside = (isBlueInside = 0));
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
			if (alphasOrEdgeCountsInThisSegment || isGreenInside) {
				aux1 = (r - displayX) + 1;
				toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
				for (idx = 1; idx <= toDoLimit; idx += 1) {
					strokeAntiAliasAlphasWord = 0;
					if (alphasOrEdgeCountsInThisSegment) {
						edgesThisPixelWord = edgeCounts[pixelIndex];
						if (edgesThisPixelWord) {
							edgeCounts[pixelIndex] = 0;
							edgesThisPixelR = (((usqInt)((edgesThisPixelWord & 0xFF0000))) >> 16);
							edgesThisPixelG = (((usqInt)((edgesThisPixelWord & 0xFF00))) >> 8);
							edgesThisPixelB = edgesThisPixelWord & 0xFF;
							edgesUpToThisPixelR += edgesThisPixelR;
							edgesUpToThisPixelG += edgesThisPixelG;
							edgesUpToThisPixelB += edgesThisPixelB;

							/* In C, integers already behave like booleans */
							
									isRedInside = edgesUpToThisPixelR;
									isGreenInside = edgesUpToThisPixelG;
									isBlueInside = edgesUpToThisPixelB;
						}
						strokeAntiAliasAlphasWord = alphaMask[pixelIndex];
						if (strokeAntiAliasAlphasWord) {
							alphaMask[pixelIndex] = 0;
						}
					}
					if ((displayX >= clippingSpecL)
					 && (displayX <= clippingSpecR)) {
						if ((displayX == antiAliasedClippedLeftPixel)
						 || (displayX == antiAliasedClippedRightPixel)) {
							realFillAlpha = fillA;
							fillA = fillA * 0.25;
							realOpaqueFillColorWord = opaqueFillColorWord;
							opaqueFillColorWord = 0;
							mustResetColor = 1;
						}
						else {
							if (((displayX - 1) == antiAliasedClippedLeftPixel)
							 || ((displayX + 1) == antiAliasedClippedRightPixel)) {
								realFillAlpha = fillA;
								fillA = fillA * 0.75;
								realOpaqueFillColorWord = opaqueFillColorWord;
								opaqueFillColorWord = 0;
								mustResetColor = 1;
							}
						}
						if ((opaqueFillColorWord != 0)
						 && ((strokeAntiAliasAlphasWord == 0)
						 && (isGreenInside))) {
							/* Overwrite with fill color is ok and we are in the fill, far from anti aliasing
							   If no alpha, and isGreenInside is true, isRedInside and isBlueInside are also true */
							targetBits[pixelIndex] = opaqueFillColorWord;
							morphIds[pixelIndex] = currentMorphId;
						}
						else {
							/* General case. (strokeAntiAliasAlphasWord = 0 and outside the shape means NOP) */
							if ((strokeAntiAliasAlphasWord != 0)
							 || (isGreenInside)) {
								/* If no alpha, and isGreenInside is true, isRedInside and isBlueInside are also true
								   If there is any alpha, isRedInside, isGreenInside, isBlueInside may be different. */
								blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(pixelIndex, isRedInside, isGreenInside, isBlueInside, strokeAntiAliasAlphasWord);
							}
						}
						if (mustResetColor) {
							fillA = realFillAlpha;
							opaqueFillColorWord = realOpaqueFillColorWord;
							mustResetColor = 0;
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
