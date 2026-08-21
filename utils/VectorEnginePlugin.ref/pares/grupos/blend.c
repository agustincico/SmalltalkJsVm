
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


/* ===== */


	/* VectorEnginePlugin>>#blendFillOnlyWPLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendFillOnlyWP(void)
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
	uint8_t edgesThisPixel;
	uint8_t edgesUpToThisPixel;
	sqInt idx;
	sqInt l;
	sqInt lastSegmentIndex;
	sqInt mustResetColor;
	uint32_t opaqueFillColorWord;
	sqInt pixelIndex;
	sqInt r;
	float realFillAlpha;
	uint32_t realOpaqueFillColorWord;
	sqInt segmentLength;
	uint8_t strokeAntiAliasAlphaBits;
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
						if (edgesUpToThisPixel) {
							/* Inside the shape */
							if ((opaqueFillColorWord != 0)
							 && (strokeAntiAliasAlphaBits == 0)) {
								/* Optimize common case: opaque fill, inside fill area, no anti aliasing, no clipping at this point. */
								targetBits[pixelIndex] = opaqueFillColorWord;
								morphIds[pixelIndex] = currentMorphId;
							}
							else {
								/* Inside the shape. Turn stroke anti aliasing into fill anti aliasing. */
								blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, 0x7F - strokeAntiAliasAlphaBits);
							}
						}
						else {
							/* Still in the anti aliasing area, but outside the shape, strictly speaking. */
							if (strokeAntiAliasAlphaBits) {
								blendFillOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits);
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


/* ===== */


	/* VectorEnginePlugin>>#blendStrokeAndFillLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendStrokeAndFill(void)
{
	sqInt affectedBitsIndex;
	float alphaB;
	float alphaG;
	float alphaR;
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
	float foreB;
	float foreG;
	float foreR;
	sqInt idx;
	sqInt isBlueInside;
	sqInt isGreenInside;
	sqInt isRedInside;
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
	float resultAlphaB;
	uint32_t resultAlphaBits;
	float resultAlphaG;
	float resultAlphaR;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	sqInt segmentLength;
	float strokeAABlueAlpha;
	uint32_t strokeAABlueAlphaBits;
	float strokeAAGreenAlpha;
	uint32_t strokeAAGreenAlphaBits;
	float strokeAARedAlpha;
	uint32_t strokeAARedAlphaBits;
	uint32_t strokeAntiAliasAlphasWord;
	sqInt t;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	sqInt toDoLimit;
	float unAlphaB;
	float unAlphaG;
	float unAlphaR;

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
						if (strokeAntiAliasAlphasWord) {
							/* At least one subpixel in the stroke. */
							if (strokeAntiAliasAlphasWord == 0x7F7F7F) {
								/* Fully inside the stroke, far from anti aliasing. */
								if (opaqueStrokeColorWord) {
									/* Stroke color is opaque. Target is too. Just overwrite with stroke color. */
									targetBits[pixelIndex] = opaqueStrokeColorWord;
									morphIds[pixelIndex] = currentMorphId;
								}
								else {
									/* Translucent color or target. Do proper blend of stroke over target. */
									blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, 0x7F7F7F);
								}
							}
							else {
								/* In an anti aliased part of the stroke. Either blend stroke over background, or pre-mix stroke and fill. */

								/* begin blendStrokeAndFillAt:redIsInside:greenIsInside:blueIsInside:antiAliasAlphasWord: */
								strokeAARedAlphaBits = strokeAntiAliasAlphasWord & 0x7F0000;
								strokeAAGreenAlphaBits = strokeAntiAliasAlphasWord & 0x7F00;
								strokeAABlueAlphaBits = strokeAntiAliasAlphasWord & 0x7F;
								strokeAARedAlpha = strokeAARedAlphaBits * (1.0 / (8.323072e6));
								strokeAAGreenAlpha = strokeAAGreenAlphaBits * (1.0 / (32512.0));
								strokeAABlueAlpha = strokeAABlueAlphaBits * (1.0 / 127.0);
								if (isRedInside) {
									/* Do gradient between stroke and fill. Blend the result over background */
									alphaR = (strokeAARedAlpha * strokeA) + ((1.0 - strokeAARedAlpha) * fillA);
									foreR = (strokeAARedAlpha * strokeR) + ((1.0 - strokeAARedAlpha) * fillR);
								}
								else {
									/* Blend stroke over background */
									alphaR = strokeAARedAlpha * strokeA;
									foreR = strokeR;
								}
								if (isGreenInside) {
									/* Do gradient between stroke and fill. Blend the result over background */
									alphaG = (strokeAAGreenAlpha * strokeA) + ((1.0 - strokeAAGreenAlpha) * fillA);
									foreG = (strokeAAGreenAlpha * strokeG) + ((1.0 - strokeAAGreenAlpha) * fillG);
								}
								else {
									/* Blend stroke over background */
									alphaG = strokeAAGreenAlpha * strokeA;
									foreG = strokeG;
								}
								if (isBlueInside) {
									/* Do gradient between stroke and fill. Blend the result over background */
									alphaB = (strokeAABlueAlpha * strokeA) + ((1.0 - strokeAABlueAlpha) * fillA);
									foreB = (strokeAABlueAlpha * strokeB) + ((1.0 - strokeAABlueAlpha) * fillB);
								}
								else {
									/* Blend stroke over background */
									alphaB = strokeAABlueAlpha * strokeA;
									foreB = strokeB;
								}
								targetWord = targetBits[pixelIndex];
								targetAlphaBits = targetWord & 0xFF000000U;
								targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
								resultAlphaBits = targetAlphaBits;
								resultRBits = targetWord & 0xFF0000;
								resultGBits = targetWord & 0xFF00;
								resultBBits = targetWord & 0xFF;

								/* These if are not really needed. just ignore them if we use simd instructions. */
								if (!(alphaR == 0.0)) {
									unAlphaR = 1.0 - alphaR;
									resultAlphaR = alphaR + (unAlphaR * targetAlpha);
									resultR = (alphaR * foreR) + ((unAlphaR * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
									resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlphaR) + 0.5)))) << 16)));
								}
								if (!(alphaG == 0.0)) {
									unAlphaG = 1.0 - alphaG;
									resultAlphaG = alphaG + (unAlphaG * targetAlpha);
									resultG = (alphaG * foreG) + ((unAlphaG * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
									resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlphaG) + 0.5)))) << 8)));
									resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlphaG * 255.0) + 0.5)))) << 24)));
								}
								if (!(alphaB == 0.0)) {
									unAlphaB = 1.0 - alphaB;
									resultAlphaB = alphaB + (unAlphaB * targetAlpha);
									resultB = (alphaB * foreB) + ((unAlphaB * resultBBits) * targetAlpha);
									resultBBits = ((sqInt)((resultB / resultAlphaB) + 0.5));
								}
								targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
								targetBits[pixelIndex] = targetWord;
								morphIds[pixelIndex] = currentMorphId;
							}
						}
						else {
							/* Not in the stroke at all. Either fully in the fill, or outside the shape (pixel is unaffected). */
							if (isGreenInside) {
								/* Fully inside the fill, far from anti aliasing. (Here isGreenInside also implies isRedInside and isBlueInside) */
								if (opaqueFillColorWord) {
									/* Fill color is opaque. Target is too. Just overwrite with fill color. */
									targetBits[pixelIndex] = opaqueFillColorWord;
									morphIds[pixelIndex] = currentMorphId;
								}
								else {
									/* Translucent color or target. Do proper blend of fill over target. */
									blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(pixelIndex, isRedInside, isGreenInside, isBlueInside, strokeAntiAliasAlphasWord);
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


/* ===== */


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


/* ===== */


	/* VectorEnginePlugin>>#blendStrokeOnlyLeft:top:right:bottom: */
EXPORT(sqInt)
primBlendStrokeOnly(void)
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
	uint32_t strokeAntiAliasAlphasWord;
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
					strokeAntiAliasAlphasWord = alphaMask[pixelIndex];
					if (strokeAntiAliasAlphasWord) {
						alphaMask[pixelIndex] = 0;
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
							 && (strokeAntiAliasAlphasWord == 0x7F7F7F)) {
								/* Fully inside the stroke, far from anti aliasing. Color is opaque. Target is too. Just overwrite with stroke color. */
								targetBits[pixelIndex] = opaqueStrokeColorWord;
								morphIds[pixelIndex] = currentMorphId;
							}
							else {
								/* At least one subpixel in the anti aliasing area of the stroke, or color is translucent, or target translucency is desired. */
								blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, strokeAntiAliasAlphasWord);
							}
						}
						if (mustResetColor) {
							strokeA = realStrokeAlpha;
							opaqueStrokeColorWord = realOpaqueStrokeColorWord;
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


/* ===== */


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

	/* VectorEnginePlugin>>#blendFillOnlyAt:redIsInside:greenIsInside:blueIsInside:antiAliasAlphasWord: */
static sqInt
blendFillOnlyAtredIsInsidegreenIsInsideblueIsInsideantiAliasAlphasWord(sqInt pixelIndex, sqInt isRedInside, sqInt isGreenInside, sqInt isBlueInside, uint32_t strokeAntiAliasAlphasWord)
{
	float alphaB;
	uint32_t alphaBBits;
	float alphaG;
	uint32_t alphaGBits;
	float alphaR;
	uint32_t alphaRBits;
	float resultAlphaB;
	uint32_t resultAlphaBits;
	float resultAlphaG;
	float resultAlphaR;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	float unAlphaB;
	float unAlphaG;
	float unAlphaR;


	/* In this method, antiAliasAlphas are not used to blend stroke, but fill. This means that in the inside of the shape, and away from the stroke, they must be 1.0 (not 0.0). */
	alphaRBits = strokeAntiAliasAlphasWord & 0x7F0000;
	alphaGBits = strokeAntiAliasAlphasWord & 0x7F00;
	alphaBBits = strokeAntiAliasAlphasWord & 0x7F;
	if (isRedInside) {
		alphaRBits = 0x7F0000 - alphaRBits;
	}
	if (isGreenInside) {
		alphaGBits = 0x7F00 - alphaGBits;
	}
	if (isBlueInside) {
		alphaBBits = 0x7F - alphaBBits;
	}
	alphaR = alphaRBits * (1.0 / (8.323072e6));
	alphaG = alphaGBits * (1.0 / (32512.0));
	alphaB = alphaBBits * (1.0 / 127.0);
	alphaR = alphaR * fillA;
	alphaG = alphaG * fillA;
	alphaB = alphaB * fillA;
	targetWord = targetBits[pixelIndex];
	targetAlphaBits = targetWord & 0xFF000000U;
	targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
	resultAlphaBits = targetAlphaBits;
	resultRBits = targetWord & 0xFF0000;
	resultGBits = targetWord & 0xFF00;
	resultBBits = targetWord & 0xFF;

	/* These if are not really needed. just ignore them if we use simd instructions. */
	if (!(alphaR == 0.0)) {
		unAlphaR = 1.0 - alphaR;
		resultAlphaR = alphaR + (unAlphaR * targetAlpha);
		resultR = (alphaR * fillR) + ((unAlphaR * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
		resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlphaR) + 0.5)))) << 16)));
	}
	if (!(alphaG == 0.0)) {
		unAlphaG = 1.0 - alphaG;
		resultAlphaG = alphaG + (unAlphaG * targetAlpha);
		resultG = (alphaG * fillG) + ((unAlphaG * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
		resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlphaG) + 0.5)))) << 8)));
		resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlphaG * 255.0) + 0.5)))) << 24)));
	}
	if (!(alphaB == 0.0)) {
		unAlphaB = 1.0 - alphaB;
		resultAlphaB = alphaB + (unAlphaB * targetAlpha);
		resultB = (alphaB * fillB) + ((unAlphaB * resultBBits) * targetAlpha);
		resultBBits = ((sqInt)((resultB / resultAlphaB) + 0.5));
	}
	targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
	targetBits[pixelIndex] = targetWord;
	morphIds[pixelIndex] = currentMorphId;
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#blendFillOnlyWPAt:antiAliasAlphaByte: */
static sqInt
blendFillOnlyWPAtantiAliasAlphaByte(sqInt pixelIndex, uint8_t antiAliasAlphaBits)
{
	float alpha;
	float resultAlpha;
	uint32_t resultAlphaBits;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	float unAlpha;

	alpha = antiAliasAlphaBits * (1.0 / 127.0);
	alpha = alpha * fillA;
	unAlpha = 1.0 - alpha;
	targetWord = targetBits[pixelIndex];
	targetAlphaBits = targetWord & 0xFF000000U;
	targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
	resultAlpha = alpha + (unAlpha * targetAlpha);
	resultRBits = targetWord & 0xFF0000;
	resultGBits = targetWord & 0xFF00;
	resultBBits = targetWord & 0xFF;
	resultR = (alpha * fillR) + ((unAlpha * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
	resultG = (alpha * fillG) + ((unAlpha * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
	resultB = (alpha * fillB) + ((unAlpha * resultBBits) * targetAlpha);
	resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlpha * 0xFF) + 0.5)))) << 24)));
	resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlpha) + 0.5)))) << 16)));
	resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlpha) + 0.5)))) << 8)));
	resultBBits = ((sqInt)((resultB / resultAlpha) + 0.5));
	targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
	targetBits[pixelIndex] = targetWord;
	morphIds[pixelIndex] = currentMorphId;
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#blendStrokeOnlyAt:antiAliasAlphasWord: */
static sqInt
blendStrokeOnlyAtantiAliasAlphasWord(sqInt pixelIndex, uint32_t strokeAntiAliasAlphasWord)
{
	float alphaB;
	uint32_t alphaBBits;
	float alphaG;
	uint32_t alphaGBits;
	float alphaR;
	uint32_t alphaRBits;
	float resultAlphaB;
	uint32_t resultAlphaBits;
	float resultAlphaG;
	float resultAlphaR;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	float unAlphaB;
	float unAlphaG;
	float unAlphaR;

	alphaRBits = strokeAntiAliasAlphasWord & 0x7F0000;
	alphaGBits = strokeAntiAliasAlphasWord & 0x7F00;
	alphaBBits = strokeAntiAliasAlphasWord & 0x7F;
	alphaR = alphaRBits * (1.0 / (8.323072e6));
	alphaG = alphaGBits * (1.0 / (32512.0));
	alphaB = alphaBBits * (1.0 / 127.0);
	alphaR = alphaR * strokeA;
	alphaG = alphaG * strokeA;
	alphaB = alphaB * strokeA;
	targetWord = targetBits[pixelIndex];
	targetAlphaBits = targetWord & 0xFF000000U;
	targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
	resultAlphaBits = targetAlphaBits;
	resultRBits = targetWord & 0xFF0000;
	resultGBits = targetWord & 0xFF00;
	resultBBits = targetWord & 0xFF;

	/* These if are not really needed. just ignore them if we use simd instructions. */
	if (!(alphaR == 0.0)) {
		unAlphaR = 1.0 - alphaR;
		resultAlphaR = alphaR + (unAlphaR * targetAlpha);
		resultR = (alphaR * strokeR) + ((unAlphaR * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
		resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlphaR) + 0.5)))) << 16)));
	}
	if (!(alphaG == 0.0)) {
		unAlphaG = 1.0 - alphaG;
		resultAlphaG = alphaG + (unAlphaG * targetAlpha);
		resultG = (alphaG * strokeG) + ((unAlphaG * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
		resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlphaG) + 0.5)))) << 8)));
		resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlphaG * 255.0) + 0.5)))) << 24)));
	}
	if (!(alphaB == 0.0)) {
		unAlphaB = 1.0 - alphaB;
		resultAlphaB = alphaB + (unAlphaB * targetAlpha);
		resultB = (alphaB * strokeB) + ((unAlphaB * resultBBits) * targetAlpha);
		resultBBits = ((sqInt)((resultB / resultAlphaB) + 0.5));
	}
	targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
	targetBits[pixelIndex] = targetWord;
	morphIds[pixelIndex] = currentMorphId;
	return 0;
}


/* ===== */


	/* VectorEnginePlugin>>#blendStrokeOnlyWPAt:antiAliasAlphaByte: */
static sqInt
blendStrokeOnlyWPAtantiAliasAlphaByte(sqInt pixelIndex, uint8_t strokeAntiAliasAlphaBits)
{
	float alpha;
	float resultAlpha;
	uint32_t resultAlphaBits;
	float resultB;
	uint32_t resultBBits;
	float resultG;
	uint32_t resultGBits;
	float resultR;
	uint32_t resultRBits;
	float targetAlpha;
	uint32_t targetAlphaBits;
	uint32_t targetWord;
	float unAlpha;

	alpha = strokeAntiAliasAlphaBits * (1.0 / 127.0);
	alpha = alpha * strokeA;
	unAlpha = 1.0 - alpha;
	targetWord = targetBits[pixelIndex];
	targetAlphaBits = targetWord & 0xFF000000U;
	targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
	resultAlpha = alpha + (unAlpha * targetAlpha);
	resultRBits = targetWord & 0xFF0000;
	resultGBits = targetWord & 0xFF00;
	resultBBits = targetWord & 0xFF;
	resultR = (alpha * strokeR) + ((unAlpha * ((((usqInt)(resultRBits)) >> 16))) * targetAlpha);
	resultG = (alpha * strokeG) + ((unAlpha * ((((usqInt)(resultGBits)) >> 8))) * targetAlpha);
	resultB = (alpha * strokeB) + ((unAlpha * resultBBits) * targetAlpha);
	resultAlphaBits = (((sqInt)((usqInt)((((sqInt)((resultAlpha * 0xFF) + 0.5)))) << 24)));
	resultRBits = (((sqInt)((usqInt)((((sqInt)((resultR / resultAlpha) + 0.5)))) << 16)));
	resultGBits = (((sqInt)((usqInt)((((sqInt)((resultG / resultAlpha) + 0.5)))) << 8)));
	resultBBits = ((sqInt)((resultB / resultAlpha) + 0.5));
	targetWord = ((resultAlphaBits | resultRBits) | resultGBits) | resultBBits;
	targetBits[pixelIndex] = targetWord;
	morphIds[pixelIndex] = currentMorphId;
	return 0;
}
