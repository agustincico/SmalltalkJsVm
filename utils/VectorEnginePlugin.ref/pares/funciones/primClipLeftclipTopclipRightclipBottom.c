/* VectorEnginePlugin>>#clipLeft:clipTop:clipRight:clipBottom: */
EXPORT(sqInt)
primClipLeftclipTopclipRightclipBottom(void)
{
	sqInt b;
	sqInt l;
	sqInt r;
	sqInt t;

	if (!((isIntegerObject((l = stackValue(3))))
		 && ((isIntegerObject((t = stackValue(2))))
		 && ((isIntegerObject((r = stackValue(1))))
		 && (isIntegerObject((b = stackValue(0)))))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	l = integerValueOf(l);
	t = integerValueOf(t);
	r = integerValueOf(r);
	b = integerValueOf(b);
	clipLeft = l;
	clipTop = t;
	clipRight = r;
	clipBottom = b;
	if (!(failed())) {
		pop(4);
	}
	return null;
}
