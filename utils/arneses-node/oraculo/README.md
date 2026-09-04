# Oráculo diferencial (portado de perf/stack-zone a main)

El detector de "valor silenciosamente equivocado": corre la imagen headless en un
entorno determinista (reloj virtual, random sembrado, WebSocket inerte) y acumula
un hash de la traza (sendCount/método/pc en checkpoints fijos de sendCount). Dos
corridas del mismo VM dan el mismo hash; una divergencia semántica da otro.

    node utils/arneses-node/oraculo/difftrace.js --golden --image <img> [--sends N]
    node utils/arneses-node/oraculo/difftrace.js          --image <img> [--sends N]   # compara, exit 1 si difiere
    --directo    carga el spike de forma directa (utils/spikes/directo/)
    --bench      reloj real (no determinista, para medir)
    --ui         display offscreen: levanta el World y hashea el DIBUJO (uidisplay.js)

Verificado en main (4-sep): hash estable 12cd7fee sobre el boot de Cuis 7.8
(3.014.759 sends), y --directo con el spike dormido = traza idéntica.

Trae del proyecto stack-zone las lecciones caras: checkpoints por sendCount (la
cadencia de slices difiere entre modos sin ser divergencia), hash independiente de
la representación (sends/método/pc; sp afuera), reloj congelado hasta el loop.
OJO para validar el codegen directo: las activaciones directas NO pasan por
executeNewMethod, así que el muestreador clásico no las ve — la validación del
codegen necesita su propio gancho de muestreo (env-gated) o validarse a nivel de
resultados + este oráculo para "todo lo demás no cambió".
golden.json es específico de máquina/imagen: gitignoreado.
