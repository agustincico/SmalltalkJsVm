function pluginApiVersion(argCount) {
    // THE gate: answering 7 switches the image's whole rendering engine over to
    // this module, with no per-primitive fallback. See the header.
    if (!COMPLETE && !(typeof Squeak === "object" && Squeak.enableVectorEnginePlugin))
        return false;
    if (!announced) { announced = true; console.log("VectorEnginePlugin: active (api 7)"); }
    methodReturnValue(integerObjectOf(7));
    return true;
}
