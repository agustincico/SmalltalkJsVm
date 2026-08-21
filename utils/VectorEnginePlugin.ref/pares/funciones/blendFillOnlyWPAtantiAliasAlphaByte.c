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
