/* VectorEnginePlugin>>#targetAssumedOpaque: */
EXPORT(sqInt)
primTargetAssumedOpaque(void)
{
	sqInt aBoolean;

	if (!(isBooleanObject(stackValue(0)))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aBoolean = booleanValueOf(stackValue(0));
	targetAssumedOpaque = aBoolean;
	if (!(failed())) {
		pop(1);
	}
	return null;
}
