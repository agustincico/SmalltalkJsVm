# Arithmetic sweep

A dialect-neutral correctness net for the parts of the VM that are easy to break silently:
the LargeInteger primitives (20-22, 29-37), the mixed Integer/Float paths the JIT inlines,
`ByteArray>>=` (primitive 156) and `String>>compare:` (primitive 158).

It exists because those are the changes whose failure mode is *wrong numbers*, not a crash.
A boot test will not catch them: an image boots perfectly well while computing `3 + 0.5`
incorrectly.

## Running it

`sweep.st` is chunk format and runs inside any image, without needing `startup.st` — inject it
with a runner that evaluates chunks once the image reaches idle. It writes one `key=value` line
per case to `bench.txt`.

    BENCH_SCRIPT=tests/arithmetic/sweep.st BENCH_OUT=/tmp/out.txt \
      node <runner> -ignoreQuit <image>

## The expected output

`expected.txt` is the reference. It is **byte-identical in Pharo 13 and Squeak 6.0**
(md5 `0e4657f93544a54d89b826def80a3f7a`, 51 lines), which is what makes it useful: the two
dialects reach these answers through different Smalltalk code, so agreement means the VM is
right rather than that one image's quirk was recorded.

Compare with `md5`, not by eye. A single digit is the whole point.

## Writing more cases

Two traps, both of which cost a build here:

- `add value: 'k' value: a rem: b` parses as one `value:value:rem:` message. Keyword messages
  in an argument position need parentheses.
- Do not compile methods. Pharo opens its *Author identification* dialog on `compile:`, and a
  script has nobody to answer it, so the image hangs with no output at all.

`utils/check-chunks.py` catches the other classic: a bare `!` inside a comment closes the chunk
and the rest parses as code.
