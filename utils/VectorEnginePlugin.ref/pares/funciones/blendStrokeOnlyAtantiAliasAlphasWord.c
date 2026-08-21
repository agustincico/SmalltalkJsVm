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
