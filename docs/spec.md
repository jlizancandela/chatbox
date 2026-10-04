# Especificación — MVP Chatbox (RAG vectorial)

## Propósito

El sistema debe responder preguntas en lenguaje natural a partir de documentos
propios, fundamentando cada respuesta en el contenido recuperado y reconociendo
cuando no dispone de información suficiente. Para ello ingiere documentos, los
almacena como vectores y, ante una pregunta, recupera los fragmentos más
similares y genera una respuesta con sus fuentes.

## Requisitos funcionales (EARS)

### Configuración y arranque

**RF-01 — Configuración validada al arrancar**
Cuando el sistema arranca, deberá validar la configuración requerida y detenerse
si detecta valores inválidos o ausentes.
Por qué: evitar que la API quede en un estado inconsistente o exponga fallos
tardíos por credenciales o dimensiones incorrectas.

### Almacenamiento vectorial

**RF-02 — Esquema reproducible con pgvector**
Cuando se aplique la migración, el sistema deberá crear el esquema de datos de
fragmentos con una columna de embedding `vector(768)` de forma reproducible.
Por qué: poder reconstruir la base en un entorno limpio y mantener un único
origen de verdad del esquema.

### Ingesta de documentos

**RF-03 — Ingesta de múltiples archivos por CLI**
Cuando se invoque el comando de ingesta con uno o más archivos Markdown o texto
plano, el sistema deberá procesar cada archivo.
Por qué: permitir cargar corpus completos sin intervención manual por archivo.

**RF-04 — Chunking con solapamiento**
Cuando se procese un documento, el sistema deberá dividirlo en fragmentos por
longitud con un solapamiento pequeño y descartar los fragmentos vacíos.
Por qué: mantener unidades de recuperación manejables y conservar contexto en
los límites de cada fragmento.

**RF-05 — Generación de embeddings**
Cuando se divida un documento, el sistema deberá generar un embedding de 768
dimensiones para cada fragmento con el modelo de embeddings configurado.
Por qué: habilitar la búsqueda por similitud sobre unidades semánticas pequeñas.

**RF-06 — Persistencia de fragmentos**
Cuando se generen los embeddings, el sistema deberá guardar la fuente, el texto
y el vector de cada fragmento en PostgreSQL.
Por qué: dejar el documento consultable mediante búsqueda vectorial.

**RF-07 — Informe de ingesta**
Cuando finalice la ingesta, el sistema deberá informar las cantidades procesadas
y los errores encontrados.
Por qué: permitir verificar el resultado de la carga sin inspeccionar la base.

**RF-08 — Consistencia vectorial**
Mientras los documentos y las preguntas se codifiquen, el sistema deberá usar la
misma API, modelo y dimensión de embedding para ambos.
Por qué: garantizar que la similitud entre pregunta y fragmentos sea comparable.

### Recuperación y chat

**RF-09 — Contrato de `POST /api/chat`**
Cuando se reciba una petición a `POST /api/chat`, el sistema deberá aceptar un
cuerpo JSON con una pregunta. Las validaciones previas al procesamiento deberán
responder con JSON; las peticiones válidas deberán responder como un stream
Server-Sent Events (`text/event-stream`).
Por qué: exponer una interfaz predecible y permitir mostrar la respuesta
progresivamente.

**RF-10 — Validación de la pregunta**
Cuando se reciba una pregunta, el sistema deberá validar su tipo, presencia y
longitud máxima y rechazarla si no es válida.
Por qué: evitar procesar entradas vacías, malformadas o excesivamente largas.

**RF-11 — Embedding de la pregunta**
Cuando la pregunta sea válida, el sistema deberá generar su embedding con el
mismo modelo y dimensión usados en la ingesta.
Por qué: poder compararla con los fragmentos almacenados.

**RF-12 — Búsqueda top-k**
Cuando se disponga del embedding de la pregunta, el sistema deberá recuperar los
`k` fragmentos más similares. En el MVP, `k` es `5` y el umbral de similitud coseno es `0.5`.
Por qué: seleccionar únicamente el contexto relevante para la respuesta.

**RF-13 — Respuesta con contexto**
Cuando exista contexto suficiente, el sistema deberá enviar a Groq únicamente la
pregunta y los fragmentos recuperados y emitir primero las fuentes, después los
fragmentos de respuesta generados y finalmente el evento de finalización.
Por qué: generar una respuesta fundamentada en los documentos, no en
conocimiento no recuperado.

**RF-14 — Respuesta sin contexto**
Si no hay contexto suficiente, el sistema deberá responder que no dispone de
información mediante los eventos `sources` y `done`, sin invocar a Groq ni
inventar contenido.
Por qué: evitar respuestas inventadas o fuera de los documentos ingeridos.

**RF-14a — Eventos del stream**
Cuando una petición válida se procese, el sistema deberá emitir los eventos
`sources`, `token`, `done` y `error` con el contrato documentado para el front.
Los errores que ocurran después de iniciar el stream deberán emitirse como
`error` sin filtrar detalles internos.

### Protecciones

**RF-15 — Rate limiting por IP**
Cuando se supere el límite de peticiones configurado por IP, el sistema deberá
responder con `429` y permitir que el contador se restablezca al expirar.
Por qué: limitar el abuso y proteger el consumo de los proveedores externos.

**RF-16 — CORS restringido**
Cuando se reciba una petición desde el navegador, el sistema deberá permitir
únicamente el origen configurado.
Por qué: restringir el acceso a los orígenes autorizados.

**RF-17 — Límite de tamaño de petición**
Cuando una petición supere el tamaño máximo configurado, el sistema deberá
rechazarla.
Por qué: evitar cargas excesivas o malintencionadas.

**RF-18 — Logs mínimos sin secretos**
Mientras se registre actividad, el sistema deberá mantener un nivel mínimo
(`warn` en los comandos de arranque) y no registrar cuerpos, preguntas,
contexto, respuestas ni secretos.
Por qué: permitir depurar sin exponer datos sensibles ni información del usuario.

### Entrega

**RF-19 — Documentación de operación**
Donde se entregue el sistema, deberá documentarse las variables de entorno, la
migración, la ingesta, el arranque y una llamada de ejemplo a `POST /api/chat`.
Por qué: permitir instalar y operar el MVP desde un entorno limpio.

### Historial de conversación

**RF-20 — Historial enviado por el cliente**
Cuando se reciba una petición a `POST /api/chat`, el sistema podrá aceptar un
campo opcional `history` con una lista de mensajes de roles `user` o `assistant`.
El servidor no persiste el historial; lo recibe del cliente y lo incluye en el
contexto enviado a Groq sin transformarlo.
Por qué: simplificar la infraestructura, eliminar la necesidad de identificar
sesiones por IP y evitar limitaciones de NAT, VPNs o IPs compartidas.

## Fuera de alcance actual

- Embeddings locales.
- Escalado horizontal e infraestructura distribuida avanzada.
- Autenticación de usuarios, cuentas y sesiones permanentes.
- Versionado documental sofisticado o reemplazo atómico.
- Filtros avanzados de recuperación.
- Presupuestos globales de consumo.
- Observabilidad avanzada, métricas o trazas distribuidas.
- LangChain.
- Panel de administración.

La memoria temporal del Paso 6 queda fuera de la implementación actual hasta
que se complete su checklist en `api/TODO.md`. Cuando se implemente, seguirá
sin ser una cuenta de usuario ni una conversación permanente.

## Criterios de finalización

El MVP se considera completo cuando se verifican todos estos puntos:

- Los embeddings reales se almacenan y consultan mediante `pgvector`.
- Documentos y preguntas comparten `gemini-embedding-001` y 768 dimensiones.
- Las respuestas con contexto se generan con Groq, emiten sus fuentes y tokens
  mediante SSE, y terminan con `done`.
- Las preguntas sin contexto no producen respuestas inventadas.
- El endpoint valida las entradas, limita el abuso por IP en memoria (ráfaga +
  diario) y no expone secretos.
- La migración, la ingesta, el arranque y el contrato SSE de `POST /api/chat`
  quedan documentados.
- El flujo completo funciona desde un entorno limpio: instalar, ingerir un
  documento y responder consultas con rate limiting activo y errores JSON.
