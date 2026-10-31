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
`k` fragmentos más similares. `k` es configurable con `RETRIEVAL_TOP_K` (por defecto `5`)
y el umbral de similitud coseno con `SIMILARITY_THRESHOLD` (por defecto `0.8`, calibrado
sobre el espacio de embeddings vigente).
Por qué: seleccionar únicamente el contexto relevante para la respuesta y poder ajustar
ambos parámetros sin tocar el código.

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
Mientras se registre actividad, el sistema deberá mantener el nivel configurado con
`LOG_LEVEL` (por defecto `info`) y no registrar cuerpos, preguntas, contexto, respuestas
ni secretos.
Por qué: permitir depurar sin exponer datos sensibles ni información del usuario.

**RF-27 — Presupuesto por sesión**
Cuando una petición incluya el identificador de sesión en `x-session-id`, el sistema
deberá contabilizar los tokens reales consumidos en cada turno y cortar la conversación
con el código `SESSION_BUDGET_EXCEEDED` al agotar `SESSION_BUDGET_MAX_TOKENS` o
`SESSION_BUDGET_MAX_TURNS`. Sin identificador no hay consumo que contabilizar. El
presupuesto es equidad entre visitantes, no seguridad: el identificador lo controla el
cliente y empezar una conversación nueva lo reinicia.
Por qué: una sola conversación no debe consumir la cuota compartida del proveedor.

### Entrega

**RF-19 — Documentación de operación**
Donde se entregue el sistema, deberá documentarse las variables de entorno, la
migración, la ingesta, el arranque y una llamada de ejemplo a `POST /api/chat`.
Por qué: permitir instalar y operar el MVP desde un entorno limpio.

### Historial de conversación

**RF-20 — Historial enviado por el cliente**
Cuando se reciba una petición a `POST /api/chat`, el sistema podrá aceptar un
campo opcional `history` con una lista de mensajes de roles `user` o `assistant`.
El servidor no persiste el historial; lo recibe del cliente, lo recorta según
los límites configurados y lo incluye en el contexto enviado a Groq.
Por qué: simplificar la infraestructura, eliminar la necesidad de identificar
sesiones por IP y evitar limitaciones de NAT, VPNs o IPs compartidas.

**RF-20a — Recorte y sync del historial**
Cuando se reciba el campo `history`, el sistema deberá recortarlo antes de
usarlo: mantener los mensajes más recientes hasta `HISTORY_MAX_MESSAGES`, truncar
la suma de caracteres a `HISTORY_MAX_TOTAL_CHARS` y truncar cada mensaje
individual a `HISTORY_MAX_MESSAGE_CHARS`. Si el mensaje más antiguo recortado es
un `assistant` sin par de usuario, se descartará. El historial recortado se
devolverá al cliente en el evento `sources` para que pueda sincronizar su estado.
El servidor validará que cada mensaje del cliente no supere `HISTORY_MAX_MESSAGE_CHARS`
y lo rechazará con `400` si lo excede.
Por qué: controlar el coste de tokens, prevenir payloads excesivos y mantener
cliente y servidor sincronizados sobre cuál es el historial canónico.

**RF-20b — System prompt endurecido**
Cuando se genere una respuesta, el sistema utilizará un prompt de sistema con
reglas explícitas contra inyección de instrucciones a través de mensajes del
usuario o del historial, y delimitadores claros que separen el contexto
recuperado del resto de la conversación.
Por qué: prevenir que contenido malicioso en mensajes del historial del cliente
manipule el comportamiento del modelo.

### Respuesta fundamentada y atribución

**RF-21 — Contexto etiquetado**
Cuando se componga el contexto para la generación, el sistema lo etiquetará con el
número del fragmento y el título del documento de origen, en el formato
`[n] Título — contenido`.
Por qué: para que el modelo sepa de qué documento sale cada dato, pueda atribuir y no
responda de forma genérica.

**RF-22 — Estructura de la respuesta**
Cuando se genere una respuesta con contexto, el prompt de sistema exigirá una
respuesta directa al principio y el detalle después, permitirá viñetas solo cuando
haya varias opciones, pasos o requisitos, y no impondrá un tope de frases.
Por qué: una respuesta escueta no debe venir de un tope escrito en las instrucciones,
sino de que el contexto no dé para más.

**RF-23 — Parámetros de generación**
Cuando se llame al proveedor generativo, el sistema enviará la temperatura, el límite
de tokens de completion y el esfuerzo de razonamiento leídos del entorno
(`GENERATION_TEMPERATURE`, `GENERATION_MAX_COMPLETION_TOKENS`,
`GENERATION_REASONING_EFFORT`) y validados al arrancar.
Por qué: la temperatura por defecto del proveedor es más alta de lo que conviene para
RAG factual, y el límite de tokens debe contemplar el razonamiento del modelo.

**RF-24 — Recuperación asimétrica**
Cuando se embebida un fragmento de documento, el sistema usará el tipo de tarea de
recuperación de documentos; cuando se embebida una pregunta, el de recuperación de
consultas.
Por qué: los embeddings de consulta y de documento son asimétricos; codificarlos con
el mismo tipo degrada el ranking de la recuperación.

**RF-25 — Versión ligada a la configuración de embeddings**
Cuando se ingiera un documento, el sistema calculará su versión a partir del
contenido, el título y la firma de la configuración de embeddings, de modo que un
cambio de configuración invalide el corpus.
Por qué: con la versión basada solo en el contenido, reingerir los mismos archivos no
re-embebe y la base queda con vectores de un espacio anterior, incomparables con los
nuevos.

**RF-26 — Fuentes atribuidas**
Cuando se emita el evento `sources`, cada fuente incluirá el título del documento de
origen además del identificador, el índice del fragmento, el contenido y la distancia.
Por qué: sin el título, el cliente recibe datos que no puede atribuir a nada y las
fuentes no se muestran.

La reinjestada del corpus va acompañada de la recalibración de
`SIMILARITY_THRESHOLD`: el umbral vigente se calibró sobre el espacio de embeddings
anterior y deja de significar lo mismo al cambiar de tipo de tarea. El orden es
embeber el corpus con el tipo de documento antes de servir la primera consulta con el
tipo de consulta; comparar vectores de espacios distintos no da error, da rankings sin
sentido.

## Fuera de alcance actual

- Embeddings remotos de terceros: el corpus no sale de la infraestructura.
- Escalado horizontal e infraestructura distribuida avanzada.
- Autenticación de usuarios, cuentas y sesiones permanentes.
- Versionado documental sofisticado o reemplazo atómico.
- Filtros avanzados de recuperación.
- Presupuestos globales de consumo.
- Observabilidad avanzada, métricas o trazas distribuidas.
- LangChain.
- Panel de administración.
- Citas inline tipo `[^1]` dentro del texto visible de la respuesta: la atribución se
  muestra en la línea de fuentes del widget.
- Cambio de modelo generativo: el modelo vigente acepta los parámetros que faltan.

El servidor no persiste el historial ni la conversación: el cliente lo envía en
cada petición y el servidor solo lo recorta. No hay cuenta de usuario ni
conversación permanente.

## Criterios de finalización

El MVP se considera completo cuando se verifican todos estos puntos:

- Los embeddings reales se almacenan y consultan mediante `pgvector`.
- Documentos y preguntas comparten EmbeddingGemma y 768 dimensiones.
- Las respuestas con contexto se generan con Groq, emiten sus fuentes y tokens
  mediante SSE, y terminan con `done`.
- Las preguntas sin contexto no producen respuestas inventadas.
- El endpoint valida las entradas, limita el abuso por IP en memoria (ráfaga +
  diario) y no expone secretos.
- La migración, la ingesta, el arranque y el contrato SSE de `POST /api/chat`
  quedan documentados.
- El flujo completo funciona desde un entorno limpio: instalar, ingerir un
  documento y responder consultas con rate limiting activo y errores JSON.
- La respuesta se compone a partir de fragmentos etiquetados con su documento de
  origen, y el widget muestra de qué documento sale.
