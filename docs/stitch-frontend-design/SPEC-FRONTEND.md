# Especificación — Frontend del Chatbox

Estado: borrador · 2026-10-05 · framework y Markdown decididos (Preact + react-markdown)
Ámbito: componente de chat que se monta en Astro y consume `POST /api/chat` (SSE).

---

## 1. Propósito y alcance

El bot es un RAG de portfolio. Por el system prompt de la API, responde en **máximo 3 frases, sin listas, en tercera persona y solo sobre el CV y el informe de GitHub de Jorge**.

El alcance sale de cruzar los requisitos genéricos de chatbot con lo que la API ofrece de verdad. Lo que no tiene respaldo en el backend, o no aplica a respuestas de tres frases, queda fuera (sección 11).

---

## 2. Decisión de framework

| Opción | A favor | En contra |
|---|---|---|
| **Preact** (recomendada) | ~3–4 KB gzip. Misma API de hooks que React, así que el diseño `useChatStream` de las librerías conocidas se traslada tal cual. Integración oficial con Astro (`@astrojs/preact`). Ya se usó en el proyecto de reservas. | Las librerías React-first (AI SDK, assistant-ui) solo funcionan con `compat` y sin garantías. |
| React | Ecosistema completo; es lo que exigirían AI SDK o assistant-ui si se adoptan en fase 2. | Decenas de KB más (React + ReactDOM) para una isla que solo muestra un chat corto. |
| Vue | Buena DX e integración con Astro. | Un tercer framework sin ventaja técnica para este caso; el diseño de las librerías conocidas está pensado en hooks de React. |
| Lit | Web Component estándar, Shadow DOM aísla estilos, reutilizable fuera de Astro. | Más boilerplate para estado asíncrono y renderizado condicional; sin ecosistema de hooks; el Markdown y el estado se resuelven a mano. |

**Decisión tomada: Preact + hook propio `useChatStream`** (fetch + `ReadableStream` + `AbortController`) + `react-markdown`.

- Escribir solo con hooks estándar. Como se usa `react-markdown`, activar `compat: true` en `@astrojs/preact` (redirige `react` y `react-dom` a `preact/compat`).
- Verificar en la primera prueba que `react-markdown` renderiza bajo `compat` antes de construir encima.
- Migrar a React después es cambiar la integración de Astro, no el código del componente.
- Elegir **Lit** solo si el objetivo es publicar el chat como web component independiente de Astro, o demostrar esa habilidad.
- Elegir **React** solo si en fase 2 se adopta AI SDK o assistant-ui. Ojo: ninguno habla el contrato SSE propio (`sources/token/done/error`), así que habría que escribir un adaptador.

---

## 3. Contrato con la API

### Petición

`POST {apiUrl}/api/chat` · `Content-Type: application/json` · límite de cuerpo **16 KB**.

```json
{ "question": "string", "history": [{ "role": "user|assistant", "content": "string" }] }
```

- El schema tiene `additionalProperties: false`: solo `question` y `history`; cada mensaje solo `role` y `content`.
- `question`: 1–1000 caracteres tras `trim()` (el schema exige `minLength: 1`; el máximo lo aplica la ruta con `INVALID_QUESTION`).
- `history[].content`: máximo 2000 caracteres, si no hay `400`.
- Límites de recorte del servidor (por defecto): 20 mensajes, 2000 caracteres por mensaje, 8000 en total.

### Respuesta de éxito (`text/event-stream`)

Frames separados por `\n\n`, con `event:` y `data:` (JSON en una sola línea).

| Evento | Datos reales | Notas |
|---|---|---|
| `sources` | `{ "sources": [{documentId, chunkIndex, content, distance}], "history": [{role, content}] }` | Se emite antes de llamar al modelo. |
| `token` | `{ "token": "..." }` | Uno o más. |
| `done` | `{}` | Fin normal. |
| `error` | `{ "message": "..." }` | Mensaje genérico en inglés, sin detalles internos. |

### Errores previos al stream (JSON)

Forma: `{ "error": { "code": "...", "message": "..." } }`

| HTTP | `code` | Causa |
|---|---|---|
| 400 | `INVALID_QUESTION` / `VALIDATION_ERROR` | Pregunta vacía o larga; cuerpo inválido; mensaje de historial >2000. |
| 413 | `REQUEST_TOO_LARGE` | Cuerpo >16 KB. |
| 429 | `RATE_LIMIT_EXCEEDED` | 20 peticiones/minuto o 100/día por IP. |
| 500 | `INTERNAL_ERROR` | Fallo inesperado. |

### Puntos del contrato que cambian la implementación

1. **El README no documenta `history` dentro de `sources`**, pero el código y el RF-20a sí lo emiten. Se toma el código como verdad.
2. **El `history` devuelto es el historial de entrada recortado.** No incluye la pregunta actual ni la respuesta nueva. El cliente las añade al terminar.
3. **Sin contexto suficiente no hay ningún `token`**: llega `sources: []` y `done`. El texto de "no lo sé" lo tiene que pintar el front.
4. **`error` puede llegar antes de `sources`** (si falla la búsqueda vectorial), con HTTP 200 ya enviado.
5. **El front debe recortar el historial antes de enviarlo.** Sin recorte, 20 mensajes de 2000 caracteres superan el límite de 16 KB y la petición falla con `413`.
6. **Si el cliente aborta**, el servidor cancela la llamada a Groq y no emite `error`.
7. **CORS admite un único origen** (`CORS_ORIGIN`). `.env.example` trae `http://localhost:3000`; el dev server de Astro usa `4321` por defecto. Alinearlos o la petición fallará por CORS en desarrollo.
8. `Retry-After` no es legible desde JS entre orígenes salvo que el API lo añada a `exposedHeaders`. No depender de él.

---

## 4. Requisitos funcionales (EARS)

Prioridad: **I** imprescindible · **R** recomendable.

### A. Interfaz base

| ID | Requisito | P |
|---|---|---|
| RF-F01 | Cuando se monte el componente, mostrará cabecera con nombre del asistente, etiqueta "IA" y aviso de alcance ("Responde solo con información del CV y GitHub de Jorge. Puede equivocarse."). | I |
| RF-F02 | Mientras no haya mensajes, mostrará un estado vacío con 3–4 sugerencias configurables; pulsar una la envía como pregunta. | I |
| RF-F03 | Cuando el usuario escriba, el campo de texto (textarea multilínea) crecerá hasta un máximo de 5 líneas y mostrará un contador cuando se supere el 80 % del límite de 1000 caracteres. No permitirá enviar si el texto tras `trim()` está vacío o supera 1000. | I |
| RF-F04 | `Enter` enviará el mensaje y `Shift+Enter` insertará salto de línea. `Enter` durante composición IME (`isComposing`) no enviará. | I |
| RF-F05 | Mientras haya una respuesta en curso, el botón Enviar se sustituirá por Detener, que aborta la petición. `Esc` tendrá el mismo efecto. | I |
| RF-F06 | Al añadirse contenido, el área de mensajes bajará automáticamente solo si el usuario estaba a menos de ~80 px del final; si no, mostrará un botón "Ir al final". | I |
| RF-F07 | Los mensajes del usuario se renderizarán como texto plano, nunca como HTML. | I |

### B. Streaming y feedback

| ID | Requisito | P |
|---|---|---|
| RF-F10 | Al enviar, se añadirá la burbuja del usuario y una burbuja vacía del asistente con indicador "escribiendo" hasta el primer `token`, `done` o `error`. | I |
| RF-F11 | Cada `token` se concatenará a la burbuja en curso. Los tokens se agruparán por frame de animación (`requestAnimationFrame`) para no renderizar en cada token. No habrá retardo artificial. | I |
| RF-F12 | Si llega `sources: []` seguido de `done` sin tokens, la burbuja mostrará un mensaje local fijo ("Eso no lo tengo en la información que manejo. Puedes escribirle a Jorge directamente.") con el enlace de contacto. | I |
| RF-F13 | Si no llega ningún frame en 30 s (valor configurable), se abortará la petición y se tratará como error de red. | I |
| RF-F14 | El front no mostrará nunca el `message` de un evento `error` ni de un JSON de error; usará textos propios según la tabla de la sección 7. | I |
| RF-F15 | Las `sources` se guardarán en el estado del mensaje, pero no se mostrarán en el MVP. | R |

### C. Conversación e historial

| ID | Requisito | P |
|---|---|---|
| RF-F20 | El estado mantendrá dos estructuras separadas: `messages` (transcripción visible, completa) y `context` (lo que se envía al API). | I |
| RF-F21 | Cada petición enviará `history` derivado de `context`, recortado por el cliente a 20 mensajes / 2000 caracteres por mensaje / 8000 en total (constantes alineadas con el `.env` del API), con solo roles `user` y `assistant`. | I |
| RF-F22 | Cuando llegue `sources` con `history`, `context` se sustituirá por ese historial (el servidor es la fuente de verdad del contexto). | I |
| RF-F23 | Cuando llegue `done` tras al menos un `token`, se añadirá a `context` el par `{user: pregunta, assistant: texto completo}`. Los turnos con error, abortados o sin contexto no entran en `context`. | I |
| RF-F24 | `messages` y `context` se guardarán en `sessionStorage` bajo una clave versionada (`chatbox:v1`). La lectura validará la forma y descartará datos inválidos; si el almacenamiento falla o está bloqueado, el chat seguirá funcionando en memoria. | I |
| RF-F25 | Habrá un botón "Nueva conversación" siempre accesible, con confirmación en línea cuando haya mensajes, que borrará el estado y el almacenamiento. | I |
| RF-F26 | Si el `history` devuelto tiene menos mensajes que el enviado, se mostrará una nota discreta: "Los mensajes más antiguos ya no forman parte del contexto". | R |

### D. Renderizado

| ID | Requisito | P |
|---|---|---|
| RF-F30 | Las respuestas del asistente se renderizarán con `react-markdown` limitado por `allowedElements` (`p`, `strong`, `em`, `code`, `a`, `ul`, `ol`, `li`) y **sin HTML crudo** (sin `rehype-raw`). `urlTransform` solo admitirá `http(s):` y `mailto:`. El módulo se cargará con `import()` dinámico, al llegar la primera respuesta. | I |
| RF-F31 | Los enlaces se abrirán en pestaña nueva (`target="_blank" rel="noopener noreferrer"`), con color contrastante y subrayado. | I |

### E. Accesibilidad

| ID | Requisito | P |
|---|---|---|
| RF-F40 | Todo el componente será operable solo con teclado (Tab/Shift+Tab), con foco visible. Tras enviar, el foco permanecerá en el campo de texto. | I |
| RF-F41 | Habrá una región oculta visualmente con `role="status"` / `aria-live="polite"` que anunciará "El asistente está escribiendo" al empezar y el texto completo **una sola vez al recibir `done`**. La lista de mensajes no será una región viva, para que el lector no lea cada token. | I |
| RF-F42 | Contraste mínimo 4.5:1 en texto y 3:1 en componentes y foco, en tema claro y oscuro. | I |
| RF-F43 | Todos los controles táctiles medirán al menos 44×44 px (enviar, detener, nueva conversación, sugerencias). | I |
| RF-F44 | Con `prefers-reduced-motion`, el indicador "escribiendo" no se animará y el scroll no será suave. | I |
| RF-F45 | El campo de texto tendrá etiqueta asociada, los botones solo-icono tendrán `aria-label`, y el componente declarará `lang="es"`. | I |

### F. Responsive y móvil

| ID | Requisito | P |
|---|---|---|
| RF-F50 | El diseño será fluido, dimensionará la altura con `dvh` y respetará `env(safe-area-inset-*)`. El campo de texto usará `font-size` ≥ 16 px para evitar el zoom automático de iOS Safari. | I |
| RF-F51 | En móvil, el campo de texto y el último mensaje no quedarán tapados por el teclado virtual (ajuste con `visualViewport` si el chat va a pantalla completa o flotante). | I |

### G. Confianza y personalización

| ID | Requisito | P |
|---|---|---|
| RF-F60 | Habrá siempre visible un enlace de contacto con Jorge (prop `contactUrl`); es el equivalente a "hablar con una persona" y encaja con el texto de la propia API. | R |
| RF-F61 | El tema heredará del sitio mediante variables CSS `--chatbox-*` y `prefers-color-scheme` por defecto. | R |
| RF-F62 | Los textos de la interfaz estarán centralizados en un único módulo (`strings.es.ts`). | R |

---

## 5. Estados del turno

```
idle ──enviar──▶ connecting ──sources──▶ generating ──token──▶ streaming ──done──▶ idle
                    │                        │                      │
                    └────────── error / timeout / abort ────────────┴──▶ error | aborted
```

- El indicador "escribiendo" es visible en `connecting` y `generating`.
- `error` y `aborted` conservan el texto parcial ya recibido, marcado como incompleto, y el turno no entra en `context`.
- "Reintentar" reenvía la misma pregunta con el mismo `context`, sin duplicar la burbuja del usuario.

---

## 6. Escenarios (Gherkin)

```gherkin
Característica: Conversación con streaming

  Escenario: Respuesta con contexto
    Dado un chat vacío
    Cuando el usuario envía "¿Qué stack usa Jorge?"
    Entonces aparece su burbuja y un indicador "escribiendo"
    Y al llegar los tokens la respuesta crece progresivamente
    Y al llegar "done" el botón vuelve a ser "Enviar"
    Y el contexto incluye el par pregunta/respuesta

  Escenario: Sin contexto suficiente
    Cuando la API emite "sources" vacío y "done" sin tokens
    Entonces la burbuja muestra el mensaje local de "no lo tengo"
    Y el turno no se añade al contexto

  Escenario: Detener generación
    Dado una respuesta en streaming
    Cuando el usuario pulsa "Detener" o Esc
    Entonces se aborta la petición
    Y la burbuja conserva el texto parcial marcado como interrumpido
    Y el turno no se añade al contexto

  Escenario: Error a mitad de stream
    Dado una respuesta en streaming
    Cuando llega un evento "error"
    Entonces la burbuja muestra un error en español con botón "Reintentar"
    Y no se muestra el mensaje del servidor

  Escenario: Límite de peticiones
    Cuando la API responde 429
    Entonces se muestra "Has alcanzado el límite de preguntas. Inténtalo más tarde."
    Y no hay reintento automático

  Escenario: Contexto recortado por el servidor
    Dado un contexto de 12 mensajes enviado en la petición
    Cuando "sources" devuelve 10 mensajes
    Entonces el contexto del cliente pasa a ser esos 10
    Y se muestra la nota de contexto recortado

  Escenario: Recarga de la página
    Dado una conversación guardada en sessionStorage
    Cuando el usuario recarga la pestaña
    Entonces se restauran los mensajes y el contexto
```

---

## 7. Errores y mensajes

| Situación | Detección | Mensaje de UI | Acción |
|---|---|---|---|
| Sin red / CORS / fetch falla | `fetch` lanza `TypeError` | "No se pudo conectar. Comprueba tu conexión." | Reintentar |
| Timeout sin frames | 30 s | Igual que sin red | Reintentar |
| Pregunta inválida | 400 `INVALID_QUESTION` / `VALIDATION_ERROR` | "No se pudo enviar esa pregunta." | Editar |
| Cuerpo demasiado grande | 413 | "La conversación es demasiado larga. Empieza una nueva." | Nueva conversación |
| Límite de peticiones | 429 | "Has alcanzado el límite de preguntas. Inténtalo más tarde." | Sin reintento automático |
| Error del servidor | 5xx, respuesta no JSON | "Algo ha fallado. Inténtalo de nuevo." | Reintentar |
| Evento `error` (antes o durante el stream) | Frame `error` | "No he podido completar la respuesta." | Reintentar |
| Stream cortado sin `done` | Lectura termina sin `done` | "La respuesta se interrumpió." | Reintentar |

---

## 8. Integración con Astro

Estructura propuesta:

```
src/components/chatbox/
  Chatbox.tsx          # UI
  useChatStream.ts     # fetch + SSE + abort + estados
  sse.ts               # parser puro de frames (testeable sin DOM)
  conversation.ts      # recorte, merge de contexto, storage
  strings.es.ts
  types.ts
  chatbox.css
```

Uso:

```astro
<Chatbox client:visible apiUrl={import.meta.env.PUBLIC_CHAT_API_URL}
         suggestions={[...]} contactUrl="mailto:..." />
```

- `client:visible` si va embebido en una sección; `client:idle` si es un botón flotante.
- Props: `apiUrl` (obligatoria), `suggestions`, `contactUrl`, `title`.
- Estilos propios con una clase raíz y variables `--chatbox-*`; sin dependencia de estilos globales.
- Dependencias: `preact`, `@astrojs/preact` (con `compat: true`) y `react-markdown`. Sin Redux, Zustand, `react-textarea-autosize` ni `use-stick-to-bottom`: el scroll y el autogrow son pocas líneas.
- Variable de entorno: `PUBLIC_CHAT_API_URL`. El `CORS_ORIGIN` del API debe coincidir con el origen del sitio.

---

## 9. Pruebas

- **Unitarias (Vitest):** parser SSE con frames partidos entre chunks, varios frames en un chunk y payload con `history`; recorte de contexto; lectura tolerante de storage.
- **Hook con `fetch` simulado:** secuencia normal, sin contexto, error mid-stream, abort, timeout.
- **Componente (`@testing-library/preact`):** Enter/Shift+Enter, botón Enviar↔Detener, estado vacío, reintento.
- **Accesibilidad:** pasada automática con axe y prueba manual con NVDA y VoiceOver, sobre todo RF-F41.
- **Manual en móvil real:** teclado virtual, safe areas, zoom de iOS.

---

## 10. Cambios sugeridos en la API (no bloqueantes)

1. Corregir el README: el evento `sources` incluye `history`.
2. Alinear `CORS_ORIGIN` de desarrollo con el puerto de Astro (4321) o documentarlo.
3. Opcional: `exposedHeaders: ['Retry-After']` en CORS para poder indicar cuánto esperar tras un 429.

---

## 11. Fuera de alcance

| Requisito genérico | Motivo |
|---|---|
| Tablas, resaltado de código, imágenes, adjuntos | El bot responde en 3 frases, sin listas, y la API no maneja imágenes ni archivos. |
| Dividir respuestas en mensajes de ≤60 palabras | El system prompt ya limita a 3 frases. |
| Feedback 👍/👎 | No hay endpoint donde registrarlo. |
| Regenerar y copiar respuesta | Útiles pero no necesarios en el MVP; candidatos a fase 2. |
| Editar mensaje propio | No crítico; se puede reescribir. |
| Lista de conversaciones previas | Es un único hilo anónimo sin cuentas (fuera de alcance de la API). |
| Selector de tamaño de fuente / idioma | Zoom del navegador; la API responde en español. |
| Gestos táctiles | Extra. |
| Mostrar `sources` | Son fragmentos crudos sin título ni URL; poco valor para el usuario. |

---

## 12. Decisiones abiertas

1. ~~**Framework**~~ Resuelto: Preact.
2. **Formato:** embebido en una sección o botón flotante. Afecta a `client:visible` vs `client:idle` y a RF-F51.
3. **Persistencia:** `sessionStorage` (propuesta) vs `localStorage` vs solo memoria. `sessionStorage` deja menos huella pero se pierde al cerrar la pestaña.
4. **Markdown:** `react-markdown` decidido. Pendiente medir qué formato emite el modelo con 15–20 preguntas de prueba (y, opcionalmente, añadir al prompt si se quiere limitar el formato) y medir el peso real descargado en el build.
5. **Timeout de 30 s y límites del cliente:** valores iniciales; ajustar tras medir la latencia real.
