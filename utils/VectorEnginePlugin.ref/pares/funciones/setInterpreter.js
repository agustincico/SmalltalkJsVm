function setInterpreter(anInterpreter) {
    interpreterProxy = anInterpreter;
    return interpreterProxy.majorVersion() == 1 && interpreterProxy.minorVersion() >= 11;
}
