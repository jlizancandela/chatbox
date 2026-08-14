# Plan KISS del MVP de la API del chatbox

El MVP será un RAG vectorial real y pequeño: ingerirá documentos, almacenará sus embeddings en PostgreSQL con `pgvector`, recuperará contexto por similitud y pedirá a Groq una respuesta fundamentada.

## Arquitectura y flujo

```text
Markdown/texto -> CLI -> chunking simple -> Gemini Embeddings -> PostgreSQL/pgvector

POST /api/chat -> rate limiting con Redis -> validar pregunta -> Gemini Embeddings -> búsqueda top-k
               -> sin contexto: respuesta de desconocimiento
               -> con contexto: Groq -> respuesta JSON fundamentada
```

Todo se implementa en un único backend Fastify con TypeScript. Las claves de Gemini y Groq permanecen en el backend. Redis se incorpora en el Paso 4: no bloquea la implementación del RAG de los pasos 1–3 y queda integrado antes de publicar el endpoint.

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
| Contrato | `POST /api/chat` recibe y devuelve JSON normal |
| Protección | Validación, rate limiting por IP respaldado por Redis, secretos en backend y logs mínimos sin contenido sensible |

> **Advertencia:** el nivel gratuito de Gemini puede usar datos para mejorar productos y sus límites pueden cambiar. Usar únicamente documentos públicos o no sensibles, y mantener proveedor, modelo y dimensión configurables.

## Paso 1 - Base ejecutable y almacenamiento vectorial

- [ ] Crear el proyecto Fastify con TypeScript estricto y configuración validada al arrancar.
- [ ] Configurar PostgreSQL, habilitar `pgvector` y aplicar una migración reproducible.
- [ ] Crear una tabla mínima de fragmentos con fuente, texto y `vector(768)`.
- [ ] Mantener las credenciales de PostgreSQL, Gemini y Groq solo en variables del backend.

**Cierre:** la API arranca, detecta configuración inválida y puede insertar y leer un vector de 768 dimensiones.

## Paso 2 - Ingesta por CLI

- [ ] Crear un comando CLI que reciba uno o más archivos Markdown o texto plano.
- [ ] Dividir el contenido con chunking simple y descartar fragmentos vacíos.
- [ ] Generar cada embedding con `gemini-embedding-001` a 768 dimensiones.
- [ ] Guardar fuente, texto y vector en PostgreSQL e informar cantidades y errores.

**Cierre:** un documento público de ejemplo queda convertido en fragmentos consultables desde `pgvector`.

## Paso 3 - Recuperación y chat fundamentado

- [ ] Implementar `POST /api/chat` con un cuerpo JSON mínimo, por ejemplo `{ "question": "..." }`.
- [ ] Validar tipo, presencia y longitud máxima de la pregunta.
- [ ] Generar el embedding de la pregunta con el mismo modelo y dimensión de la ingesta.
- [ ] Ejecutar una búsqueda vectorial top-k y enviar a Groq solo los fragmentos recuperados.
- [ ] Devolver JSON con respuesta y fuentes; si no hay contexto suficiente, responder que no se dispone de información sin invocar a Groq ni inventar.

**Cierre:** una pregunta cubierta responde con evidencia y fuentes; una pregunta no cubierta reconoce la falta de contexto.

## Paso 4 - Protecciones mínimas y entrega

- [ ] Configurar Redis y añadir rate limiting configurable por IP con expiración de contadores y respuesta `429` clara.
- [ ] Configurar CORS para el origen permitido y límites de tamaño de petición.
- [ ] Registrar solo método, ruta, estado, duración y categoría de error, sin secretos ni contenido completo.
- [ ] Documentar variables de entorno, migración, ingesta, arranque y una llamada de ejemplo a `POST /api/chat`.
- [ ] Verificar que el límite se aplica y se restablece al expirar el contador.

**Cierre:** el flujo completo puede instalarse, ingerir un documento y responder consultas desde un entorno limpio, con rate limiting activo y errores JSON comprensibles.

## Criterios de éxito

- El sistema usa embeddings reales almacenados y consultados mediante `pgvector`.
- Documentos y preguntas comparten `gemini-embedding-001` y 768 dimensiones.
- Las respuestas con contexto se generan con Groq y señalan sus fuentes.
- Las preguntas sin contexto no producen respuestas inventadas.
- El endpoint valida entradas, limita abuso por IP mediante Redis y no expone secretos.
- Los cuatro pasos tienen un resultado verificable y pueden cerrarse en orden.

## Fuera de alcance

- Embeddings locales.
- Escalado horizontal e infraestructura distribuida avanzada.
- Cookies, identidad anónima o identidad firmada.
- Conversaciones persistentes o memoria de chat.
- Versionado documental sofisticado o reemplazo atómico.
- Filtros avanzados de recuperación.
- Presupuestos globales de consumo.
- Streaming o Server-Sent Events (SSE).
- Observabilidad avanzada, métricas o trazas distribuidas.
- LangChain.
- Panel de administración.
