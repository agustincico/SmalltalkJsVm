#!/usr/bin/env python3
"""Cose los grupos traducidos (vep-js/*.js) dentro de plugins/VectorEnginePlugin.js.

- Inserta las funciones antes de la sección '/*** module plumbing ***/'.
- Borra los stubs `var nombre = notYetTranslated;` de las funciones que llegan.
- Verifica: sintaxis (node --check), que las 32 funciones esperadas estén
  definidas exactamente una vez, y que no quede ningún stub vivo si están todas.
"""
import re, subprocess, sys, os

REPO = "/Users/agustin/SqueakJS"
SP = "/private/tmp/claude-501/-Users-agustin-SqueakJS/8ee00768-18c2-4641-a4de-6466e623ea98/scratchpad"
PLUGIN = f"{REPO}/plugins/VectorEnginePlugin.js"
ORDEN = ["geometria", "alphas", "blend", "texto", "path"]

ESPERADAS = set()
for g in ORDEN:
    c = open(f"{SP}/vep-grupos/{g}.c").read()
    for m in re.finditer(r"\n(\w+)\((?:void|sqInt|float|double|uint|int|unsigned|[a-zA-Z_]\w* )", c):
        pass  # los nombres reales salen abajo, del encabezado de cada función
    for m in re.finditer(r"\n(?:static )?(?:sqInt|void|float|double|int)\s*\n?(\w+)\(", c):
        ESPERADAS.add(m.group(1))
    for m in re.finditer(r"\nEXPORT\(sqInt\)\s*\n(\w+)\(", c):
        ESPERADAS.add(m.group(1))

piezas = []
definidas = {}
for g in ORDEN:
    ruta = f"{SP}/vep-js/{g}.js"
    if not os.path.exists(ruta):
        sys.exit(f"FALTA {ruta}")
    js = open(ruta).read()
    # aceptar las dos formas: declaración (function x(){}) o asignación (x = function(){})
    decl = re.findall(r"^function (\w+)\(", js, re.M)
    asig = re.findall(r"^(\w+) = function", js, re.M)
    nombres = decl + asig
    for n in nombres:
        if n in definidas:
            sys.exit(f"DUPLICADA: {n} está en {definidas[n]} y en {g}")
        definidas[n] = g
    piezas.append(f"/* ===== grupo {g} (traducido de utils/VectorEnginePlugin.ref/VectorEnginePlugin.c) ===== */\n\n{js.strip()}\n")

faltan = ESPERADAS - set(definidas)
extras = set(definidas) - ESPERADAS
print(f"esperadas: {len(ESPERADAS)} | definidas: {len(definidas)}")
if faltan: print("FALTAN:", sorted(faltan))
if extras: print("extras (helpers nuevos, revisar):", sorted(extras))

plugin = open(PLUGIN).read()
# para las DECLARACIONES hay que borrar el stub (la var lo pisaría al inicializar);
# para las ASIGNACIONES el stub debe quedar (es la declaración de la variable)
todas_decl = set()
for g in ORDEN:
    js = open(f"{SP}/vep-js/{g}.js").read()
    todas_decl |= set(re.findall(r"^function (\w+)\(", js, re.M))
for n in todas_decl:
    plugin, k = re.subn(rf"^var {n} = notYetTranslated;\n", "", plugin, flags=re.M)
marca = "/*** module plumbing ***/"
assert marca in plugin
plugin = plugin.replace(marca, "\n\n".join(piezas) + "\n" + marca)
# si ya no queda ningún stub, borrar notYetTranslated y encender COMPLETE... NO:
# COMPLETE se enciende a mano después de que el arnés valide. Solo avisar.
quedan = re.findall(r"^var (\w+) = notYetTranslated;", plugin, re.M)
print("stubs restantes:", quedan if quedan else "ninguno (cuando valide el arnés: COMPLETE = true)")
open(PLUGIN, "w").write(plugin)

r = subprocess.run(["node", "--check", PLUGIN], capture_output=True, text=True)
if r.returncode != 0:
    print("SINTAXIS ROTA:\n", r.stderr[:2000]); sys.exit(1)
print("sintaxis ok — cosido completo")
