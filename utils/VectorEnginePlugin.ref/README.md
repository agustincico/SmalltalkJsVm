# Referencia para portar el VectorEnginePlugin (API 7)

El material canónico para escribir `plugins/VectorEnginePlugin.js`, guardado acá
porque sus fuentes originales son frágiles (SqueakSource se cae seguido, y la
copia de GitHub en Cuis-Smalltalk-Dev está desactualizada en API 6).

- `VectorEnginePlugin-jmv.26.mcz` — el Slang canónico, API 7, 44 primitivas.
  Bajado del mirror Monticello http://www.squeaksource.com/VectorEnginePlugin/
  (15-nov-2025). Es un zip: `snapshot/source.st` trae el fuente.
- `VectorEnginePlugin.c` — el C generado desde ese MISMO jmv.26 (uuid
  4a7f4646-3609-4ce7-8e92-81a5f13c8ce5), tomado de OpenSmalltalk/opensmalltalk-vm
  `src/plugins/VectorEnginePlugin/VectorEnginePlugin.c`. Es el archivo exacto del
  que se compilan los .so/.dll que distribuye Cuis; la fuente de verdad para la
  traducción a JS (los casts de uint están explícitos acá, no en el Slang).

La imagen (Cuis 7.8) activa el motor con plugin sólo si la primitiva con nombre
`pluginApiVersion` del módulo `VectorEnginePlugin` responde exactamente 7
(`VectorEngineWithPlugin class>>isPluginAvailable`). OJO: no hay fallback por
primitiva — un módulo que responda 7 con primitivas incompletas rompe el render
en vez de degradarlo. Sin el módulo, la imagen usa su motor Smalltalk puro
(VectorEngineSmalltalk y subclases), que produce el mismo dibujo más lento: ese
motor es el oráculo de correctitud más barato para el port.
