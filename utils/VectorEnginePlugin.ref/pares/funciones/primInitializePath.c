/* VectorEnginePlugin>>#initializePath */
EXPORT(sqInt)
primInitializePath(void)
{
	/* drawable right. Will later be refined. */
	spanLeft = targetWidth;

	/* drawable bottom. Will later be refined. */
	spanTop = targetHeight;

	/* drawable left. Will later be refined. */
	spanRight = 0;

	/* drawable top. Will later be refined. */
	spanBottom = 0;
	prevYRounded = 0x7FFFFFFF;
	return null;
}
