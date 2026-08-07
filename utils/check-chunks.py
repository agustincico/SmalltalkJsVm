#!/usr/bin/env python3
"""Sanity-check a Smalltalk chunk file before feeding it to an image.

    python3 utils/check-chunks.py pharo/app-startup.st

A chunk file that is punctuated wrong does not complain: the image swallows the error and
boots as if the script were not there. The usual cause is a bare "!" inside a comment or a
string, which closes the chunk where it stands and leaves the rest of the text to be parsed
as code. In chunk format that character has to be doubled.

This reads the file the way the chunk reader does and reports any chunk whose comment quotes
do not balance -- which is exactly what a stray bang looks like from here, because the chunk
ends in the middle of a comment and the other half of it lands in the next one.
"""
import sys


def chunks(text):
    out, buf, i, n = [], [], 0, len(text)
    while i < n:
        if text[i] == "!":
            if i + 1 < n and text[i + 1] == "!":   # doubled: a literal bang, not a separator
                buf.append("!"); i += 2; continue
            out.append("".join(buf)); buf = []; i += 1; continue
        buf.append(text[i]); i += 1
    if "".join(buf).strip():
        out.append("".join(buf))
    return out


def main():
    bad = 0
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        for n, chunk in enumerate(chunks(text)):
            body = chunk.strip()
            # a chunk may be a comment, code, or a comment followed by code -- what it may
            # not be is half a comment, and an odd number of quotes is exactly that
            if body.count('"') % 2:
                bad += 1
                print("%s: chunk %d ends inside a comment — a bare bang in the text?\n    %s…"
                      % (path, n, body.split("\n")[0][:70]))
    print("chunk check: %s" % ("%d problem(s)" % bad if bad else "clean"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
