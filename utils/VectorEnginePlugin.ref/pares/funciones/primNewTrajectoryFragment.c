/* VectorEnginePlugin>>#newTrajectoryFragment */
EXPORT(sqInt)
primNewTrajectoryFragment(void)
{
	sqInt _return_value;

	_return_value = 0;

	/* begin initializeTrajectoryFragment */
	prevYTruncated = 0x7FFFFFFF;
	if (!(failed())) {
		methodReturnValue(_return_value);
	}
	return null;
}
