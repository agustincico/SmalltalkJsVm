#!/usr/bin/env python3
"""Rewrite a chunk-format .st so it installs its methods with compile:classified:.

    python3 utils/mk-portable-st.py pharo/startup-compat64.st > portable.st

Why: the chunk reader's method directive, `!Class methodsFor: 'cat' stamp: ''!`, is not
magic — the reader *evaluates* that line, so the selector has to exist. Pharo dropped
`methodsFor:` (by Pharo 10) and then `methodsFor:stamp:` (by Pharo 13), so on a current
image every method block dies with a doesNotUnderstand and nothing gets installed.

`compile:classified:` is an ordinary message that has been there forever, so the converted
file works across versions. Class definitions and plain doits are copied through untouched.

Escaping, in this order: `'` doubles for the Smalltalk string, and `!` doubles because the
chunk reader ends a chunk at a bang.
"""
import re
import sys

# !Class methodsFor: 'category' [stamp: '...']!  <body>  ! !
METHOD_BLOCK = re.compile(
    r"!([A-Za-z][A-Za-z0-9_]*)( +class)? +methodsFor: *'([^']*)'"
    r"(?: +stamp: *'[^']*')? *!\s*\n"
    r"([\s\S]*?)"
    r"! !",
    re.M)


def as_literal(body):
    return "'" + body.replace("'", "''").replace("!", "!!") + "'"


def convert(text):
    out, pos, n = [], 0, 0
    for m in METHOD_BLOCK.finditer(text):
        out.append(text[pos:m.start()])
        cls, is_meta, category, body = m.group(1), bool(m.group(2)), m.group(3), m.group(4)
        receiver = cls + (" class" if is_meta else "")
        # Each method is its own chunk: one failure then costs one method, not the rest
        # of the file, and the error names the method it belongs to.
        out.append("%s compile: %s classified: '%s'!\n"
                   % (receiver, as_literal(body.rstrip()), category))
        pos = m.end()
        n += 1
    out.append(text[pos:])
    sys.stderr.write("converted %d methods\n" % n)
    return "".join(out)


if __name__ == "__main__":
    with open(sys.argv[1], encoding="latin-1") as f:
        sys.stdout.write(convert(f.read()))
