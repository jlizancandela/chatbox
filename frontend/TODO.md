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
- [x] `RF-F06` — Scroll automático solo si está a <80 px del final; botón "Ir al final" si no.
- [x] `RF-F07` — Mensajes del usuario: texto plano.
- [x] `RF-F10` — Burbuja del usuario + burbuja vacía del asistente con indicador "escribiendo".
- [x] `RF-F11` — Tokens agrupados por `requestAnimationFrame`.
- [x] `RF-F12` — Mensaje local de "no lo tengo" cuando `sources: []` + `done` sin tokens.
- [x] `RF-F14` — No mostrar nunca el `message` de un `error` ni JSON de error.
- [x] `RF-F15` — Guardar `sources` en estado sin mostrarlas (MVP).
- [x] `RF-F20` — Estado con `messages` y `context` separados.
- [x] `RF-F21` — Recorte de historial en cada petición.
- [x] `RF-F22` — `context` se sustituye por el `history` del evento `sources`.
- [x] `RF-F23` — El reducer añade al recibir `done` el par `{user, assistant}` a `context`.
- [x] `RF-F24` — Persistencia en `sessionStorage` bajo clave versionada.
- [x] `RF-F25` — Botón "Nueva conversación" con confirmación en línea.
- [x] `RF-F26` — Nota discreta cuando el servidor recorta el historial.

## Paso 4 — Renderizado y estilos

- [x] `RF-F30` — `react-markdown` con `allowedElements` (`p`, `strong`, `em`, `code`, `a`, `ul`, `ol`, `li`), sin `rehype-raw`, `urlTransform` solo `http(s):` y `mailto:`. Carga diferida con `import()`.
- [x] `RF-F31` — Enlaces en pestaña nueva con `rel="noopener noreferrer"`, color contrastante y subrayado. SafeLink renombrado a ExternalLink; estilos aplicados a todos los enlaces.
- [x] `RF-F61` — Variables CSS `--chatbox-*` heredadas del sitio + `prefers-color-scheme`; resolución verificada en navegador real con Playwright para T2/T3/T4 y axe-core (issue #62).
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

- [x] Tests unitarios de `sse.ts` (frames partidos, varios en un chunk, payloads con `history`).
- [x] Tests de `trimHistory` y lectura tolerante de storage.
- [x] Tests del hook con fetch simulado.
- [ ] Tests del componente (`@testing-library/preact`): Enter/Shift+Enter, Enviar↔Detener, estado vacío, reintento.
- [x] Test de accesibilidad con axe-core sobre `.chatbox` en navegador real.
- [ ] Prueba manual en móvil real (iOS Safari): teclado virtual, safe areas, zoom.
- [x] Verificar build de producción (`npm run build`) con react-markdown y Preact Compat.
- [ ] Flujo completo: instalación limpia, `npm install`, dev server, chat con streaming real.

## Pendiente de decisión (no bloqueante)

- **Formato de integración en Astro**: embebido en sección (`client:visible`) o botón flotante (`client:idle`).
- **Persistencia**: decidido `sessionStorage`; queda pendiente integrarla en el componente `Chatbox`.
- **Timeout de 30 s y límites del cliente**: valores iniciales; ajustar tras medir latencia real.
