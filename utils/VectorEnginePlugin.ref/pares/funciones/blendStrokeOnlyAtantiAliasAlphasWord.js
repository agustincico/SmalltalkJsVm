/* VectorEnginePlugin>>#blendStrokeOnlyAt:antiAliasAlphasWord: */
function blendStrokeOnlyAtantiAliasAlphasWord(pixelIndex, strokeAntiAliasAlphasWord) {
    var alphaB, alphaBBits, alphaG, alphaGBits, alphaR, alphaRBits;
    var resultAlphaB, resultAlphaBits, resultAlphaG, resultAlphaR;
    var resultB, resultBBits, resultG, resultGBits, resultR, resultRBits;
    var targetAlpha, targetAlphaBits, targetWord;
    var unAlphaB, unAlphaG, unAlphaR;

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
    targetAlphaBits = (targetWord & 0xFF000000) >>> 0;
    targetAlpha = targetAlphaBits * (1.0 / (4.27819008e9));
    resultAlphaBits = targetAlphaBits;
    resultRBits = targetWord & 0xFF0000;
    resultGBits = targetWord & 0xFF00;
    resultBBits = targetWord & 0xFF;

    /* These if are not really needed. just ignore them if we use simd instructions. */
    if (!(alphaR === 0.0)) {
        unAlphaR = 1.0 - alphaR;
        resultAlphaR = alphaR + (unAlphaR * targetAlpha);
        resultR = (alphaR * strokeR) + ((unAlphaR * (resultRBits >>> 16)) * targetAlpha);
        resultRBits = (Math.trunc((resultR / resultAlphaR) + 0.5) << 16) >>> 0;
    }
    if (!(alphaG === 0.0)) {
        unAlphaG = 1.0 - alphaG;
        resultAlphaG = alphaG + (unAlphaG * targetAlpha);
        resultG = (alphaG * strokeG) + ((unAlphaG * (resultGBits >>> 8)) * targetAlpha);
        resultGBits = (Math.trunc((resultG / resultAlphaG) + 0.5) << 8) >>> 0;
        resultAlphaBits = (Math.trunc((resultAlphaG * 255.0) + 0.5) << 24) >>> 0;
    }
    if (!(alphaB === 0.0)) {
        unAlphaB = 1.0 - alphaB;
        resultAlphaB = alphaB + (unAlphaB * targetAlpha);
        resultB = (alphaB * strokeB) + ((unAlphaB * resultBBits) * targetAlpha);
        resultBBits = Math.trunc((resultB / resultAlphaB) + 0.5);
    }
    targetWord = (((resultAlphaBits | resultRBits) | resultGBits) | resultBBits) >>> 0;
    targetBits[pixelIndex] = targetWord;
    morphIds[pixelIndex] = currentMorphId;
    return 0;
}
