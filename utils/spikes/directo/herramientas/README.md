# Herramientas del análisis de la forma directa (rescatadas del scratchpad, 5-sep-2026)

Artefactos de los 11 agentes del análisis (ver ../analisis/). Los que importan:

- `censo/censo-lib.js` — EL GATE: clasificador de elegibilidad por bytecodes, validado
  19.162/19.162 contra Cuis. Es la base del pase 1 del codegen.
- `censo/censo-bytecodes.js` — interpretación abstracta de profundidades (worklist):
  0 inconsistencias en Cuis; correrla sobre Pharo es prerrequisito para habilitar Pharo (R2).
- `censo/censo-dinamico.js` + salidas .json — cobertura dinámica por workload.
- `switch/censo-blk.js` — el gate BLK de loops para Etapa 2 (0 violaciones en 144k métodos).
- `switch/micro-*.js` — los micros que refutaron el switch-loop (x1,33-2,4) y validaron
  bloques etiquetados (x0,95-1,08).
- `estructura/` — parser estructural del diseño B (match 100% en ambas imágenes; no se usa
  en la síntesis, queda como evidencia).
- `trampas/escanear-heap.js` — verificador del invariante "number ⇒ entero" (76.137 slots,
  0 no-enteros) + experimento del contexto reciclado (21/22 slots de basura).
- `trampas/bordes.st` — batería de bordes aritméticos con ground truth impreso.
- `deopt/sonda-gc.js`, `gc.st`, `gc2.st` — sondas de GC sobre frames materializados (2.4).
- `deopt/spike-lineal.js`, `profundidad.st` — medición del tope de pila JS (RangeError
  2.755-11.022 en Node → tope 1000).
- `critico/spike-frontera.js` — LA PIEZA CLAVE: extensión del spike que ejercita las
  deopts de frontera D4/D5 con operandos repuestos y replay del send en el epílogo.
  Corrió verde: ##F28 1028457 exacto con 517 deopts (104 D5 + 12 D4 + 371 interrupt) y
  estrés de 300 switches idéntico. Es el test permanente de la Etapa 0.
- `critico/correr-cuis-conteo.js` — la evidencia de que sendCount NO es invariante en el
  arnés real (varianza intra-modo ~120): el invariante exacto solo vale bajo el oráculo
  determinista (utils/arneses-node/oraculo/).

OJO: el desensamblador Sista del repo tiene un bug upstream en mod/div de 0xFA — parchear
en el tooling antes de usar InstructionPrinter para validación (nota 4.3 del crítico).
