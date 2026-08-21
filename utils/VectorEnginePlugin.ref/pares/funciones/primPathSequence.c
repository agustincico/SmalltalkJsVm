/* VectorEnginePlugin>>#pathSequence:size: */
EXPORT(sqInt)
primPathSequence(void)
{
	float *aFloat32Array;
	sqInt commandType;
	float control1X;
	float control1Y;
	float control2X;
	float control2Y;
	float endX;
	float endY;
	sqInt i;
	sqInt size;
	float startX;
	float startY;

	if (!((isWordsOrBytes(stackValue(1)))
		 && (isIntegerObject((size = stackValue(0)))))) {
		return primitiveFailFor(PrimErrBadArgument);
	}
	aFloat32Array = firstIndexableField(stackValue(1));
	size = integerValueOf(size);
	i = 0;
	while (i < size) {
		commandType = ((sqInt)(aFloat32Array[i]));
		i += 1;
		switch (commandType) {
		case 0:
			if (!((i + 1) < size)) {
				if (!(failed())) {
					pop(2);
				}
				return null;
			}
			startX = aFloat32Array[i];
			i += 1;
			startY = aFloat32Array[i];
			i += 1;

			/* begin initializeTrajectoryFragment */
			prevYTruncated = 0x7FFFFFFF;
			break;
		case 1:
			if (!((i + 1) < size)) {
				if (!(failed())) {
					pop(2);
				}
				return null;
			}
			endX = aFloat32Array[i];
			i += 1;
			endY = aFloat32Array[i];
			i += 1;
			pvt_lineFromXytoXy(startX, startY, endX, endY);
			startX = endX;
			startY = endY;
			break;
		case 2:
			if (!((i + 3) < size)) {
				if (!(failed())) {
					pop(2);
				}
				return null;
			}
			endX = aFloat32Array[i];
			i += 1;
			endY = aFloat32Array[i];
			i += 1;
			control1X = aFloat32Array[i];
			i += 1;
			control1Y = aFloat32Array[i];
			i += 1;
			pvt_quadraticBezierFromXytoXycontrolXy(startX, startY, endX, endY, control1X, control1Y);
			startX = endX;
			startY = endY;
			break;
		case 3:
			if (!((i + 5) < size)) {
				if (!(failed())) {
					pop(2);
				}
				return null;
			}
			endX = aFloat32Array[i];
			i += 1;
			endY = aFloat32Array[i];
			i += 1;
			control1X = aFloat32Array[i];
			i += 1;
			control1Y = aFloat32Array[i];
			i += 1;
			control2X = aFloat32Array[i];
			i += 1;
			control2Y = aFloat32Array[i];
			i += 1;
			pvt_cubicBezierFromXytoXycontrol1Xycontrol2Xy(startX, startY, endX, endY, control1X, control1Y, control2X, control2Y);
			startX = endX;
			startY = endY;
			break;
		default:
			if (!(failed())) {
				pop(2);
			}
			return null;
		}
	}
	if (!(failed())) {
		pop(2);
	}
	return null;
}
