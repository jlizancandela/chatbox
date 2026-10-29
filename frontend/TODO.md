# TODO — Frontend Chatbox (Preact + Vite)

Este archivo refleja el estado real de `docs/stitch-frontend-design/SPEC-FRONTEND.md`.

## Paso 0 — Proyecto base y herramientas ✅

- [x] Crear proyecto Vite + Preact + TypeScript (`npm create vite -- --template preact-ts`).
- [x] Instalar `@preact/preset-vite` para JSX, HMR y Compat.
- [x] Instalar y configurar Biome (`biome.json`) con indent tab, lineWidth 100, preset recommended.
- [x] Instalar `react-markdown` con Preact Compat verificado.
- [x] Crear `vite-env.d.ts` con referencia a `vite/client`.
- [x] Scripts `lint`, `lint:fix`, `format` en `package.json`.

## Paso 1 — Infraestructura de tipos y utilidades

- [x] Crear `src/chat/types.ts` con los tipos derivados del contrato SSE:
  - `ChatMessage`, `ChatSource`, `SourcesEvent`, `TokenEvent`, `DoneEvent`, `ErrorEvent`, `TurnState`.
- [x] Crear `src/chat/infrastructure/sse.ts` — parser puro de frames SSE (`parseSSE(data: string)` → evento o null; maneja frames partidos entre chunks, varios frames en un chunk, y payloads con `history`).
- [x] Crear `src/chat/domain/conversation.ts`:
  - `chatReducer()` y `useChat()` — estado reactivo local de `messages`, `context` y ciclo del turno.
  - `trimHistory(messages, limits)` — recortes de 20 mensajes / 2000 chars por mensaje / 8000 total (alineados con `.env` del API).
  - `mergeContext(sourcesHistory)` — sustituye `context` por el historial del servidor.
  - `buildChatRequest(text, context)` — genera el cuerpo de `POST /api/chat`.
  - `saveToSessionStorage(messages, context)` y `loadFromSessionStorage()` en `src/chat/infrastructure/storage.ts` — validación tolerante, clave versionada `chatbox:v1`.
- [x] Crear `src/chat/application/chat-reducer.ts` y `src/chat/hooks/useChat.ts` para el estado reactivo local.
- [x] Mover `sessionStorage` a `src/chat/infrastructure/storage.ts`.
- [x] Tests unitarios de `sse.ts`, conversación, reducer y storage.

## Paso 2 — Hook `useChatStream`

- [x] Crear `src/chat/hooks/useChatStream.ts`:
  - Estados internos: `idle | connecting | generating | streaming | error | aborted`.
  - `sendQuestion(text)` — fetch con `ReadableStream` + `AbortController`.
  - Parseo de frames SSE en un loop asíncrono con `requestAnimationFrame` para agrupar tokens.
  - Timeout de 30 s (configurable).
  - `abort()` — callable desde el componente.
- [x] Manejo de errores de red/CORS (`TypeError`), 400/413/429/5xx con textos propios (sección 7 del spec).
- [x] Test del hook con `fetch` simulado: secuencia normal, sin contexto, error mid-stream, abort, timeout.

## Paso 3 — Componente `Chatbox`

- [x] Crear `src/components/Chatbox.tsx`:
  - Props: `apiUrl` (obligatoria), `suggestions?`, `contactUrl?`, `title?`.
  - Estructura HTML semántica (sección 4 del spec).
- [x] `RF-F01` — Cabecera con nombre, etiqueta "IA", aviso de alcance.
- [x] `RF-F02` — Estado vacío con sugerencias clickables.
- [x] `RF-F03` — Textarea con autogrow (max 5 líneas), contador al 80% del límite de 1000 chars.
- [x] `RF-F04` — `Enter` envía, `Shift+Enter` salto de línea; IME `isComposing` no envía.
- [x] `RF-F05` — Botón "Enviar" ↔ "Detener"; `Esc` aborta.
- [x] `RF-F06` — Scroll automático mientras está a menos de 16 px del final; botón "Ir al final" si no. El umbral vive en el dominio, el seguimiento sigue al tamaño del hilo y no lo corta una animación en curso (#102, #108).
- [x] `RF-F07` — Mensajes del usuario: texto plano.
- [x] `RF-F10` — Burbuja del usuario + burbuja vacía del asistente con indicador "escribiendo".
- [x] `RF-F11` — Tokens agrupados por `requestAnimationFrame`.
- [x] `RF-F12` — Mensaje local de "no lo tengo" cuando `sources: []` + `done` sin tokens.
- [x] `RF-F14` — No mostrar nunca el `message` de un `error` ni JSON de error.
- [x] `RF-F15` — Guardar `sources` en estado. Desde la issue #110 también se muestran: cada respuesta nombra los documentos de los que viene.
- [x] `RF-F20` — Estado con `messages` y `context` separados.
- [x] `RF-F21` — Recorte de historial en cada petición.
- [x] `RF-F22` — `context` se sustituye por el `history` del evento `sources`.
- [x] `RF-F23` — El reducer añade al recibir `done` el par `{user, assistant}` a `context`.
- [x] `RF-F24` — Persistencia en `sessionStorage` bajo clave versionada.
- [x] `RF-F25` — Botón "Nueva conversación" con confirmación en línea.
- [x] `RF-F26` — Nota discreta cuando el servidor recorta el historial.
- [x] Línea de fuentes bajo la respuesta del asistente, con los documentos distintos, y su anuncio en la región de estado (#110).

## Paso 4 — Renderizado y estilos

- [x] `RF-F30` — `react-markdown` con `allowedElements` (`p`, `strong`, `em`, `code`, `a`, `ul`, `ol`, `li`), sin `rehype-raw`, `urlTransform` solo `http(s):` y `mailto:`. Carga diferida con `import()`.
- [x] `RF-F31` — Enlaces en pestaña nueva con `rel="noopener noreferrer"`, color contrastante y subrayado. SafeLink renombrado a ExternalLink; estilos aplicados a todos los enlaces.
- [x] `RF-F61` — Variables CSS `--chatbox-*` heredadas del sitio + `prefers-color-scheme`; resolución verificada en navegador real con Playwright para T2/T3/T4 y axe-core (issue #62).
- [x] Paleta y formas del widget adaptadas al export de Stitch (`docs/stitch-frontend-design`): roles Material 3 (`primary #00685f`, `on-surface #1a1b22`, `surface-container #eeedf7`, `outline #6d7a77`); la capa oscura se deriva de los roles inversos/fixed del mismo export, que no trae esquema dark. Tres tokens tonales añadidos (`surface-subtle`, `surface-raised`, `accent-container`) más superficies sin borde con separación tonal, radios 16/12/píldora y objetivos táctiles de 44 px. El borde de `outline-variant` no se usa: no llegaba a 3:1 contra la superficie.
- [x] Selectores de `Chatbox.css` sincronizados con el markup: el estado vacío monta `nav > ul > li` (no `ol`) y `.chatbox__conversation-actions` ya tiene fila propia. Guardia de regresión en `test/browser/widget-appearance.spec.ts`.
- [x] `RF-F62` — Textos de UI centralizados en `src/strings.es.ts`.
- [x] Estilos propios con clase raíz `.chatbox`; sin dependencia de estilos globales (RF-F61/L6; guardia en `test/unit/chatbox-scoped-styles.test.ts` y `test/browser/scoped-styles.spec.ts`).

## Paso 5 — Accesibilidad

- [x] `RF-F40` — Navegación completa por teclado, foco visible, foco vuelve al textarea tras enviar. Enter no cancela una respuesta en curso; foco gestionado en la confirmación de "Nueva conversación" (#86, #87, #88, #89).
- [x] `RF-F41` — Región `role="status"` / `aria-live="polite"` para anuncios; lista de mensajes no es región viva.
- [x] `RF-F42` — Contraste mínimo 4.5:1 / 3:1 en tema claro y oscuro; contrato de contraste con guarda de tokens (#96).
- [x] `RF-F43` — Controles táctiles ≥ 44×44 px: suelo en px absolutos (no en `rem`, que dependía del `font-size` del host), `min-width` añadida, contrato con inventario y guarda de identidad por control, y medición real en Chromium por estado (#98).
- [x] `RF-F44` — `prefers-reduced-motion`: el indicador de escritura son tres puntos que solo se animan con movimiento permitido, y el scroll no es suave. Contrato con inventario y guarda, verificado en dos niveles —mecanismo y resolución en Chromium— (#100).
- [x] `RF-F46` — La respuesta se ve una sola vez: la región de estado anuncia siempre y pinta solo lo que no está en la conversación; la burbuja muestra el indicador mientras carga el markdown (#104).
- [x] `RF-F47` — El aviso «El asistente está escribiendo» se ve dentro del bocadillo y la región de estado lo anuncia sin pintarlo; la copia visible es decorativa (#106).
- [x] `RF-F45` — Label en textarea, `aria-label` en botones solo-icono, `lang="es"` en componente. Contrato y guarda: reglas (etiqueta asociada, nombre accesible, botón solo-icono, idioma) con mecanismo en jsdom y resolución en Chromium (#112).
- [x] Pasada automática con axe sobre el widget en todos sus estados y en los dos esquemas de color; RF-F41 se cierra con dos niveles, sin nivel manual (#113).

## Paso 6 — Responsive y móvil

- [x] `RF-F50` — Altura con `dvh`, `env(safe-area-inset-*)`, `font-size` ≥ 16 px en textarea (evitar zoom iOS). La altura la da el host y el tope es `100dvh`; la safe area se suma al padding base en cabecera, hilo y pie; el campo declara `max(1rem, 16px)` como suelo absoluto. Contrato con guarda de mecanismo y resolución en Chromium, y sin nivel manual (`.specs/RF-F50-viewport-movil.md`).
- [x] `RF-F51` — Ajuste con `visualViewport` si el chat va a pantalla completa o flotante: el widget reserva en su raíz la franja que tapa el teclado —y solo si está anclado al borde inferior de la pantalla—; el pie con el campo de texto queda por encima del teclado y el hilo no pierde su final. Contrato con guarda de mecanismo y resolución en Chromium, y sin nivel manual (`.specs/RF-F51-teclado-virtual.md`, #119).

## Paso 7 — Distribución como paquete npm

La integración con Astro será un caso de consumo, no el objetivo principal. El
widget se distribuye desde npm como **fuente** (sin `dist`, sin build al instalar): el
bundler del sitio lo compila. El custom element cubre el consumo sin framework
(HTML plano, CMS, WordPress) sin convertir el paquete en un bundle «universal».

- [x] `RF-F64` — Variante flotante con estado contraído: el widget se ancla a la esquina inferior derecha y nace reducido a un lanzador circular de 56×56 que abre el panel. Contraer no interrumpe el turno ni borra la conversación. Cierra el formato del widget (embebido o flotante) que SPEC-FRONTEND §12.2 dejó abierto (#127, `.specs/RF-F64-modo-contraido.md`).
- [x] Separar la app/demo Vite del paquete distribuible: el tarball lleva el código del widget y nada más (`files` en `package.json`).
- [x] Crear un paquete publicable con API y configuración estables (`@jlizancandela/chatbox`).
- [x] Exponer `Chatbox` como componente Preact para consumidores con framework (export `.`).
- [x] Exponer un custom element `<chatbox-widget>` para uso universal desde HTML (export `./element`).
- [x] Recibir `apiUrl` y opciones mediante props/atributos; no hardcodear URLs de producción.
- [x] Documentar instalación y uso vía NPM, HTML plano, Astro y Preact (`frontend/README.md`).
- [ ] Configurar versionado, releases y publicación: la identidad del paquete está lista (`npm version` + el workflow `publish-widget.yml`, que publica en GitHub Packages con el `GITHUB_TOKEN`, sin cuenta de npm ni token propio). Falta la primera versión publicada y el PAT que usa el sitio para instalarlo.

### Decisiones cerradas

- [x] El paquete oficial incluye el componente Preact y el custom element, en exports separados.
- [x] Nombre y scope: `@jlizancandela/chatbox`. El nombre de npm es irreversible.
- [x] Sin CDN: el sitio ya se sirve desde un CDN (Netlify) y el paquete se instala con npm. Se cae la idea de bundles browser/CDN y de un paquete «universal» desde HTML plano: el custom element sobrevive como «el widget sin integrar Preact».

### Decisiones pendientes

- [ ] Cuándo se publica la primera versión (`0.1.0`) y con qué cuenta de npm.

## Paso 8 — Pruebas y validación

- [x] Tests unitarios de `sse.ts` (frames partidos, varios en un chunk, payloads con `history`).
- [x] Tests de `trimHistory` y lectura tolerante de storage.
- [x] Tests del hook con fetch simulado.
- [x] Tests del componente (`@testing-library/preact`): Enter/Shift+Enter, Enviar↔Detener, estado vacío, reintento.
- [x] Test de accesibilidad con axe-core sobre `.chatbox` en navegador real (#113: la pasada recorre los nueve estados del widget en claro y en oscuro).
- [ ] **Galería de estados** del widget en la página de desarrollo: una URL por estado (`?state=answered|error|aborted|restored|confirm|collapsed`), con datos falsos y sin API, para poder mirar cada estado sin tener que romper algo a propósito. La lista de estados está duplicada hoy —la de la pasada de axe vive en `test/browser/accessibility.spec.ts`—: extraerla a un módulo compartido y que la usen la galería y los contratos, para no inventar un vocabulario nuevo.
- [ ] **Regresión visual** con Playwright (`toHaveScreenshot`) sobre el widget en los estados clave: el baseline es un fichero que se commitea y el CI de Ubuntu genera el suyo.
- [x] Verificar build de producción (`npm run build`) con react-markdown y Preact Compat.
- [ ] Flujo completo: instalación limpia, `npm install`, dev server, chat con streaming real.

## Pendiente de decisión (no bloqueante)

- **Integración Astro**: el widget tiene las dos variantes (embebida y flotante, RF-F64); queda elegir cuál monta el sitio y si la flotante va con `client:idle`.
- **Persistencia**: decidido `sessionStorage`; queda pendiente integrarla en el componente `Chatbox`.
- **Timeout de 30 s y límites del cliente**: valores iniciales; ajustar tras medir latencia real.
- **Galería de estados y Storybook**: con la galería propia de la página de desarrollo alcanza. **No** se mete Storybook mientras el widget tenga un solo consumidor: su infraestructura aportaría más que el catálogo. Cuando el Paso 7 lo convierta en paquete distribuible, la galería pasa a ser la documentación del paquete, y ahí Storybook —o su build estático publicado junto al paquete— sí se justifica.
