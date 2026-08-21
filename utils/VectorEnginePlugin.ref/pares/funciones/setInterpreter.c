/* InterpreterPlugin>>#setInterpreter: */
EXPORT(sqInt)
setInterpreter(struct VirtualMachine *anInterpreter)
{
	sqInt ok;

	interpreterProxy = anInterpreter;

	/* This may seem tautological, but in a real plugin it checks that the VM provides
	   the version the plugin was compiled against which is the version the plugin expects. */
	ok = ((interpreterProxy->majorVersion()) == (VM_PROXY_MAJOR))
		 && ((interpreterProxy->minorVersion()) >= (VM_PROXY_MINOR));
	if (ok) {
		
#if !defined(SQUEAK_BUILTIN_PLUGIN)
		booleanValueOf = interpreterProxy->booleanValueOf;
		failed = interpreterProxy->failed;
		firstIndexableField = interpreterProxy->firstIndexableField;
		floatObjectOf = interpreterProxy->floatObjectOf;
#if !defined(integerObjectOf)
		integerObjectOf = interpreterProxy->integerObjectOf;
#endif
#if !defined(integerValueOf)
		integerValueOf = interpreterProxy->integerValueOf;
#endif
#if VM_PROXY_MAJOR > 1 || (VM_PROXY_MAJOR == 1 && VM_PROXY_MINOR >= 15)
		isBooleanObject = interpreterProxy->isBooleanObject;
#else
#if !defined(isBooleanObject)
		isBooleanObject = 0;
#endif
#endif
		isBytes = interpreterProxy->isBytes;
		isFloatObject = interpreterProxy->isFloatObject;
#if !defined(isIntegerObject)
		isIntegerObject = interpreterProxy->isIntegerObject;
#endif
		isWords = interpreterProxy->isWords;
		isWordsOrBytes = interpreterProxy->isWordsOrBytes;
		methodReturnValue = interpreterProxy->methodReturnValue;
		pop = interpreterProxy->pop;
		primitiveFailFor = interpreterProxy->primitiveFailFor;
		stackFloatValue = interpreterProxy->stackFloatValue;
		stackValue = interpreterProxy->stackValue;
#endif /* !defined(SQUEAK_BUILTIN_PLUGIN) */
	}
	return ok;
}
