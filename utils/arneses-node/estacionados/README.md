# Experimentos estacionados (con números, retesteables)

## activadores-por-metodo.patch (3-sep-2026)
Activadores especializados por método: la activación que `executeNewMethod`
hace de forma genérica (28% del self-time de benchFib), horneada por el jit
con constantes del método (args/temps/frame) y copia/fill desenrollados.
Semántica idéntica verificada con el parche puesto: ##DIF 1021158 y
##VERI 10/10 con ACTIVATORS=1.

**Resultado: 10/14 pares intercalados a favor, mediana +1,8-4% en benchFib,
distribuciones SOLAPADAS** — medido con Spotlight indexando (carga 10-18, el
peor entorno). No pasa la vara del proyecto (sp-local aterrizó con 12/12 sin
solaparse). Explicación probable: lo eliminado (branches, decode del header,
overhead de arrayCopy/Fill para 0-2 elementos) es chico; el costo real de la
activación son los ~20 stores del contexto, que la versión especializada
también paga.

Para retestear en máquina QUIETA: `git apply utils/arneses-node/estacionados/
activadores-por-metodo.patch`, y A/B con `ACTIVATORS=1` vs `=0` sobre
`30 benchFib` (scripts/fib de medir-tiny), 10+ pares intercalados. Si separa
distribuciones: batería completa (dif/veri/tiny/Pharo/humo Morphic) antes de
encender ningún default.
