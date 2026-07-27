# Estado del proyecto — Smalltalk en el browser

> Documento de trabajo de este fork (`agustincico/SqueakJS`). No es del proyecto upstream.
> Última actualización: **2026-07-27**.

Sitio en vivo: **https://dialog.ar/SmalltalkJsVm/run/**

---

## 1. Qué está vivo hoy

| Imagen | Estado | Notas |
|---|---|---|
| **Squeak 6.0** | ✅ anda | `#zip=https://dialog.ar/Squeak.zip` |
| **Cuis 7.8** | ✅ anda | En vivo carga de `dialog.ar/Cuis.zip`. En `perf/stack-zone` ya está el link al **repo oficial** (sin deployar) |
| **Pharo 10 (32-bit)** | ✅ **anda bien** | Arranca **limpio** (sin debugger de FFI/git) y es **plenamente interactivo**. Es el que hay que mostrar |
| **Pharo 10 (64-bit)** | ⚠️ experimental | Arranca limpio y **renderiza**, pero el **mouse no llega a Morphic** (teclado sí) |
| **Dialogo** | ✅ anda | App de dibujo para chicos, `dialog.ar/Dialogo.zip` |

**Performance de Pharo** (medida con `sendCount` por tick, Chrome real):
- Arranque: **32-bit ≈ 5 s**, **64-bit ≈ 11 s** (el 64 pesa más por 8 bytes/oop).
- En reposo: **~23k sends/s en ambos** → la VM está casi dormida. **Pharo no es "pesado" en idle**;
  no hay ningún loop desbocado. El costo real es el arranque.

---

## 2. Deploy — ⚠️ NO hay auto-deploy

El sitio **no se sirve desde este repo**. Son dos repos y la copia es **manual**:

```
agustincico/SqueakJS          ProfeFuturo/profefuturo.github.io
      (el código)      ──────▶      └── SmalltalkJsVm/      ──────▶  dialog.ar
                        copia
                        MANUAL
```

No existe webhook ni GitHub Action (verificado: no hay `.github/workflows/` ni script de deploy).
**Pushear a `SqueakJS/main` no deploya nada por sí solo.**

### Runbook (2 pasos)

**Paso 1 — código a GitHub.** Ojo: la rama local `main` trackea `upstream` (codefrau), así que hay
que pushear explícito a `origin`:

```bash
git push origin main
```

**Paso 2 — copiar al repo del sitio.** El clone tiene que ser *disk-safe*: el historial pesa
~400 MB (binarios de Dialogo) y llena el disco.

```bash
git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/ProfeFuturo/profefuturo.github.io site
cd site && git sparse-checkout set SmalltalkJsVm     # aun así ocupa ~350 MB

# antes de copiar, confirmar que la copia del sitio == la versión previa de main,
# así el diff introduce SOLO el cambio buscado:
cmp <(git -C /ruta/SqueakJS show <commit-previo>:vm.interpreter.js) SmalltalkJsVm/vm.interpreter.js

cp /ruta/SqueakJS/<archivos-cambiados> SmalltalkJsVm/
git add SmalltalkJsVm/ && git commit && git push origin HEAD
cd .. && rm -rf site                                  # ¡borrar el clone al terminar!
```

**Paso 3 — verificar.** Pages reconstruye en ~1–2 min y hay CDN (`cache-control: max-age=600`),
así que hay que romper la caché:

```bash
curl -s "https://dialog.ar/SmalltalkJsVm/vm.interpreter.js?cb=$(date +%s)" | grep -c 'LGitLibrary'
```

Y después probar la imagen de verdad en Chrome (ver §5).

---

## 3. Ramas

| Rama | Trackea | Estado |
|---|---|---|
| `main` | `upstream` (codefrau) — pushear a `origin` explícito | Lo curado y deployable. Sincronizada con `origin/main` |
| `perf/stack-zone` | `origin` | **La rama de trabajo. 55 commits sin pushear a `origin`** |

`run/index.html` **difiere entre las dos ramas**: 10 hunks / 58 líneas. Lo que está solo en
`perf/stack-zone`:

- overlay de carga i18n (`L10N`, `setLoadingStage`, `sq-loading`) y señal `first-frame`
  (el canvas queda oculto hasta el primer frame real),
- link de **Cuis al repo oficial** (`raw.githubusercontent.com`),
- link a la **demo Morphic**.

> ⚠️ El `first-frame` existe **solo en `perf/stack-zone`**. Cualquier script de prueba que espere
> ese mensaje **se cuelga** contra el árbol de `main` → ahí usar screenshot temporizado.

---

## 4. Hallazgos técnicos (ronda 9)

### 4.1 Debugger de FFI/git eliminado ✅ deployado

**Causa:** al arrancar, Iceberg llama `LGitLibrary class>>startUp:` → `initializeLibGit2` →
`libgit2_init`, un callout FFI que SqueakJS no puede resolver. `initializeLibGit2` captura el
error pero hace `ex pass` → **re-lanza** → Pharo abre un debugger post-mortem sobre un mundo
por lo demás sano. **Idéntico en 32-bit** (`Cannot locate libgit2`) **y 64-bit**
(`FFICallout subclassResponsibility`) — el 32 solo parecía sano porque el debugger se cierra.

**Fix** (`vm.interpreter.js`, commit `4565ea9` en main + `af3a99c` en el sitio): nueva operación
**`neuter`** en `hackImage`, que vuelve un método `^self` sobrescribiendo su primer bytecode con
*return-receiver* (Sista `0x58` / V3 `0x78`), solo si `methodPrimitiveIndex() === 0`:

```js
{method: "LGitLibrary class>>startUp:", neuter: true, enabled: true},
```

Pharo entonces corre **sin git**, igual que en una máquina sin libgit2. `LGitLibrary` solo existe
en Pharo → es no-op en Cuis y Squeak.

> 🔑 **Por qué no alcanzaba el mecanismo viejo:** `primitive: returnSelf (256)` hace
> `m.pointers[0] |= prim`, que funciona en imágenes V3 pero **no en Spur**, donde la primitiva se
> decodifica del primer bytecode (`callPrimitive`), no del header. De ahí el sobrescribir bytecode.

Quedó solo un aviso "VM does not support TFFI Callbacks" que se auto-cierra.

### 4.2 Pharo 64-bit: el mouse no llega a Morphic ⚠️ sin resolver

- **No está colgado**: los sends siguen creciendo y el teclado sí llega (antes daba DNUs
  `SpToolCurrentApplicationCommand>>shortcutKey:`).
- **No es del lado del worker**: instrumentado, 32 y 64 muestran **exactamente el mismo patrón**
  (`pushed=3 gotNext=6 queue=0 semaIdx=0`) — ambos *pollean* la prim 94, sin semáforo. Los eventos
  entran igual en los dos.
- **Es del lado de la imagen**: `startup-compat64.st` restaura el `Sensor` clásico (por polling),
  pero los builds 64-bit son SDL2-only y enrutan el mouse por el modelo *event-driven* de
  OSWindow. El puente no cablea el mouse.
- Verificado por contraste: en **32-bit** el mismo test de clicks funciona perfecto (click en
  lista cambia el panel, se despliega el menú System).

### 4.3 Demo Morphic

`pharo/demo-startup.st` — ver `pharo/README.md`.

---

## 5. Cómo probar (tooling)

No hay `gh` CLI ni `puppeteer` instalados; sí **`puppeteer-core`** en `node_modules` y Chrome del
sistema. Los scripts hay que correrlos **desde la raíz del repo** (si no, no resuelve el módulo):

```js
const puppeteer = (await import("puppeteer-core")).default;   // ESM: import dinámico, no require
await puppeteer.launch({
  headless: "new",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--use-gl=swiftshader"],
});
```

- Servidor local: `npx http-server -p 8091 -c-1`
- Probar una imagen: `http://localhost:8091/run/index.html#zip=<url-del-zip>`
- Los zips de prueba (Pharo 32/64) **no** van en el repo — bajarlos de `dialog.ar/Pharo.zip` y
  `dialog.ar/Pharo64.zip`.
- Señal de arranque: en `perf/stack-zone` escuchar el postMessage `first-frame`; en `main`, esperar
  por tiempo.
- Para medir performance, interceptar los mensajes `tick` del worker y leer `sends`.

---

## 6. TODO

### Alta prioridad
- [ ] **Reconciliar `run/index.html`** entre `main` y `perf/stack-zone` (10 hunks / 58 líneas) y
      deployar: link de **Cuis al repo oficial**, **overlay de carga i18n** y link a la **demo**.
- [ ] **Publicar `Pharo-demo.zip`** en `dialog.ar` = contenido de `Pharo.zip` + `pharo/demo-startup.st`
      renombrado a `startup.st` en la raíz del zip. (La página en `perf/stack-zone` ya lo enlaza,
      así que hasta que se suba ese link quedaría roto.)
- [ ] **Pushear `perf/stack-zone` a `origin`** (55 commits solo locales, sin respaldo remoto).

### Media
- [ ] **Pharo 64-bit: arreglar el mouse** (§4.2). Es un bug hondo del puente de eventos, no trivial.
- [ ] **Diagnosticar Pharo 11 / 12 / 13** — nunca se hizo. Son 64-bit only, así que probablemente
      arrastren el mismo problema de input.

### Baja
- [ ] Bajar el tiempo de arranque del 64-bit (~11 s).
- [ ] `Character>>asByteArray` (FontSubstitutionDuringLoading) — sin diagnosticar, secundario.

---

## 7. Techo conocido: FFI

Pharo depende fuerte de FFI (`primitiveCalloutWithArgs`, `primitiveLoadSymbolFromModule`,
callbacks) para integrarse con el SO. **El FFI real no es viable en el sandbox del browser.** La
mayoría de los usos no son fatales (Pharo loguea y sigue); el que sí abría un debugger era el de
git/Iceberg, ya neutralizado.
