#!/usr/bin/env python3
"""Parte el C original y el JS resultante en funciones, y las aparea por nombre.

Sale en pares/funciones/<nombre>.c y pares/funciones/<nombre>.js, mas un
INDICE.md con el estado de cada par. Reproducible: borra y regenera.
"""
import os, re, shutil, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(REPO, "utils/VectorEnginePlugin.ref")
C_SRC = os.path.join(REF, "VectorEnginePlugin.c")
JS_SRC = os.path.join(REPO, "plugins/VectorEnginePlugin.js")
OUT = os.path.join(REF, "pares/funciones")


def bloque_por_llaves(texto, inicio):
    """desde la '{' en/después de inicio, devuelve el índice tras su '}' de cierre.
    Ignora llaves dentro de strings y comentarios."""
    i = texto.index("{", inicio)
    prof, j, n = 0, i, len(texto)
    while j < n:
        c = texto[j]
        if c == "/" and j + 1 < n and texto[j + 1] == "*":
            j = texto.index("*/", j) + 2; continue
        if c == "/" and j + 1 < n and texto[j + 1] == "/":
            j = texto.find("\n", j);  j = n if j < 0 else j + 1; continue
        if c in "\"'":
            q, j = c, j + 1
            while j < n and texto[j] != q:
                j += 2 if texto[j] == "\\" else 1
            j += 1; continue
        if c == "{": prof += 1
        elif c == "}":
            prof -= 1
            if prof == 0: return j + 1
        j += 1
    raise ValueError("llave sin cerrar")


def comentario_previo(texto, inicio):
    """el bloque /* ... */ inmediatamente anterior, si lo hay"""
    antes = texto[:inicio].rstrip()
    if not antes.endswith("*/"): return ""
    ab = antes.rfind("/*")
    return texto[ab:inicio].strip() + "\n" if ab >= 0 else ""


def funciones_c(texto):
    """VMMaker: el tipo va en su propia linea, el nombre(args) en la siguiente"""
    fns = {}
    pat = re.compile(r"^(static\s+\w+|EXPORT\(\w+\)|sqInt|void|float|double|int)\s*\n"
                     r"(\w+)\(([^;{]*)\)\s*\n\{", re.M)
    for m in pat.finditer(texto):
        fin = bloque_por_llaves(texto, m.start())
        fns[m.group(2)] = (comentario_previo(texto, m.start()) + texto[m.start():fin]).strip()
    return fns


def funciones_js(texto):
    fns = {}
    for pat in (re.compile(r"^function (\w+)\(", re.M),
                re.compile(r"^(\w+) = function\s*\(", re.M)):
        for m in pat.finditer(texto):
            fin = bloque_por_llaves(texto, m.start())
            if fin < len(texto) and texto[fin] == ";": fin += 1
            fns[m.group(1)] = (comentario_previo(texto, m.start()) + texto[m.start():fin]).strip()
    return fns


c_txt, js_txt = open(C_SRC).read(), open(JS_SRC).read()
C, J = funciones_c(c_txt), funciones_js(js_txt)

if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)

pares = sorted(set(C) & set(J))
solo_c = sorted(set(C) - set(J))
solo_js = sorted(set(J) - set(C))

for n in pares:
    open(os.path.join(OUT, n + ".c"), "w").write(C[n] + "\n")
    open(os.path.join(OUT, n + ".js"), "w").write(J[n] + "\n")

with open(os.path.join(REF, "pares/INDICE.md"), "w") as f:
    f.write("# Índice de los pares C → JS\n\n")
    f.write("Generado por `partir-en-pares.py`. Cada par es la MISMA función: "
            "`funciones/<nombre>.c` es la que generó VMMaker desde el Smalltalk "
            "de Juan Vuletich, `funciones/<nombre>.js` es su traducción a mano.\n\n")
    f.write(f"- **{len(pares)} pares** (función traducida 1:1)\n")
    f.write(f"- {len(solo_c)} funciones del C sin par en JS\n")
    f.write(f"- {len(solo_js)} funciones del JS sin par en C (capa de compatibilidad)\n\n")
    f.write("## Los pares, por tamaño del C\n\n")
    f.write("| función | líneas C | líneas JS |\n|---|---:|---:|\n")
    for n in sorted(pares, key=lambda x: -C[x].count("\n")):
        f.write(f"| `{n}` | {C[n].count(chr(10))+1} | {J[n].count(chr(10))+1} |\n")
    if solo_c:
        f.write("\n## Sólo en C (no hicieron falta en JS)\n\n")
        for n in solo_c: f.write(f"- `{n}`\n")
    if solo_js:
        f.write("\n## Sólo en JS (shim sobre interpreterProxy, no viene del C)\n\n")
        for n in solo_js: f.write(f"- `{n}`\n")

print(f"pares: {len(pares)}  |  sólo C: {len(solo_c)}  |  sólo JS: {len(solo_js)}")
print("sólo C:", solo_c)
