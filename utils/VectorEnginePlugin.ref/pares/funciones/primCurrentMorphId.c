/* VectorEnginePlugin>>#currentMorphId: */
EXPORT(sqInt)
primCurrentMorphId(void)
{
	sqInt aNumber;

	if (!(isIntegerObject((aNumber = stackValue(0))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aNumber = integerValueOf(aNumber);
	currentMorphId = aNumber;
	if (!(failed())) {
		pop(1);
	}
	return null;
}
