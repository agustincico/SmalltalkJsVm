# Arneses de Node rescatados de la sesión de trabajo (ago 2026)

Vivían en el scratchpad efímero de la sesión de Claude Code y se rescataron acá porque
`/private/tmp` se limpia solo. Ver `ESTADO.md` en la raíz para el contexto completo.

- `correr-cuis.js` — runner genérico de imágenes Cuis bajo Node (`node correr-cuis.js
  <imagen> [script.st] [segundos]`): levanta la VM headless, inyecta un doit por Compiler
  evaluate: cuando la imagen se calma, y reporta sends/errores. Fue la herramienta base de
  validación de toda la sesión (bug del header 64-bit, primitiva 578, VectorEnginePlugin).
- `correr-mutex.js` + `probar-mutex[2-4].st` — reproducen la carrera de la primitiva 578
  (suspend con backup del PC): sin la reposición de la variable de condición en el tope de
  pila, un proceso resumido entra a la sección crítica de un Mutex sin ser dueño.
- `correr-prio.js` — variante con procesos de distintas prioridades.
- `correr-rev.js` — variante de verificación al revés (presencia del resultado, no ausencia
  del síntoma).
