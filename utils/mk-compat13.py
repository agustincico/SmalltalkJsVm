#!/usr/bin/env python3
"""Generate pharo/startup-compat13.st: the 64-bit compat script for Pharo 12 AND 13.

Both versions share the gaps this script fills: they removed DisplayScreen (and the Display
global) outright, and dropped the chunk reader's method directive. Verified to boot and
respond on Pharo 12 (files.pharo.org latest) and Pharo 13 (the Pharo Launcher image and
files.pharo.org latest) alike.

    python3 utils/mk-compat13.py /path/to/Pharo10.0-32bit.sources > pharo/startup-compat13.st

Pharo 12/13 need two things on top of what startup-compat64.st does for Pharo 10/11:

1. DisplayScreen DOES NOT EXIST there (10's 64-bit builds still had the class, just pruned;
   13 removed it outright, along with the Display global). So this port defines the class
   and carries over its ~58 methods verbatim from the Pharo 10 32-bit sources, then creates
   and installs the Display instance. actualScreenSize gets a direct-primitive override,
   because the Pharo 10 version delegates to the active world — which does not exist yet at
   the point in startup where we need the screen size.

2. The chunk reader's method directive is gone (methodsFor:stamp: is no more), so every
   method — ported and original — is installed with compile:classified: instead (see
   mk-portable-st.py). Class definitions with poolDictionaries: are rewritten to the plain
   form plus addSharedPool:, since the 5-keyword subclass: message may not survive either.

Also mind the undeclared-global rule that bit us twice already: every global a compiled
method mentions must EXIST at compile time (Pharo 13 raises on reading an undeclared, and a
later at:put: does not rebind methods compiled against the undeclared registry). Hence
#Display is declared before anything that mentions it is compiled.
"""
import importlib.util
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# share the chunk->compile: conversion with mk-portable-st.py (single source of truth)
_spec = importlib.util.spec_from_file_location("mkportable", os.path.join(HERE, "mk-portable-st.py"))
_mk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mk)

CHUNK = re.compile(r"!DisplayScreen( class)? methodsFor: '([^']*)'[^!]*!\s*([\s\S]*?)(?=! !)")

# category, first-line prefix of chunks NOT to port
SKIP = [
    # references `self currentWorld`, an extension Pharo 13 dropped; Form>>boundingBox
    # (0@0 corner: extent) is the right answer for a plain display form anyway
    ("*Morphic-Core", "boundingBox"),
]

POOL_DEF = re.compile(
    r"^([A-Za-z][A-Za-z0-9_]*) subclass: #([A-Za-z][A-Za-z0-9_]*)\s*\n"
    r"(\s*instanceVariableNames: '[^']*'\s*\n"
    r"\s*classVariableNames: '[^']*'\s*\n)"
    r"\s*poolDictionaries: '([^']*)'\s*\n"
    r"(\s*package: '[^']*')!", re.M)


def display_screen_port(sources_path):
    data = open(sources_path, encoding="latin-1").read()
    out = ["""\"--- DisplayScreen, ported whole from Pharo 10 (Pharo 13 removed the class and the
Display global; the 64-bit compat machinery renders through them). Methods carried over
verbatim; bangs come undoubled from the sources and re-escaped for the literals. ---\"!

"Top-level chunk on purpose: the reader treats a class definition specially there.
Wrapped in a block it becomes a plain message send, and Pharo 13 no longer implements
subclass:instanceVariableNames:classVariableNames:package: as an actual method -- the
guard variant died with a DNU on Form class. Unconditional is fine: this script only
ever runs on images where DisplayScreen does not exist."!
Form subclass: #DisplayScreen
	instanceVariableNames: 'clippingBox extraRegions deferredUpdatingOn'
	classVariableNames: 'DeferringUpdates DisplayChangeSignature LastScreenModeSelected ScreenSave Title'
	package: 'SqueakJS-Compat'!

\"Declared before any method mentioning it is compiled -- the Sensor lesson: a global
declared after the fact does not rebind already-compiled undeclared references.\"
(Smalltalk globals includesKey: #Display) ifFalse: [ Smalltalk globals at: #Display put: nil ]!
"""]
    n = 0
    for m in CHUNK.finditer(data):
        is_meta, category, body = bool(m.group(1)), m.group(2), m.group(3)
        body = body.rstrip().replace("!!", "!")  # sources double their bangs
        first = body.split("\n")[0].strip()
        if any(category == c and first.startswith(p) for c, p in SKIP):
            continue
        receiver = "DisplayScreen class" if is_meta else "DisplayScreen"
        out.append("%s compile: %s classified: '%s'!\n" % (receiver, _mk.as_literal(body), category))
        n += 1
    out.append("""\"Boot needs the screen size before any world exists, so bypass the Pharo 10 version
(which delegates to the active world) and ask the VM directly.\"
DisplayScreen class compile: 'actualScreenSize
	<primitive: 106>
	^ 640@480' classified: 'squeakjs-compat'!

Display isNil ifTrue: [
	Smalltalk globals at: #Display put: (DisplayScreen extent: DisplayScreen actualScreenSize depth: 32).
	Display beDisplay.
	Display fillColor: Color white ]!
""")
    sys.stderr.write("ported %d DisplayScreen methods\n" % n)
    return "".join(out)


def rewrite_pool_defs(text):
    """5-keyword subclass:...poolDictionaries:...package: -> plain def + addSharedPool:."""
    def repl(m):
        sup, name, head, pools, pkg = m.groups()
        doits = "".join("%s addSharedPool: %s!\n" % (name, p) for p in pools.split())
        return ("%s subclass: #%s\n%s%s!\n%s" % (sup, name, head, pkg, doits)).rstrip("\n")
    out, n = POOL_DEF.subn(repl, text)
    sys.stderr.write("rewrote %d pool class definitions\n" % n)
    return out


def main():
    sources = sys.argv[1]
    compat64 = open(os.path.join(HERE, "..", "pharo", "startup-compat64.st"), encoding="latin-1").read()
    body = rewrite_pool_defs(_mk.convert(compat64))
    sys.stdout.write(display_screen_port(sources))
    sys.stdout.write("\n")
    sys.stdout.write(body)


if __name__ == "__main__":
    main()
