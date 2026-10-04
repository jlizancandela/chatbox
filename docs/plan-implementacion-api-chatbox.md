# Plan KISS del MVP de la API del chatbox

El MVP será un RAG vectorial real y pequeño: ingerirá documentos, almacenará sus embeddings en PostgreSQL con `pgvector`, recuperará contexto por similitud y pedirá a Groq una respuesta fundamentada.

## Arquitectura y flujo

```text
Markdown/texto -> CLI -> chunking simple -> Gemini Embeddings -> PostgreSQL/pgvector

POST /api/chat -> rate limiting en memoria (ráfaga + diario) -> validar pregunta -> Gemini Embeddings -> búsqueda top-k
               -> sin contexto: sources + done mediante SSE
               -> con contexto: Groq en streaming -> sources + tokens + done mediante SSE
```

Todo se implementa en un único backend Fastify con TypeScript. Las claves de Gemini y Groq permanecen en el backend. El rate limiting por IP (ráfaga + tope diario) se incorpora en el Paso 4 usando un store en memoria, sin Redis: no bloquea la implementación del RAG de los pasos 1–3 y queda integrado antes de publicar el endpoint.

## Decisiones

| Área | Decisión del MVP |
|---|---|
| API | Fastify + TypeScript estricto |
| Datos | PostgreSQL + extensión `pgvector` |
| Ingesta | CLI local para archivos Markdown y texto plano |
| Chunking | División simple por longitud, conservando un solapamiento pequeño |
| Embeddings | API de Google Gemini, modelo `gemini-embedding-001`, vectores de 768 dimensiones |
| Consistencia vectorial | Documentos y preguntas usan la misma API, modelo y dimensión |
| Recuperación | Similitud vectorial top-k, con `k` configurable |
| Generación | Groq recibe únicamente la pregunta y los fragmentos recuperados |
| Contrato | `POST /api/chat` recibe JSON y devuelve SSE para peticiones válidas; errores de validación previos al stream son JSON 400 |
| Protección | Validación, rate limiting por IP en memoria (20/minuto y 100/24 h), CORS restringido, body limit de 16 KiB, secretos en backend y logs mínimos sin contenido sensible |

> **Advertencia:** el nivel gratuito de Gemini puede usar datos para mejorar productos y sus límites pueden cambiar. Usar únicamente documentos públicos o no sensibles, y mantener proveedor, modelo y dimensión configurables.

## Paso 1 - Base ejecutable y almacenamiento vectorial

- [x] Crear el proyecto Fastify con TypeScript estricto y configuración validada al arrancar.
- [x] Configurar PostgreSQL, habilitar `pgvector` y aplicar una migración reproducible.
- [x] Crear una tabla mínima de fragmentos con fuente, texto y `vector(768)`.
- [x] Mantener las credenciales de PostgreSQL, Gemini y Groq solo en variables del backend.

**Cierre:** la API arranca, detecta configuración inválida y puede insertar y leer un vector de 768 dimensiones.

## Paso 2 - Ingesta por CLI

- [x] Crear un comando CLI que reciba uno o más archivos Markdown o texto plano.
- [x] Dividir el contenido con chunking simple y descartar fragmentos vacíos.
- [x] Generar cada embedding con `gemini-embedding-001` a 768 dimensiones.
- [x] Guardar fuente, texto y vector en PostgreSQL e informar cantidades y errores.

**Cierre:** un documento público de ejemplo queda convertido en fragmentos consultables desde `pgvector`.

## Paso 3 - Recuperación y chat fundamentado

- [x] Implementar `POST /api/chat` con un cuerpo JSON mínimo, por ejemplo `{ "question": "..." }`.
- [x] Validar tipo, presencia y longitud máxima de la pregunta.
- [x] Generar el embedding de la pregunta con el mismo modelo y dimensión de la ingesta.
- [x] Ejecutar una búsqueda vectorial top-k y enviar a Groq solo los fragmentos recuperados.
- [x] Emitir `sources`, tokens de Groq y `done` mediante SSE; sin contexto, emitir `sources` vacío y `done` sin invocar a Groq.

**Cierre:** una pregunta cubierta responde con evidencia y fuentes mediante SSE; una pregunta no cubierta emite `sources` vacío y `done` sin invocar a Groq.

## Paso 4 - Protecciones mínimas y entrega ✅

- [x] Añadir rate limiting en memoria por IP (20/minuto y 100/24 h) con expiración y respuesta `429` clara.
- [x] Configurar CORS para el origen permitido y límite de 16 KiB para `POST /api/chat`.
- [x] Mantener logs mínimos sin secretos ni contenido sensible.
- [x] Documentar variables de entorno, migración, ingesta, arranque y una llamada de ejemplo a `POST /api/chat`.
- [x] Verificar que el límite se aplica y se restablece al expirar el contador.

**Cierre:** el flujo completo puede instalarse, ingerir un documento y responder consultas SSE desde un entorno limpio, con rate limiting activo y errores comprensibles.

## Paso 5 - Streaming de respuestas (SSE) ✅

- [x] Extraer `retrieve(question)` para reutilizar embedding y búsqueda vectorial.
- [x] Implementar `askStream(question, signal)` como `AsyncIterable<ChatEvent>`.
- [x] Emitir `sources`, `token`, `done` y `error` con contrato documentado.
- [x] Cancelar Groq cuando el cliente HTTP se desconecta.
- [x] Cubrir el flujo con tests unitarios, de ruta y de desconexión HTTP real.

## Paso 6 - Historial de conversación enviado por el cliente

El cliente envía el historial de la conversación en cada petición `POST /api/chat`
dentro del campo `history`. El servidor no persiste nada: no hay sesión, ni TTL,
ni tabla en la base de datos.

Esta decisión simplifica la infraestructura (sin limpieza, sin clave HMAC, sin TTL)
y elimina las limitaciones de usar la IP como identificador. El almacenamiento
corre por cuenta del cliente.

**Implementado:**
- Esquema de `POST /api/chat` acepta `history?: { role: "user"|"assistant", content: string }[]`.
- `chatService` ya no carga ni guarda historial en BD.
- Archivos eliminados: `history.contract.ts`, `history.load.ts`, `history.session.ts`,
  `conversations.ts`, `cleanup.ts`, migración 004.
- Migración de rollback `005_drop_conversation_history.sql` disponible.
- Tests y documentación actualizados.

## Criterios de éxito

- El sistema usa embeddings reales almacenados y consultados mediante `pgvector`.
- Documentos y preguntas comparten `gemini-embedding-001` y 768 dimensiones.
- Las respuestas con contexto se generan con Groq y emiten fuentes y tokens mediante SSE.
- Las preguntas sin contexto no producen respuestas inventadas.
- El endpoint valida entradas, limita abuso por IP en memoria y no expone secretos.
- Los cinco pasos implementados tienen un resultado verificable; el Paso 6 queda planificado.

## Fuera de alcance actual

- Embeddings locales.
- Escalado horizontal e infraestructura distribuida avanzada.
- Autenticación de usuarios, cuentas y sesiones permanentes.
- Versionado documental sofisticado o reemplazo atómico.
- Filtros avanzados de recuperación.
- Presupuestos globales de consumo.
- Observabilidad avanzada, métricas o trazas distribuidas.
- Panel de administración.

La memoria temporal del Paso 6 no está implementada todavía; cuando se
implemente seguirá sin representar cuentas ni conversaciones permanentes. El
MVP no requiere cookies ni tokens de sesión anónimos.
