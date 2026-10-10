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

- [x] Crear `src/types.ts` con los tipos derivados del contrato SSE:
  - `ChatMessage`, `ChatSource`, `SourcesEvent`, `TokenEvent`, `DoneEvent`, `ErrorEvent`, `TurnState`.
- [x] Crear `src/chat/infrastructure/sse.ts` — parser puro de frames SSE (`parseSSE(data: string)` → evento o null; maneja frames partidos entre chunks, varios frames en un chunk, y payloads con `history`).
- [ ] Crear `src/conversation.ts`:
  - `createConversationStore()` — estado `messages` y `context` por separado.
  - `trimHistory(messages, limits)` — recortes de 20 mensajes / 2000 chars por mensaje / 8000 total (alineados con `.env` del API).
  - `mergeContext(sourcesHistory)` — sustituye `context` por el historial del servidor.
  - `buildChatRequest(text, context)` — genera el cuerpo de `POST /api/chat`.
  - `saveToSessionStorage(messages, context)` y `loadFromSessionStorage()` — validación tolerante, clave versionada `chatbox:v1`.
- [ ] Tests unitarios de `sse.ts` y `trimHistory`.

## Paso 2 — Hook `useChatStream`

- [ ] Crear `src/hooks/useChatStream.ts`:
  - Estados internos: `idle | connecting | generating | streaming | error | aborted`.
  - `sendQuestion(text)` — fetch con `ReadableStream` + `AbortController`.
  - Parseo de frames SSE en un loop asíncrono con `requestAnimationFrame` para agrupar tokens.
  - Timeout de 30 s (configurable).
  - `abort()` — callable desde el componente.
- [ ] Manejo de errores de red/CORS (`TypeError`), 400/413/429/5xx con textos propios (sección 7 del spec).
- [ ] Test del hook con `fetch` simulado: secuencia normal, sin contexto, error mid-stream, abort, timeout.

## Paso 3 — Componente `Chatbox`

- [ ] Crear `src/components/Chatbox.tsx`:
  - Props: `apiUrl` (obligatoria), `suggestions?`, `contactUrl?`, `title?`.
  - Estructura HTML semántica (sección 4 del spec).
- [ ] `RF-F01` — Cabecera con nombre, etiqueta "IA", aviso de alcance.
- [ ] `RF-F02` — Estado vacío con sugerencias clickables.
- [ ] `RF-F03` — Textarea con autogrow (max 5 líneas), contador al 80% del límite de 1000 chars.
- [ ] `RF-F04` — `Enter` envía, `Shift+Enter` salto de línea; IME `isComposing` no envía.
- [ ] `RF-F05` — Botón "Enviar" ↔ "Detener"; `Esc` aborta.
- [ ] `RF-F06` — Scroll automático solo si está a <80 px del final; botón "Ir al final" si no.
- [ ] `RF-F07` — Mensajes del usuario: texto plano.
- [ ] `RF-F10` — Burbuja del usuario + burbuja vacía del asistente con indicador "escribiendo".
- [ ] `RF-F11` — Tokens agrupados por `requestAnimationFrame`.
- [ ] `RF-F12` — Mensaje local de "no lo tengo" cuando `sources: []` + `done` sin tokens.
- [ ] `RF-F14` — No mostrar nunca el `message` de un `error` ni JSON de error.
- [ ] `RF-F15` — Guardar `sources` en estado sin mostrarlas (MVP).
- [ ] `RF-F20` — Estado con `messages` y `context` separados.
- [ ] `RF-F21` — Recorte de historial en cada petición.
- [ ] `RF-F22` — `context` se sustituye por el `history` del evento `sources`.
- [ ] `RF-F23` — Al recibir `done`, añadir par `{user, assistant}` a `context`.
- [ ] `RF-F24` — Persistencia en `sessionStorage` bajo clave versionada.
- [ ] `RF-F25` — Botón "Nueva conversación" con confirmación en línea.
- [ ] `RF-F26` — Nota discreta cuando el servidor recorta el historial.

## Paso 4 — Renderizado y estilos

- [ ] `RF-F30` — `react-markdown` con `allowedElements` (`p`, `strong`, `em`, `code`, `a`, `ul`, `ol`, `li`), sin `rehype-raw`, `urlTransform` solo `http(s):` y `mailto:`. Carga diferida con `import()`.
- [ ] `RF-F31` — Enlaces en pestaña nueva con `rel="noopener noreferrer"`, color contrastante y subrayado.
- [ ] `RF-F61` — Variables CSS `--chatbox-*` heredadas del sitio + `prefers-color-scheme`.
- [ ] `RF-F62` — Textos de UI centralizados en `src/strings.es.ts`.
- [ ] Estilos propios con clase raíz `.chatbox`; sin dependencia de estilos globales.

## Paso 5 — Accesibilidad

- [ ] `RF-F40` — Navegación completa por teclado, foco visible, foco vuelve al textarea tras enviar.
- [ ] `RF-F41` — Región `role="status"` / `aria-live="polite"` para anuncios; lista de mensajes no es región viva.
- [ ] `RF-F42` — Contraste mínimo 4.5:1 / 3:1 en tema claro y oscuro.
- [ ] `RF-F43` — Controles táctiles ≥ 44×44 px.
- [ ] `RF-F44` — `prefers-reduced-motion`: sin animación del indicador ni scroll suave.
- [ ] `RF-F45` — Label en textarea, `aria-label` en botones solo-icono, `lang="es"` en componente.
- [ ] Pasada automática con axe + prueba manual con NVDA y VoiceOver (`RF-F41`).

## Paso 6 — Responsive y móvil

- [ ] `RF-F50` — Altura con `dvh`, `env(safe-area-inset-*)`, `font-size` ≥ 16 px en textarea (evitar zoom iOS).
- [ ] `RF-F51` — Ajuste con `visualViewport` si el chat va a pantalla completa o flotante.

## Paso 7 — Integración con Astro

- [ ] Estructura de archivos en `src/components/chatbox/` (o adaptar paths).
- [ ] Configurar `@astrojs/preact` en Astro con `compat: true` (redirige `react` → `preact/compat`).
- [ ] `PUBLIC_CHAT_API_URL` en `.env` del frontend; alineación con `CORS_ORIGIN` del API (4321 en dev).
- [ ] Verificación de CORS en desarrollo.
- [ ] Test de integración: montar componente, enviar pregunta, recibir streaming.

## Paso 8 — Pruebas y validación

- [ ] Tests unitarios de `sse.ts` (frames partidos, varios en un chunk, payloads con `history`).
- [ ] Tests de `trimHistory` y lectura tolerante de storage.
- [ ] Tests del hook con fetch simulado.
- [ ] Tests del componente (`@testing-library/preact`): Enter/Shift+Enter, Enviar↔Detener, estado vacío, reintento.
- [ ] Test de accesibilidad con axe-core.
- [ ] Prueba manual en móvil real (iOS Safari): teclado virtual, safe areas, zoom.
- [ ] Verificar build de producción (`npm run build`) con react-markdown y Preact Compat.
- [ ] Flujo completo: instalación limpia, `npm install`, dev server, chat con streaming real.

## Pendiente de decisión (no bloqueante)

- **Formato de integración en Astro**: embebido en sección (`client:visible`) o botón flotante (`client:idle`).
- **Persistencia**: `sessionStorage` (propuesta) vs `localStorage` vs solo memoria.
- **Timeout de 30 s y límites del cliente**: valores iniciales; ajustar tras medir latencia real.
