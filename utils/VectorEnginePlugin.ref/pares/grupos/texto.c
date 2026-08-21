
	/* VectorEnginePlugin>>#displayByteString:from:to:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayByteString(void)
{
	char *aByteString;
	float advanceWidth;
	float aux1;
	uint8_t byte;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	sqInt startIndex;
	float startX;
	float startY;
	sqInt stopIndex;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isBytes(stackValue(8)))
		 && ((isIntegerObject((startIndex = stackValue(7))))
		 && ((isIntegerObject((stopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aByteString = firstIndexableField(stackValue(8));
	startIndex = integerValueOf(startIndex);
	stopIndex = integerValueOf(stopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (startIndex - 1); index < stopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		byte = aByteString[index];
		i = contourDataIndexes[byte];
		if (i < 1) {
			i = 1;
		}
		iSqInt = i;
		iSqInt -= 1;
		advanceWidth = contourData[iSqInt];

		/* boundsLeft := contourData at: i+1.
		   boundsRight := contourData at: i+2.
		   boundsBottom := contourData at: i+3.
		   boundsTop := contourData at: i+4. */
		iSqInt += 5;
		numContours = ((sqInt)(contourData[iSqInt]));
		iSqInt += 1;
		for (idx = 1; idx <= numContours; idx += 1) {
			numBeziers = ((sqInt)(contourData[iSqInt]));
			ttX = (contourData[iSqInt + 1]) + nextGlyphX;
			ttY = (contourData[iSqInt + 2]) + nextGlyphY;
			iSqInt += 3;
			contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
			contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

			/* begin initializeTrajectoryFragment */
			prevYTruncated = 0x7FFFFFFF;
			for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
				ttX = contourData[iSqInt];
				ttY = contourData[iSqInt + 1];
				endX = ((ttX * txA11) + (ttY * txA12)) + startX;
				endY = ((ttX * txA21) + (ttY * txA22)) + startY;
				ttX = contourData[iSqInt + 2];
				ttY = contourData[iSqInt + 3];
				controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
				controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
				iSqInt += 4;

				/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
				xMinEnd = ((startX < endX) ? startX : endX);
				xMaxEnd = ((startX < endX) ? endX : startX);
				yMinEnd = ((startY < endY) ? startY : endY);
				yMaxEnd = ((startY < endY) ? endY : startY);
				spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
				spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
				spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
				spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

				/* Compute Quadratic Bezier Curve,
				   Case t = 0.0 */
				x = startX;
				y = startY;
				updateAlphasForXy(x, y);
				updateEdgeCountAtXy(x, y);

				/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
				dx = fabsf(endX - startX);
				dy = fabsf(endY - startY);
				aux1 = ((dx < dy) ? dy : dx);
				aux1 = 0.5 / aux1;
				increment = ((aux1 < 0.5) ? aux1 : 0.5);
				t = 0.0;
				while (1) {
					t0 = t;
					x0 = x;
					y0 = y;

					/* Compute next point */
					t = t0 + increment;
					oneLessT = 1.0 - t;
					f1 = oneLessT * oneLessT;
					f2 = (2.0 * oneLessT) * t;
					f3 = t * t;
					x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
					y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

					/* Now adjust the increment to aim at the required hop length, and recompute next point. */
					dx = x - x0;
					dy = y - y0;
					length = sqrt((dx * dx) + (dy * dy));

					/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
					correction = hop / (((length < 0.1) ? 0.1 : length));
					do {
						increment = increment * correction;
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
					} while(correction < 0.99);
					if (!(t < 1.0)) break;
					updateAlphasForXy(x, y);
					updateEdgeCountAtXy(x, y);
				}

				/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
				   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
				startX = endX;
				startY = endY;
			}
			updateAlphasForXy(endX, endY);
			updateEdgeCountAtXy(endX, endY);

			/* Similar effect to ensureClosePath in #finishPath:,
			   but assume the TrueType definition is essentially right, and there might only be a rounding error.
			   So, don't draw a line, but just (possibly) correct edgeCounts. The possibility of rounding error is most likely zero.
			   Anyway, this is cheap. */
			updateEdgeCountAtXy(contourStartX, contourStartY);
		}
		nextGlyphX += advanceWidth;
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#displayByteStringWP:from:to:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayByteStringWP(void)
{
	char *aByteString;
	float advanceWidth;
	float aux1;
	uint8_t byte;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	sqInt startIndex;
	float startX;
	float startY;
	sqInt stopIndex;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isBytes(stackValue(8)))
		 && ((isIntegerObject((startIndex = stackValue(7))))
		 && ((isIntegerObject((stopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aByteString = firstIndexableField(stackValue(8));
	startIndex = integerValueOf(startIndex);
	stopIndex = integerValueOf(stopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (startIndex - 1); index < stopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		byte = aByteString[index];
		i = contourDataIndexes[byte];
		if (i < 1) {
			i = 1;
		}
		iSqInt = i;
		iSqInt -= 1;
		advanceWidth = contourData[iSqInt];

		/* boundsLeft := contourData at: i+1.
		   boundsRight := contourData at: i+2.
		   boundsBottom := contourData at: i+3.
		   boundsTop := contourData at: i+4. */
		iSqInt += 5;
		numContours = ((sqInt)(contourData[iSqInt]));
		iSqInt += 1;
		for (idx = 1; idx <= numContours; idx += 1) {
			numBeziers = ((sqInt)(contourData[iSqInt]));
			ttX = (contourData[iSqInt + 1]) + nextGlyphX;
			ttY = (contourData[iSqInt + 2]) + nextGlyphY;
			iSqInt += 3;
			contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
			contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

			/* begin initializeTrajectoryFragment */
			prevYTruncated = 0x7FFFFFFF;
			for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
				ttX = contourData[iSqInt];
				ttY = contourData[iSqInt + 1];
				endX = ((ttX * txA11) + (ttY * txA12)) + startX;
				endY = ((ttX * txA21) + (ttY * txA22)) + startY;
				ttX = contourData[iSqInt + 2];
				ttY = contourData[iSqInt + 3];
				controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
				controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
				iSqInt += 4;

				/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
				xMinEnd = ((startX < endX) ? startX : endX);
				xMaxEnd = ((startX < endX) ? endX : startX);
				yMinEnd = ((startY < endY) ? startY : endY);
				yMaxEnd = ((startY < endY) ? endY : startY);
				spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
				spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
				spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
				spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

				/* Compute Quadratic Bezier Curve,
				   Case t = 0.0 */
				x = startX;
				y = startY;
				updateAlphasWPZeroStrokeForXy(x, y);
				updateEdgeCountWPAtXy(x, y);

				/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
				dx = fabsf(endX - startX);
				dy = fabsf(endY - startY);
				aux1 = ((dx < dy) ? dy : dx);
				aux1 = 0.5 / aux1;
				increment = ((aux1 < 0.5) ? aux1 : 0.5);
				t = 0.0;
				while (1) {
					t0 = t;
					x0 = x;
					y0 = y;

					/* Compute next point */
					t = t0 + increment;
					oneLessT = 1.0 - t;
					f1 = oneLessT * oneLessT;
					f2 = (2.0 * oneLessT) * t;
					f3 = t * t;
					x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
					y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

					/* Now adjust the increment to aim at the required hop length, and recompute next point. */
					dx = x - x0;
					dy = y - y0;
					length = sqrt((dx * dx) + (dy * dy));

					/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
					correction = hop / (((length < 0.1) ? 0.1 : length));
					do {
						increment = increment * correction;
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
					} while(correction < 0.99);
					if (!(t < 1.0)) break;
					updateAlphasWPZeroStrokeForXy(x, y);
					updateEdgeCountWPAtXy(x, y);
				}

				/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
				   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
				startX = endX;
				startY = endY;
			}
			updateAlphasWPZeroStrokeForXy(endX, endY);
			updateEdgeCountWPAtXy(endX, endY);

			/* Similar effect to ensureClosePath in #finishPath:,
			   but assume the TrueType definition is essentially right, and there might only be a rounding error.
			   So, don't draw a line, but just (possibly) correct edgeCountsWP. The possibility of rounding error is most likely zero.
			   Anyway, this is cheap. */
			updateEdgeCountWPAtXy(contourStartX, contourStartY);
		}
		nextGlyphX += advanceWidth;
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#displayUtf32:from:to:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayUtf32(void)
{
	float advanceWidth;
	float aux1;
	unsigned *aWordArray;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	sqInt startIndex;
	float startX;
	float startY;
	sqInt stopIndex;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	sqInt utf32;
	sqInt utf8Byte;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isWords(stackValue(8)))
		 && ((isIntegerObject((startIndex = stackValue(7))))
		 && ((isIntegerObject((stopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aWordArray = firstIndexableField(stackValue(8));
	startIndex = integerValueOf(startIndex);
	stopIndex = integerValueOf(stopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (startIndex - 1); index < stopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		utf32 = aWordArray[index];
		iSqInt = (utf32 <= 0x7F
					? ((utf8Byte = utf32),
					contourDataIndexes[utf8Byte])
					: (utf32 <= 0x7FF
							? ((utf8Byte = ((((usqInt)(utf32)) >> 6)) | 192),
							(i = contourDataIndexes[utf8Byte]),
							(utf8Byte = (utf32 & 0x3F) | 128),
							contourDataIndexes[utf8Byte - i])
							: (utf32 <= 0xFFFF
									? ((utf8Byte = ((((usqInt)(utf32)) >> 12)) | 224),
									(i = contourDataIndexes[utf8Byte]),
									(utf8Byte = (((((usqInt)(utf32)) >> 6)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (utf32 & 0x3F) | 128),
									contourDataIndexes[utf8Byte - i])
									: ((utf8Byte = ((((usqInt)(utf32)) >> 18)) | 240),
									(i = contourDataIndexes[utf8Byte]),
									(utf8Byte = (((((usqInt)(utf32)) >> 12)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (((((usqInt)(utf32)) >> 6)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (utf32 & 0x3F) | 128),
									contourDataIndexes[utf8Byte - i]))));
		iSqInt -= 1;
		advanceWidth = contourData[iSqInt];

		/* boundsLeft := contourData at: i+1.
		   boundsRight := contourData at: i+2.
		   boundsBottom := contourData at: i+3.
		   boundsTop := contourData at: i+4. */
		iSqInt += 5;
		numContours = ((sqInt)(contourData[iSqInt]));
		iSqInt += 1;
		for (idx = 1; idx <= numContours; idx += 1) {
			numBeziers = ((sqInt)(contourData[iSqInt]));
			ttX = (contourData[iSqInt + 1]) + nextGlyphX;
			ttY = (contourData[iSqInt + 2]) + nextGlyphY;
			iSqInt += 3;
			contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
			contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

			/* begin initializeTrajectoryFragment */
			prevYTruncated = 0x7FFFFFFF;
			for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
				ttX = contourData[iSqInt];
				ttY = contourData[iSqInt + 1];
				endX = ((ttX * txA11) + (ttY * txA12)) + startX;
				endY = ((ttX * txA21) + (ttY * txA22)) + startY;
				ttX = contourData[iSqInt + 2];
				ttY = contourData[iSqInt + 3];
				controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
				controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
				iSqInt += 4;

				/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
				xMinEnd = ((startX < endX) ? startX : endX);
				xMaxEnd = ((startX < endX) ? endX : startX);
				yMinEnd = ((startY < endY) ? startY : endY);
				yMaxEnd = ((startY < endY) ? endY : startY);
				spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
				spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
				spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
				spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

				/* Compute Quadratic Bezier Curve,
				   Case t = 0.0 */
				x = startX;
				y = startY;
				updateAlphasForXy(x, y);
				updateEdgeCountAtXy(x, y);

				/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
				dx = fabsf(endX - startX);
				dy = fabsf(endY - startY);
				aux1 = ((dx < dy) ? dy : dx);
				aux1 = 0.5 / aux1;
				increment = ((aux1 < 0.5) ? aux1 : 0.5);
				t = 0.0;
				while (1) {
					t0 = t;
					x0 = x;
					y0 = y;

					/* Compute next point */
					t = t0 + increment;
					oneLessT = 1.0 - t;
					f1 = oneLessT * oneLessT;
					f2 = (2.0 * oneLessT) * t;
					f3 = t * t;
					x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
					y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

					/* Now adjust the increment to aim at the required hop length, and recompute next point. */
					dx = x - x0;
					dy = y - y0;
					length = sqrt((dx * dx) + (dy * dy));

					/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
					correction = hop / (((length < 0.1) ? 0.1 : length));
					do {
						increment = increment * correction;
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
					} while(correction < 0.99);
					if (!(t < 1.0)) break;
					updateAlphasForXy(x, y);
					updateEdgeCountAtXy(x, y);
				}

				/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
				   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
				startX = endX;
				startY = endY;
			}
			updateAlphasForXy(endX, endY);
			updateEdgeCountAtXy(endX, endY);

			/* Similar effect to ensureClosePath in #finishPath:,
			   but assume the TrueType definition is essentially right, and there might only be a rounding error.
			   So, don't draw a line, but just (possibly) correct edgeCounts. The possibility of rounding error is most likely zero.
			   Anyway, this is cheap. */
			updateEdgeCountAtXy(contourStartX, contourStartY);
		}
		nextGlyphX += advanceWidth;
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#displayUtf32WP:from:to:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayUtf32WP(void)
{
	float advanceWidth;
	float aux1;
	unsigned *aWordArray;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	sqInt startIndex;
	float startX;
	float startY;
	sqInt stopIndex;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	sqInt utf32;
	sqInt utf8Byte;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isWords(stackValue(8)))
		 && ((isIntegerObject((startIndex = stackValue(7))))
		 && ((isIntegerObject((stopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aWordArray = firstIndexableField(stackValue(8));
	startIndex = integerValueOf(startIndex);
	stopIndex = integerValueOf(stopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (startIndex - 1); index < stopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		utf32 = aWordArray[index];
		iSqInt = (utf32 <= 0x7F
					? ((utf8Byte = utf32),
					contourDataIndexes[utf8Byte])
					: (utf32 <= 0x7FF
							? ((utf8Byte = ((((usqInt)(utf32)) >> 6)) | 192),
							(i = contourDataIndexes[utf8Byte]),
							(utf8Byte = (utf32 & 0x3F) | 128),
							contourDataIndexes[utf8Byte - i])
							: (utf32 <= 0xFFFF
									? ((utf8Byte = ((((usqInt)(utf32)) >> 12)) | 224),
									(i = contourDataIndexes[utf8Byte]),
									(utf8Byte = (((((usqInt)(utf32)) >> 6)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (utf32 & 0x3F) | 128),
									contourDataIndexes[utf8Byte - i])
									: ((utf8Byte = ((((usqInt)(utf32)) >> 18)) | 240),
									(i = contourDataIndexes[utf8Byte]),
									(utf8Byte = (((((usqInt)(utf32)) >> 12)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (((((usqInt)(utf32)) >> 6)) & 0x3F) | 128),
									(i = contourDataIndexes[utf8Byte - i]),
									(utf8Byte = (utf32 & 0x3F) | 128),
									contourDataIndexes[utf8Byte - i]))));
		iSqInt -= 1;
		advanceWidth = contourData[iSqInt];

		/* boundsLeft := contourData at: i+1.
		   boundsRight := contourData at: i+2.
		   boundsBottom := contourData at: i+3.
		   boundsTop := contourData at: i+4. */
		iSqInt += 5;
		numContours = ((sqInt)(contourData[iSqInt]));
		iSqInt += 1;
		for (idx = 1; idx <= numContours; idx += 1) {
			numBeziers = ((sqInt)(contourData[iSqInt]));
			ttX = (contourData[iSqInt + 1]) + nextGlyphX;
			ttY = (contourData[iSqInt + 2]) + nextGlyphY;
			iSqInt += 3;
			contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
			contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

			/* begin initializeTrajectoryFragment */
			prevYTruncated = 0x7FFFFFFF;
			for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
				ttX = contourData[iSqInt];
				ttY = contourData[iSqInt + 1];
				endX = ((ttX * txA11) + (ttY * txA12)) + startX;
				endY = ((ttX * txA21) + (ttY * txA22)) + startY;
				ttX = contourData[iSqInt + 2];
				ttY = contourData[iSqInt + 3];
				controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
				controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
				iSqInt += 4;

				/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
				xMinEnd = ((startX < endX) ? startX : endX);
				xMaxEnd = ((startX < endX) ? endX : startX);
				yMinEnd = ((startY < endY) ? startY : endY);
				yMaxEnd = ((startY < endY) ? endY : startY);
				spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
				spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
				spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
				spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

				/* Compute Quadratic Bezier Curve,
				   Case t = 0.0 */
				x = startX;
				y = startY;
				updateAlphasWPZeroStrokeForXy(x, y);
				updateEdgeCountWPAtXy(x, y);

				/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
				dx = fabsf(endX - startX);
				dy = fabsf(endY - startY);
				aux1 = ((dx < dy) ? dy : dx);
				aux1 = 0.5 / aux1;
				increment = ((aux1 < 0.5) ? aux1 : 0.5);
				t = 0.0;
				while (1) {
					t0 = t;
					x0 = x;
					y0 = y;

					/* Compute next point */
					t = t0 + increment;
					oneLessT = 1.0 - t;
					f1 = oneLessT * oneLessT;
					f2 = (2.0 * oneLessT) * t;
					f3 = t * t;
					x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
					y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

					/* Now adjust the increment to aim at the required hop length, and recompute next point. */
					dx = x - x0;
					dy = y - y0;
					length = sqrt((dx * dx) + (dy * dy));

					/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
					correction = hop / (((length < 0.1) ? 0.1 : length));
					do {
						increment = increment * correction;
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
					} while(correction < 0.99);
					if (!(t < 1.0)) break;
					updateAlphasWPZeroStrokeForXy(x, y);
					updateEdgeCountWPAtXy(x, y);
				}

				/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
				   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
				startX = endX;
				startY = endY;
			}
			updateAlphasWPZeroStrokeForXy(endX, endY);
			updateEdgeCountWPAtXy(endX, endY);

			/* Similar effect to ensureClosePath in #finishPath:,
			   but assume the TrueType definition is essentially right, and there might only be a rounding error.
			   So, don't draw a line, but just (possibly) correct edgeCountsWP. The possibility of rounding error is most likely zero.
			   Anyway, this is cheap. */
			updateEdgeCountWPAtXy(contourStartX, contourStartY);
		}
		nextGlyphX += advanceWidth;
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#displayUtf8:fromByte:toByte:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayUtf8(void)
{
	unsigned char *aByteArray;
	float advanceWidth;
	float aux1;
	sqInt baseIndex;
	uint8_t byte;
	sqInt byteStartIndex;
	sqInt byteStopIndex;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	float startX;
	float startY;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isBytes(stackValue(8)))
		 && ((isIntegerObject((byteStartIndex = stackValue(7))))
		 && ((isIntegerObject((byteStopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aByteArray = firstIndexableField(stackValue(8));
	byteStartIndex = integerValueOf(byteStartIndex);
	byteStopIndex = integerValueOf(byteStopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));
	baseIndex = 0;

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (byteStartIndex - 1); index < byteStopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		byte = aByteArray[index];
		i = contourDataIndexes[baseIndex + byte];
		baseIndex = (i >= 0
					? 0
					: 0 - i);
		iSqInt = i;
		if (!baseIndex) {
			iSqInt -= 1;
			advanceWidth = contourData[iSqInt];

			/* boundsLeft := contourData at: i+1.
			   boundsRight := contourData at: i+2.
			   boundsBottom := contourData at: i+3.
			   boundsTop := contourData at: i+4. */
			iSqInt += 5;
			numContours = ((sqInt)(contourData[iSqInt]));
			iSqInt += 1;
			for (idx = 1; idx <= numContours; idx += 1) {
				numBeziers = ((sqInt)(contourData[iSqInt]));
				ttX = (contourData[iSqInt + 1]) + nextGlyphX;
				ttY = (contourData[iSqInt + 2]) + nextGlyphY;
				iSqInt += 3;
				contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
				contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

				/* begin initializeTrajectoryFragment */
				prevYTruncated = 0x7FFFFFFF;
				for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
					ttX = contourData[iSqInt];
					ttY = contourData[iSqInt + 1];
					endX = ((ttX * txA11) + (ttY * txA12)) + startX;
					endY = ((ttX * txA21) + (ttY * txA22)) + startY;
					ttX = contourData[iSqInt + 2];
					ttY = contourData[iSqInt + 3];
					controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
					controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
					iSqInt += 4;

					/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
					xMinEnd = ((startX < endX) ? startX : endX);
					xMaxEnd = ((startX < endX) ? endX : startX);
					yMinEnd = ((startY < endY) ? startY : endY);
					yMaxEnd = ((startY < endY) ? endY : startY);
					spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
					spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
					spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
					spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

					/* Compute Quadratic Bezier Curve,
					   Case t = 0.0 */
					x = startX;
					y = startY;
					updateAlphasForXy(x, y);
					updateEdgeCountAtXy(x, y);

					/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
					dx = fabsf(endX - startX);
					dy = fabsf(endY - startY);
					aux1 = ((dx < dy) ? dy : dx);
					aux1 = 0.5 / aux1;
					increment = ((aux1 < 0.5) ? aux1 : 0.5);
					t = 0.0;
					while (1) {
						t0 = t;
						x0 = x;
						y0 = y;

						/* Compute next point */
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

						/* Now adjust the increment to aim at the required hop length, and recompute next point. */
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
						do {
							increment = increment * correction;
							t = t0 + increment;
							oneLessT = 1.0 - t;
							f1 = oneLessT * oneLessT;
							f2 = (2.0 * oneLessT) * t;
							f3 = t * t;
							x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
							y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
							dx = x - x0;
							dy = y - y0;
							length = sqrt((dx * dx) + (dy * dy));

							/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
							correction = hop / (((length < 0.1) ? 0.1 : length));
						} while(correction < 0.99);
						if (!(t < 1.0)) break;
						updateAlphasForXy(x, y);
						updateEdgeCountAtXy(x, y);
					}

					/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
					   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
					startX = endX;
					startY = endY;
				}
				updateAlphasForXy(endX, endY);
				updateEdgeCountAtXy(endX, endY);

				/* Similar effect to ensureClosePath in #finishPath:,
				   but assume the TrueType definition is essentially right, and there might only be a rounding error.
				   So, don't draw a line, but just (possibly) correct edgeCounts. The possibility of rounding error is most likely zero.
				   Anyway, this is cheap. */
				updateEdgeCountAtXy(contourStartX, contourStartY);
			}
			nextGlyphX += advanceWidth;
		}
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}


/* ===== */


	/* VectorEnginePlugin>>#displayUtf8WP:fromByte:toByte:atx:y:scalex:y:contourData:contourDataIndexes: */
EXPORT(sqInt)
primDisplayUtf8WP(void)
{
	unsigned char *aByteArray;
	float advanceWidth;
	float aux1;
	sqInt baseIndex;
	uint8_t byte;
	sqInt byteStartIndex;
	sqInt byteStopIndex;
	float *contourData;
	int *contourDataIndexes;
	float contourStartX;
	float contourStartY;
	float controlX;
	float controlY;
	float correction;
	double destX;
	double destY;
	float dx;
	float dy;
	float endX;
	float endY;
	float f1;
	float f2;
	float f3;
	int i;
	sqInt idx;
	sqInt idx2;
	float increment;
	sqInt index;
	sqInt iSqInt;
	float length;
	float nextGlyphX;
	float nextGlyphY;
	sqInt numBeziers;
	sqInt numContours;
	float oneLessT;
	float startX;
	float startY;
	double sx;
	double sy;
	float t;
	float t0;
	float ttX;
	float ttY;
	float x;
	float x0;
	sqInt xMaxEnd;
	sqInt xMinEnd;
	float y;
	float y0;
	sqInt yMaxEnd;
	sqInt yMinEnd;
	sqInt _return_value;

	if (!((isBytes(stackValue(8)))
		 && ((isIntegerObject((byteStartIndex = stackValue(7))))
		 && ((isIntegerObject((byteStopIndex = stackValue(6))))
		 && ((isFloatObject(stackValue(5)))
		 && ((isFloatObject(stackValue(4)))
		 && ((isFloatObject(stackValue(3)))
		 && ((isFloatObject(stackValue(2)))
		 && ((isWordsOrBytes(stackValue(1)))
		 && (isWords(stackValue(0)))))))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aByteArray = firstIndexableField(stackValue(8));
	byteStartIndex = integerValueOf(byteStartIndex);
	byteStopIndex = integerValueOf(byteStopIndex);
	destX = stackFloatValue(5);
	destY = stackFloatValue(4);
	sx = stackFloatValue(3);
	sy = stackFloatValue(2);
	contourData = firstIndexableField(stackValue(1));
	contourDataIndexes = firstIndexableField(stackValue(0));
	baseIndex = 0;

	/* begin displayStringLoop:displayIf:wholePixel:contourIndexAccessor:from:to:atx:y:scalex:y:contourData: */
	trajectoryLength = 0.0;
	needsFullAlphaCircle = 1;
	txA11 = txA11 * sx;
	txA12 = txA12 * sy;
	txA21 = txA21 * sx;
	txA22 = txA22 * sy;
	nextGlyphX = destX / sx;
	nextGlyphY = destY / sy;
	for (index = (byteStartIndex - 1); index < byteStopIndex; index += 1) {
		/* Index points to a byte in a ByteString or UTF8String, or to a code point in an UTF32String */
		byte = aByteArray[index];
		i = contourDataIndexes[baseIndex + byte];
		baseIndex = (i >= 0
					? 0
					: 0 - i);
		iSqInt = i;
		if (!baseIndex) {
			iSqInt -= 1;
			advanceWidth = contourData[iSqInt];

			/* boundsLeft := contourData at: i+1.
			   boundsRight := contourData at: i+2.
			   boundsBottom := contourData at: i+3.
			   boundsTop := contourData at: i+4. */
			iSqInt += 5;
			numContours = ((sqInt)(contourData[iSqInt]));
			iSqInt += 1;
			for (idx = 1; idx <= numContours; idx += 1) {
				numBeziers = ((sqInt)(contourData[iSqInt]));
				ttX = (contourData[iSqInt + 1]) + nextGlyphX;
				ttY = (contourData[iSqInt + 2]) + nextGlyphY;
				iSqInt += 3;
				contourStartX = (startX = ((ttX * txA11) + (ttY * txA12)) + txA13);
				contourStartY = (startY = ((ttX * txA21) + (ttY * txA22)) + txA23);

				/* begin initializeTrajectoryFragment */
				prevYTruncated = 0x7FFFFFFF;
				for (idx2 = 1; idx2 <= numBeziers; idx2 += 1) {
					ttX = contourData[iSqInt];
					ttY = contourData[iSqInt + 1];
					endX = ((ttX * txA11) + (ttY * txA12)) + startX;
					endY = ((ttX * txA21) + (ttY * txA22)) + startY;
					ttX = contourData[iSqInt + 2];
					ttY = contourData[iSqInt + 3];
					controlX = ((ttX * txA11) + (ttY * txA12)) + startX;
					controlY = ((ttX * txA21) + (ttY * txA22)) + startY;
					iSqInt += 4;

					/* begin computeBoundsControlX:Y:startX:Y:endX:Y: */
					xMinEnd = ((startX < endX) ? startX : endX);
					xMaxEnd = ((startX < endX) ? endX : startX);
					yMinEnd = ((startY < endY) ? startY : endY);
					yMaxEnd = ((startY < endY) ? endY : startY);
					spanLeft = ((spanLeft < (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0)))) ? spanLeft : (((xMinEnd < ((xMinEnd + controlX) / 2.0)) ? xMinEnd : ((xMinEnd + controlX) / 2.0))));
					spanRight = ((spanRight < (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd))) ? (((xMaxEnd < ((xMaxEnd + controlX) / 2.0)) ? ((xMaxEnd + controlX) / 2.0) : xMaxEnd)) : spanRight);
					spanTop = ((spanTop < (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0)))) ? spanTop : (((yMinEnd < ((yMinEnd + controlY) / 2.0)) ? yMinEnd : ((yMinEnd + controlY) / 2.0))));
					spanBottom = ((spanBottom < (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd))) ? (((yMaxEnd < ((yMaxEnd + controlY) / 2.0)) ? ((yMaxEnd + controlY) / 2.0) : yMaxEnd)) : spanBottom);

					/* Compute Quadratic Bezier Curve,
					   Case t = 0.0 */
					x = startX;
					y = startY;
					updateAlphasWPZeroStrokeForXy(x, y);
					updateEdgeCountWPAtXy(x, y);

					/* Will be corrected for each hop. This, being close to pointFrom, is a good initial guess for first correction. */
					dx = fabsf(endX - startX);
					dy = fabsf(endY - startY);
					aux1 = ((dx < dy) ? dy : dx);
					aux1 = 0.5 / aux1;
					increment = ((aux1 < 0.5) ? aux1 : 0.5);
					t = 0.0;
					while (1) {
						t0 = t;
						x0 = x;
						y0 = y;

						/* Compute next point */
						t = t0 + increment;
						oneLessT = 1.0 - t;
						f1 = oneLessT * oneLessT;
						f2 = (2.0 * oneLessT) * t;
						f3 = t * t;
						x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
						y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);

						/* Now adjust the increment to aim at the required hop length, and recompute next point. */
						dx = x - x0;
						dy = y - y0;
						length = sqrt((dx * dx) + (dy * dy));

						/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
						correction = hop / (((length < 0.1) ? 0.1 : length));
						do {
							increment = increment * correction;
							t = t0 + increment;
							oneLessT = 1.0 - t;
							f1 = oneLessT * oneLessT;
							f2 = (2.0 * oneLessT) * t;
							f3 = t * t;
							x = ((f1 * startX) + (f2 * controlX)) + (f3 * endX);
							y = ((f1 * startY) + (f2 * controlY)) + (f3 * endY);
							dx = x - x0;
							dy = y - y0;
							length = sqrt((dx * dx) + (dy * dy));

							/* Don't grow increment too much in one step. More importantly, don't divide by zero under any circumstances. */
							correction = hop / (((length < 0.1) ? 0.1 : length));
						} while(correction < 0.99);
						if (!(t < 1.0)) break;
						updateAlphasWPZeroStrokeForXy(x, y);
						updateEdgeCountWPAtXy(x, y);
					}

					/* Note: For TrueType font definitions, we assume that all contour fragments start exactly where the previous ends.
					   This means that the end point is only added for the last fragment of the contour, and not for each one of them. */
					startX = endX;
					startY = endY;
				}
				updateAlphasWPZeroStrokeForXy(endX, endY);
				updateEdgeCountWPAtXy(endX, endY);

				/* Similar effect to ensureClosePath in #finishPath:,
				   but assume the TrueType definition is essentially right, and there might only be a rounding error.
				   So, don't draw a line, but just (possibly) correct edgeCountsWP. The possibility of rounding error is most likely zero.
				   Anyway, this is cheap. */
				updateEdgeCountWPAtXy(contourStartX, contourStartY);
			}
			nextGlyphX += advanceWidth;
		}
	}
	txA11 = txA11 / sx;
	txA12 = txA12 / sy;
	txA21 = txA21 / sx;
	txA22 = txA22 / sy;
	_return_value = floatObjectOf((nextGlyphX * sx));
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}
