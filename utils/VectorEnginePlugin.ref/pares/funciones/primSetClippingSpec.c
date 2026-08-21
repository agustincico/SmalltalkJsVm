/* VectorEnginePlugin>>#clippingSpec: */
EXPORT(sqInt)
primSetClippingSpec(void)
{
	int *anIntegerArray;

	if (!(isWords(stackValue(0)))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	anIntegerArray = firstIndexableField(stackValue(0));
	clippingSpec = anIntegerArray;
	if (!(failed())) {
		pop(1);
	}
	return null;
}
