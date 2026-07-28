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


def imported_modules():
    """The JS the site actually needs: whatever the two entry points import."""
    mods = set()
    for entry in ("squeak.js", "squeak_worker.js"):
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

    # 3. index.html at the root, with rewritten paths and example links
    html = subprocess.run([sys.executable, os.path.join(HERE, "mk-site-index.py"),
                           os.path.join(ROOT, "run", "index.html")],
                          capture_output=True, text=True, check=True).stdout
    html = rewrite_examples(html, args.proxy)
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

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
