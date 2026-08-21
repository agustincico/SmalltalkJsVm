/* VectorEnginePlugin>>#updateContourForX:y: */
static sqInt
updateContourForXy(float x, float y)
{
	sqInt thisYRounded;

	thisYRounded = ((sqInt)(y + 0.5));
	if (((thisYRounded >= 0) && (thisYRounded <= (targetHeight - 1)))) {
		if (!(thisYRounded == prevYRounded)) {
			if (!(prevYRounded == 0x7FFFFFFF)) {
				contour[prevYRounded * 2] = leftAtThisY;
				contour[(prevYRounded * 2) + 1] = rightAtThisY;
			}
			leftAtThisY = contour[thisYRounded * 2];
			rightAtThisY = contour[(thisYRounded * 2) + 1];
			prevYRounded = thisYRounded;
		}
		leftAtThisY = ((leftAtThisY < x) ? leftAtThisY : x);
		rightAtThisY = ((rightAtThisY < x) ? x : rightAtThisY);
	}
	return 0;
}
