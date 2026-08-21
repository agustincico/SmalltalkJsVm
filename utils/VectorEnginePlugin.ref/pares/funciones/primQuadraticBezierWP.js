function primQuadraticBezierWP(argCount) {
    if (!(isFloatObject(stackValue(5)) && isFloatObject(stackValue(4))
        && isFloatObject(stackValue(3)) && isFloatObject(stackValue(2))
        && isFloatObject(stackValue(1)) && isFloatObject(stackValue(0)))) {
        primitiveFailFor(PrimErrBadArgument); return false;
    }
    pvt_quadraticBezierWPFromXytoXycontrolXy(
        stackFloatValue(5), stackFloatValue(4), stackFloatValue(3),
        stackFloatValue(2), stackFloatValue(1), stackFloatValue(0));
    if (!failed()) pop(6);
    return !failed();
}
