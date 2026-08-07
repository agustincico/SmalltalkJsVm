#!/usr/bin/env python3
"""Build the standalone site tree (the one served at smalltalkjsvm.com.ar).

    python3 utils/mk-site.py --out ../smalltalkjsvm --proxy https://cors.smalltalkjsvm.com.ar/

What it produces:
  index.html          the launcher, at the site root, paths rewritten (mk-site-index.py)
  embed.html          the embedding example
  <vm files>          exactly the modules squeak.js / squeak_worker.js import, no more
  lib/, run/          the libraries and the launcher's css + logo
  pharo/*.st          the 64-bit Pharo compatibility scripts the launcher installs itself
  compat64/13.zip     the same scripts as one-file zips, for hand-assembled bundles
  pharo-demo.zip      just startup.st for the Morphic demo (~3 KB)

No image is hosted here. Every example links the build its own project publishes, so the
site stays ~2 MB and the images never go stale. Only the compatibility scripts (a few KB)
are ours.

Cross-origin note: files.pharo.org / files.squeak.org send no CORS headers. The launcher
routes those two hosts through a proxy of ours on its own (viaProxy / CORS_PROXY in the
page, see utils/cors-worker.js) — --proxy only says which deployment's worker to use. The
links themselves name the project's own server, so a reader sees where the bytes come from.
Cuis is served from GitHub, which does send the headers, so it is fetched directly.

pharo-app.zip (the Morphic application, ~15 MB) is NOT generated here: it is a Pharo image
saved with the app already running (pharo/app-startup.st + pharo/app-snapshot.st, see that
README) and committed to the site repo — which is why this script writes into the target
directory instead of recreating it.
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


# The current release of each environment, from the project's own servers. Squeak has no
# "latest" alias on files.squeak.org, so its build number is spelled out — bump it here when
# a newer 6.x build appears (the directory listing at files.squeak.org/6.0/ is the source).
SQUEAK_BUILD = "Squeak6.0-22156-64bit"
CUIS_REPO, CUIS_VERSION = "Cuis7-8", "Cuis7.8"
PHARO_VERSION = "130"
# the extracted Morphic application, built by pharo/app-build.st and committed to the site
# repo (this script does not generate it); both the examples list and embed.html point here
PHARO_APP = "pharo-app.zip"


def examples():
    """The example links: each names the project's own server. The launcher puts the CORS
    proxy in front of files.squeak.org / files.pharo.org itself (see viaProxy in the page),
    so nothing here has to know about it."""
    squeak = "https://files.squeak.org/6.0/%s/%s.zip" % (SQUEAK_BUILD, SQUEAK_BUILD)
    cuis = ("#url=https://raw.githubusercontent.com/Cuis-Smalltalk/%s/master/CuisImage"
            "&files=[%s.image,%s.changes,%s.sources]" % (CUIS_REPO, CUIS_VERSION, CUIS_VERSION, CUIS_VERSION))
    pharo = "https://files.pharo.org/image/%s/latest-64.zip" % PHARO_VERSION
    return [
        ("Squeak", [("6.0", "#zip=" + squeak)], "the current build, from files.squeak.org"),
        # No [image,compat13.zip] pair here: the launcher reads the image and installs the
        # compatibility script itself, exactly as it does for an image dropped on the page.
        ("Pharo", [("13", "#zip=" + pharo)], "the current release, from files.pharo.org"),
        ("Cuis", [("7.8", cuis)], "from the official repo"),
        ("Pharo app", [("live Morphic demo", "#zip=" + PHARO_APP)],
         "a saved image that opens with the app already running"),
    ]


def rewrite_demo(html):
    """embed.html loads a demo image on click. In the repo it points at the dialog.ar copy;
    on the site the application sits right beside the page, so use that."""
    html, n = re.subn(r'frame\.src = "index\.html#zip=[^"]*"',
                      'frame.src = "index.html#zip=%s"' % PHARO_APP, html, count=1)
    if not n:
        sys.stderr.write("warning: embed.html demo URL not found, left as-is\n")
    return html


def rewrite_proxy(html, proxy):
    """Point the launcher's CORS proxy at this deployment's worker."""
    html, n = re.subn(r'var CORS_PROXY = "[^"]*";', 'var CORS_PROXY = "%s";' % proxy, html, count=1)
    if not n:
        sys.stderr.write("warning: CORS_PROXY not found, left as-is\n")
    return html


def rewrite_examples(html):
    items = []
    for name, links, note in examples():
        anchors = " · ".join('<a href="%s">%s</a>' % (href, label) for label, href in links)
        muted = ' <span class="muted">(%s)</span>' % note if note else ""
        items.append("        <li><b>%s</b> — %s%s</li>" % (name, anchors, muted))
    block = "\n".join(items)
    # replace the whole <li> list inside the examples card
    return re.sub(r"( *<li><b>Squeak</b>.*?<li><b>Pharo app</b>[^\n]*</li>)", block, html, count=1, flags=re.S)


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

    html = rewrite_proxy(rewrite_examples(generate("index.html")), args.proxy)
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    # the embedding example; its iframe points at index.html, which sits beside it either way
    with open(os.path.join(out, "embed.html"), "w", encoding="utf-8") as f:
        f.write(rewrite_demo(generate("embed.html")))

    # 4. the startup-script zips (the images themselves come from upstream)
    for zipname, src in (("compat64.zip", "pharo/startup-compat64.st"),
                         ("compat13.zip", "pharo/startup-compat13.st"),
                         ("pharo-demo.zip", "pharo/demo-startup.st")):
        with zipfile.ZipFile(os.path.join(out, zipname), "w", zipfile.ZIP_DEFLATED) as z:
            z.write(os.path.join(ROOT, src), "startup.st")

    # 5. the same scripts as plain files: the launcher fetches one of them when someone
    # drops a bare 64-bit Pharo .image, having read the image to see which it needs
    os.makedirs(os.path.join(out, "pharo"), exist_ok=True)
    for st in ("startup-compat64.st", "startup-compat13.st"):
        shutil.copy2(os.path.join(ROOT, "pharo", st), os.path.join(out, "pharo", st))

    n = sum(len(files) for _, _, files in os.walk(out))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
    print("site built in %s — %d files, %.1f MB" % (out, n, size / 1e6))


if __name__ == "__main__":
    main()
