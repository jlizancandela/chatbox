# TODO — MVP RAG vectorial

Este archivo refleja el estado real de `docs/plan-implementacion-api-chatbox.md`.

## Paso 1 — Base ejecutable y almacenamiento vectorial ✅

- [x] Crear la API con Fastify y TypeScript.
- [x] Conectar PostgreSQL y habilitar `pgvector`.
- [x] Validar `DATABASE_URL` al arrancar.
- [x] Mantener un formato JSON estable para errores públicos.
- [x] Cambiar la columna de embeddings de `vector(384)` a `vector(768)`.
- [x] Convertir el esquema en una migración reproducible para bases existentes.
- [x] Configurar y validar las credenciales y modelos de Gemini y Groq.
- [x] Configurar la dimensión de embeddings y el valor top-k.
- [x] Verificar la inserción y lectura de un vector de 768 dimensiones. <- Test de integración 

## Paso 2 — Ingesta por CLI ✅

- [x] Crear un comando CLI para archivos Markdown y texto plano.
- [x] Implementar chunking simple con un solapamiento pequeño.
- [x] Generar embeddings con `gemini-embedding-001` a 768 dimensiones.
- [x] Guardar fuente, texto y vector en PostgreSQL.
- [x] Informar cantidades procesadas y errores.
- [x] Verificar que un documento queda disponible para búsqueda vectorial.

## Paso 3 — Recuperación y chat fundamentado (contrato inicial) ✅

- [x] Crear `POST /api/chat` con validación JSON básica.
- [x] Añadir una longitud máxima para la pregunta.
- [x] Generar el embedding de la pregunta con Gemini.
- [x] Implementar la búsqueda vectorial top-k.
- [x] Definir cuándo el contexto recuperado es insuficiente.
- [x] Integrar Groq usando únicamente la pregunta y el contexto recuperado.
- [x] Devolver la respuesta y sus fuentes mediante el contrato de chat.
- [x] Evitar la llamada a Groq cuando no exista contexto suficiente.
- [x] Sustituir la respuesta temporal `501 CHAT_NOT_IMPLEMENTED`.
- [x] Calibrar `SIMILARITY_THRESHOLD`: cambiar de L2 (`<->`) a coseno (`<=>`), índice HNSW, umbral `0.5`.

## Paso 4 — Protecciones mínimas y entrega ✅

- [x] Añadir rate limiting por IP en memoria (sin Redis) — ráfaga + tope diario con `@fastify/rate-limit`.
- [x] Límite de ráfaga configurable (20 peticiones/minuto, constantes en `src/middleware/rate-limit.ts`).
- [x] Límite diario configurable (100 peticiones / 24 h móviles, constantes en `src/middleware/rate-limit.ts`).
- [x] Configurar la expiración de los contadores (ventana fija con reset automático del plugin).
- [x] Devolver una respuesta `429` clara al superar el límite (formato JSON de errores + `Retry-After`).
- [x] Configurar CORS para el origen permitido.
- [x] Configurar límites de tamaño de petición (16 KiB para `POST /api/chat`, con respuesta `413`).
- [x] Mantener logs mínimos sin secretos ni contenido sensible (arranque y desarrollo con nivel `warn`; sin logging de cuerpos).
- [x] Documentar variables de entorno, migración, ingesta y arranque en `api/README.md` y `api/.env.example`.
- [x] Documentar una llamada válida a `POST /api/chat` en `api/README.md`.
- [x] Verificar que el límite se aplica y se restablece al expirar el contador (test automatizado).
- [x] Verificar el flujo completo desde un entorno limpio (instalación, migraciones, ingesta, API, chat y tests).

## Paso 5 — Streaming de respuestas (SSE) ✅

- [x] Refactorizar `chatService`: extraer `retrieve(question)` (embedding + búsqueda vectorial) reutilizable.
- [x] Reemplazar `ask(question)` por `askStream(question, signal)` que devuelva `AsyncIterable<ChatEvent>`.
- [x] Definir el contrato de eventos: `sources`, `token`, `done`, `error`.
- [x] Convertir `POST /api/chat` para responder siempre `Content-Type: text/event-stream`.
- [x] Emitir `sources` antes de llamar a Groq (incluido el caso de contexto insuficiente, sin llamar al LLM).
- [x] Propagar `stream: true` de Groq como eventos `token`.
- [x] Cancelar el stream de Groq al desconectarse el cliente (`AbortController`).
- [x] Mantener los errores previos al stream (validación) como JSON `400`.
- [x] Manejar errores mid-stream con un frame `error` sin filtrar detalles internos.
- [x] Reescribir los tests de `/api/chat` para parsear frames SSE y validar la secuencia.
- [x] Documentar el contrato de eventos para el front (`fetch` + `ReadableStream`).
- [x] Añadir un test de integración que simule una desconexión HTTP real y verifique el aborto del stream de Groq.

## Paso 6 — Historial de conversación enviado por el cliente

- [x] ~~Definir el contrato del historial en el servidor (sesiones, TTL, cascade delete)~~.
- [x] ~~Migración PostgreSQL para sesiones y mensajes temporales~~.
- [x] El cliente envía `history` en cada petición; el servidor no persiste nada.
- [x] Actualizar esquema de `POST /api/chat` para aceptar `history?: ChatMessage[]`.
- [x] Simplificar `chatService`: eliminar `loadHistory` y `saveTurn`.
- [x] Eliminar archivos de persistencia: `history.*`, `conversations.ts`, `cleanup.ts`.
- [x] Migración de rollback `005_drop_conversation_history.sql`.
- [x] Actualizar tests y documentación.
