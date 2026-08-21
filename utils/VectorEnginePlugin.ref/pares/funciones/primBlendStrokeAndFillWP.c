/* VectorEnginePlugin>>#blendStrokeAndFillWPLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendStrokeAndFillWP(void)
{
	sqInt affectedBitsIndex;
	float alpha;
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
	uint8_t edgesThisPixel;
	uint8_t edgesUpToThisPixel;
	float foreB;
	float foreG;
	float foreR;
	sqInt idx;
	sqInt l;
	sqInt lastSegmentIndex;
	sqInt mustResetColor;
	uint32_t opaqueFillColorWord;
	uint32_t opaqueStrokeColorWord;
	sqInt pixelIndex;
	sqInt r;
	float realFillAlpha;
	uint32_t realOpaqueFillColorWord;
	uint32_t realOpaqueStrokeColorWord;
	float realStrokeAlpha;
	float resultAlpha;
	uint32_t resultAlphaBits;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	sqInt segmentLength;
	float strokeAAAlpha;
	float strokeAAUnAlpha;
	uint8_t strokeAntiAliasAlphaBits;
	sqInt t;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	sqInt toDoLimit;
	float unAlpha;

	alphasOrEdgeCountsInThisSegment = 0;
	realOpaqueFillColorWord = 0;
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
	opaqueFillColorWord = 0;
	if (targetAssumedOpaque) {
		if ((strokeA * fillA) == 1.0) {
			auxR = (((sqInt)((usqInt)((((sqInt)(strokeR + 0.5)))) << 16)));
			auxG = (((sqInt)((usqInt)((((sqInt)(strokeG + 0.5)))) << 8)));
			auxB = ((sqInt)(strokeB + 0.5));
			opaqueStrokeColorWord = ((0xFF000000U | auxR) | auxG) | auxB;
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
		edgesUpToThisPixel = 0;
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
			if (alphasOrEdgeCountsInThisSegment || (edgesUpToThisPixel != 0)) {
				aux1 = (r - displayX) + 1;
				toDoLimit = ((segmentLength < aux1) ? segmentLength : aux1);
				for (idx = 1; idx <= toDoLimit; idx += 1) {
					strokeAntiAliasAlphaBits = 0;
					if (alphasOrEdgeCountsInThisSegment) {
						edgesThisPixel = edgeCountsWP[pixelIndex];
						if (edgesThisPixel) {
							edgeCountsWP[pixelIndex] = 0;
							edgesUpToThisPixel += edgesThisPixel;
						}
						strokeAntiAliasAlphaBits = alphaMaskWP[pixelIndex];
						if (strokeAntiAliasAlphaBits) {
							alphaMaskWP[pixelIndex] = 0;
						}
					}
					if ((displayX >= clippingSpecL)
					 && (displayX <= clippingSpecR)) {
						if ((displayX == antiAliasedClippedLeftPixel)
						 || (displayX == antiAliasedClippedRightPixel)) {
							realStrokeAlpha = strokeA;
							strokeA = strokeA * 0.25;
							realFillAlpha = fillA;
							fillA = fillA * 0.25;
							realOpaqueStrokeColorWord = opaqueStrokeColorWord;
							opaqueStrokeColorWord = 0;
							realOpaqueFillColorWord = opaqueFillColorWord;
							opaqueFillColorWord = 0;
							mustResetColor = 1;
						}
						else {
							if (((displayX - 1) == antiAliasedClippedLeftPixel)
							 || ((displayX + 1) == antiAliasedClippedRightPixel)) {
								realStrokeAlpha = strokeA;
								strokeA = strokeA * 0.75;
								realFillAlpha = fillA;
								fillA = fillA * 0.75;
								realOpaqueStrokeColorWord = opaqueStrokeColorWord;
								opaqueStrokeColorWord = 0;
								realOpaqueFillColorWord = opaqueFillColorWord;
								opaqueFillColorWord = 0;
								mustResetColor = 1;
							}
						}
						if (strokeAntiAliasAlphaBits) {
							/* At least partially in the stroke. */
							if (strokeAntiAliasAlphaBits == 0x7F) {
								/* Fully inside the stroke, far from anti aliasing. */
								if (opaqueStrokeColorWord) {
									/* Stroke color is opaque. Target is too. Just overwrite with stroke color. */
									targetBits[pixelIndex] = opaqueStrokeColorWord;
									morphIds[pixelIndex] = currentMorphId;
								}
								else {
									/* Translucent color or target. Do proper blend of stroke over target. */
									blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F);
								}
							}
							else {
								/* In an anti aliased part of the stroke. Either blend stroke over background, or pre-mix stroke and fill. */
								if (edgesUpToThisPixel) {
									/* Inside the shape. Blend stroke and fill, blend result over target. */

									/* begin blendStrokeAndFillWPAt:antiAliasAlphaByte: */
									strokeAAAlpha = strokeAntiAliasAlphaBits * (1.0 / 127.0);
									strokeAAUnAlpha = 1.0 - strokeAAAlpha;
									foreR = (strokeAAAlpha * strokeR) + (strokeAAUnAlpha * fillR);
									foreG = (strokeAAAlpha * strokeG) + (strokeAAUnAlpha * fillG);
									foreB = (strokeAAAlpha * strokeB) + (strokeAAUnAlpha * fillB);
									alpha = (strokeAAAlpha * strokeA) + (strokeAAUnAlpha * fillA);
									unAlpha = 1.0 - alpha;
									targetWord = targetBits[pixelIndex];
									targetAlphaBits = targetWord & 0xFF000000U;
									targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
									resultAlpha = alpha + (unAlpha * targetAlpha);
									resultRBits = targetWord & 0xFF0000;
									resultGBits = targetWord & 0xFF00;
									resultBBits = targetWord & 0xFF;
									resultR = (alpha * foreR) + ((unAlpha * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
									resultG = (alpha * foreG) + ((unAlpha * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
									resultB = (alpha * foreB) + ((unAlpha * resultBBits) * targetAlpha);
									resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlpha * 0xFF) + 0.5)))) << 24)));
									resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlpha) + 0.5)))) << 16)));
									resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlpha) + 0.5)))) << 8)));
									resultBBits = ((sqInt)((resultB / resultAlpha) + 0.5));
									targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
									targetBits[pixelIndex] = targetWord;
									morphIds[pixelIndex] = currentMorphId;
								}
								else {
									/* In the outer anti aliasing area of the stroke. Blend stroke over background. */
									blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits);
								}
							}
						}
						else {
							/* Not in the stroke at all. Either fully in the fill, or outside the shape (pixel is unaffected). */
							if (edgesUpToThisPixel) {
								/* Fully inside the fill, far from anti aliasing. */
								if (opaqueFillColorWord) {
									/* Fill color is opaque. Target is too. Just overwrite with fill color. */
									targetBits[pixelIndex] = opaqueFillColorWord;
									morphIds[pixelIndex] = currentMorphId;
								}
								else {
									/* Translucent color or target. Do proper blend of fill over target. */
									blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F);
								}
							}
						}
						if (mustResetColor) {
							strokeA = realStrokeAlpha;
							fillA = realFillAlpha;
							opaqueStrokeColorWord = realOpaqueStrokeColorWord;
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
