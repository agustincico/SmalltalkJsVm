#!/usr/bin/env python3
"""Build the standalone site tree (the one served at smalltalkjsvm.com.ar).

    python3 utils/mk-site.py --out ../smalltalkjsvm --proxy https://cors.smalltalkjsvm.com.ar/

What it produces:
  index.html          the launcher, at the site root, paths rewritten (mk-site-index.py)
  <vm files>          exactly the modules squeak.js / squeak_worker.js import, no more
  lib/, run/          the libraries and the launcher's css + logo
  compat64.zip        just startup.st for 64-bit Pharo (~13 KB)
  pharo-demo.zip      just startup.st for the Morphic demo (~3 KB)

The point of the two little zips: the launcher merges several zips into one directory, so
the *image* can be fetched straight from files.pharo.org and only our startup script has to
be hosted. That is the difference between hosting ~15 KB and mirroring ~45 MB per Pharo
variant, and the images stay current with upstream.

Cross-origin note: files.pharo.org / files.squeak.org send no CORS headers, so those URLs
go through --proxy (see utils/cors-worker.js). Cuis is served from GitHub, which does send
them, so it is linked directly.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


ENTRY_POINTS = ("squeak.js", "squeak_worker.js")


def imported_modules():
    """The JS the site actually needs: the two entry points plus everything they import."""
    mods = set(ENTRY_POINTS)
    for entry in ENTRY_POINTS:
        with open(os.path.join(ROOT, entry), encoding="utf-8") as f:
            mods |= set(re.findall(r'import "\./([^"]+)"', f.read()))
    return sorted(mods)


def examples(proxy):
    """The example links. Upstream images through the proxy + our tiny startup zips."""
    pharo = proxy + "https://files.pharo.org/image/100/"
    cuis = ("#url=https://raw.githubusercontent.com/Cuis-Smalltalk/Cuis7-8/master/CuisImage/32BitsImage"
            "&files=[Cuis7.8-32.image,Cuis7.8-32.changes,Cuis7.8.sources]")
    return [
        ("Squeak", [("6.0", "#zip=https://dialog.ar/Squeak.zip")], ""),
        ("Cuis", [("7.8", cuis)], "from the official repo"),
        ("Pharo", [
            ("10 (32-bit)", "#zip=" + pharo + "latest-32.zip"),
            ("10 (64-bit)", "#zip=[" + pharo + "latest-64.zip,compat64.zip]"),
            ("live Morphic demo", "#zip=[" + pharo + "latest-32.zip,pharo-demo.zip]"),
        ], "straight from files.pharo.org"),
        ("Dialog.ar", [("example drawing app for kids", "#zip=https://dialog.ar/Dialogo.zip")], ""),
    ]


def rewrite_notes(html):
    """The CORS note in run/index.html describes the dialog.ar setup (everything mirrored).
    This site fetches the images from upstream instead, so say what actually happens."""
    return html.replace(
        "<em>Cuis loads straight from its official GitHub repository. Squeak and Pharo are"
        " mirrored on dialog.ar because files.squeak.org and files.pharo.org don't send CORS"
        " headers, so browsers refuse to download from them directly.</em>",
        "<em>Pharo and Cuis are fetched from their own official repositories, so you always get"
        " the current build. GitHub sends the CORS headers a browser requires; files.pharo.org"
        " does not, so those downloads go through a small proxy of ours — the bytes still come"
        " from Pharo's servers. Only the compatibility startup scripts (a few KB) are hosted"
        " here.</em>")


def rewrite_examples(html, proxy):
    items = []
    for name, links, note in examples(proxy):
        anchors = " · ".join('<a href="%s">%s</a>' % (href, label) for label, href in links)
        muted = ' <span class="muted">(%s)</span>' % note if note else ""
        items.append("        <li><b>%s</b> — %s%s</li>" % (name, anchors, muted))
    block = "\n".join(items)
    # replace the whole <li> list inside the examples card
    return re.sub(r"( *<li><b>Squeak</b>.*?<li><b>Dialog\.ar</b>[^\n]*</li>)", block, html, count=1, flags=re.S)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="target directory for the site tree")
    ap.add_argument("--proxy", default="https://cors.smalltalkjsvm.com.ar/",
                    help="CORS proxy prefix for hosts that send no CORS headers")
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    # Write into the directory, never recreate it: the target is a git repo (and holds
    # .wrangler deploy state), so wiping it first would take .git with it.
    os.makedirs(out, exist_ok=True)

    # 1. the VM modules, keeping their relative paths
    for mod in imported_modules():
        dst = os.path.join(out, mod)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, mod), dst)

    # 2. lib/ wholesale (small, and some pieces load lazily) + the launcher's assets
    shutil.copytree(os.path.join(ROOT, "lib"), os.path.join(out, "lib"), dirs_exist_ok=True)
    os.makedirs(os.path.join(out, "run"), exist_ok=True)
    for asset in ("squeakjs.css", "squeakjs.png"):
        shutil.copy2(os.path.join(ROOT, "run", asset), os.path.join(out, "run", asset))

    # 3. the launcher pages at the root, with their paths rewritten for this layout
    def generate(page):
        return subprocess.run([sys.executable, os.path.join(HERE, "mk-site-index.py"),
                               os.path.join(ROOT, "run", page)],
                              capture_output=True, text=True, check=True).stdout

    html = rewrite_notes(rewrite_examples(generate("index.html"), args.proxy))
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    # the embedding example; its iframe points at index.html, which sits beside it either way
    with open(os.path.join(out, "embed.html"), "w", encoding="utf-8") as f:
        f.write(generate("embed.html"))

    # 4. the startup-script zips (the images themselves come from upstream)
    for zipname, src in (("compat64.zip", "pharo/startup-compat64.st"),
                         ("pharo-demo.zip", "pharo/demo-startup.st")):
        with zipfile.ZipFile(os.path.join(out, zipname), "w", zipfile.ZIP_DEFLATED) as z:
            z.write(os.path.join(ROOT, src), "startup.st")

    n = sum(len(files) for _, _, files in os.walk(out))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
    print("site built in %s — %d files, %.1f MB" % (out, n, size / 1e6))


if __name__ == "__main__":
    main()
