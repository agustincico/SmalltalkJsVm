/* VectorEnginePlugin>>#updateContourLastLine */
EXPORT(sqInt)
primUpdateContourLastLine(void)
{
	if (!(prevYRounded == 0x7FFFFFFF)) {
		contour[prevYRounded * 2] = leftAtThisY;
		contour[(prevYRounded * 2) + 1] = rightAtThisY;
	}
	return null;
}
