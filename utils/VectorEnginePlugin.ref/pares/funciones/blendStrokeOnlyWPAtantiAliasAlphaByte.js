/* VectorEnginePlugin>>#blendStrokeOnlyWPAt:antiAliasAlphaByte: */
function blendStrokeOnlyWPAtantiAliasAlphaByte(pixelIndex, strokeAntiAliasAlphaBits) {
    var alpha;
    var resultAlpha, resultAlphaBits;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlpha;

    alpha = strokeAntiAliasAlphaBits * (1.0 / 127.0);
    alpha = alpha * strokeA;
    unAlpha = 1.0 - alpha;
    targetWord = targetBits[pixelIndex];
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlpha = alpha + (unAlpha * targetAlpha);
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;
    resultR = (alpha * strokeR) + ((unAlpha * (resultRBits >>> 16)) * targetAlpha);
    resultG = (alpha * strokeG) + ((unAlpha * (resultGBits >>> 8)) * targetAlpha);
    resultB = (alpha * strokeB) + ((unAlpha * resultBBits) * targetAlpha);
    resultAlphaBits = (Math.trunc((resultAlpha * 0xFF) + 0.5) << 24) >>> 0;
    resultRBits = (Math.trunc((resultR / resultAlpha) + 0.5) << 16) >>> 0;
    resultGBits = (Math.trunc((resultG / resultAlpha) + 0.5) << 8) >>> 0;
    resultBBits = Math.trunc((resultB / resultAlpha) + 0.5);
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}
