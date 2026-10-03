# Chatbox API

API Fastify en TypeScript para ingesta de documentos, recuperación vectorial con
PostgreSQL/pgvector y respuestas fundamentadas mediante Gemini y Groq.

## Requisitos

- Node.js compatible con el proyecto.
- pnpm.
- Docker y Docker Compose, para ejecutar PostgreSQL con pgvector.
- Claves de API de Gemini y Groq para embeddings y generación.

Todos los comandos de esta guía se ejecutan desde `api/`.

## Instalación y variables de entorno

Instala las dependencias y crea el archivo local de configuración:

```bash
pnpm install
cp .env.example .env
```

Edita `.env` y sustituye los placeholders por valores reales. `.env` está
ignorado por Git y no debe versionarse ni compartirse.

### Variables de la API

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `DATABASE_URL` | Sí | — | Conexión de la API a PostgreSQL. |
| `GEMINI_API_KEY` | Sí | — | Generación de embeddings con Gemini. |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Modelo de embeddings. |
| `GEMINI_VECTOR_DIMENSION` | Sí | — | Dimensión de los vectores; debe ser `768` para este esquema. |
| `GROQ_API_KEY` | Sí | — | Acceso al modelo generativo de Groq. |
| `GROQ_MODEL_DEFAULT` | No | `openai/gpt-oss-20b` | Modelo usado para responder. |
| `SIMILARITY_THRESHOLD` | No | `0.5` | Umbral de similitud coseno para recuperar contexto. |
| `CORS_ORIGIN` | Sí | — | Único origen permitido por CORS, por ejemplo `http://localhost:3000`. |

### Variables de Docker Compose

Estas variables configuran el contenedor de PostgreSQL definido en
`compose.yaml`:

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `POSTGRES_USER` | No | `postgres` | Usuario creado en PostgreSQL. |
| `POSTGRES_PASSWORD` | Sí | — | Contraseña del usuario de PostgreSQL. |
| `POSTGRES_DB` | No | `chatbox` | Base de datos creada. |

`DATABASE_URL` debe apuntar al mismo usuario, contraseña, host, puerto y base de
datos que utiliza Compose. `api/.env.example` contiene una plantilla segura con
placeholders; no contiene credenciales reales.

## PostgreSQL y migraciones

Arranca PostgreSQL con la imagen que incluye pgvector:

```bash
docker compose up -d db
```

Carga las variables en la shell y aplica todas las migraciones pendientes:

```bash
set -a
source .env
set +a
pnpm db:migrate
```

Las migraciones se encuentran en `database/migrations/`, se ejecutan en orden
por nombre y quedan registradas en la tabla `pgmigrations`. Es seguro volver a
ejecutar el comando: solo se aplican las migraciones pendientes.

La migración de embeddings cambia el esquema de `vector(384)` a `vector(768)`.
Los embeddings antiguos no se pueden convertir de forma segura, por lo que esa
migración elimina los documentos almacenados. Después de aplicarla hay que
volver a ingerir los documentos.

Para detener el contenedor sin borrar los datos:

```bash
docker compose stop db
```

## Ingesta de documentos

Coloca archivos Markdown o texto plano en `ingest/`. El comando recibe uno o
más nombres de archivo relativos a ese directorio:

```bash
pnpm ingest curriculum-jorge-lizan.md
pnpm ingest curriculum-jorge-lizan.md informe-github-jlizancandela.md
```

La ingesta:

1. Lee cada archivo desde `ingest/`.
2. Lo divide en fragmentos de 512 caracteres con solapamiento de 50.
3. Genera embeddings de 768 dimensiones con Gemini.
4. Guarda el documento, sus fragmentos y vectores en PostgreSQL.
5. Informa los archivos y fragmentos procesados; termina con código de error si
   algún archivo falla.

Asegúrate de haber aplicado las migraciones y de tener configurados
`DATABASE_URL`, `GEMINI_API_KEY` y `GEMINI_VECTOR_DIMENSION` antes de ingerir.

## Arranque de la API

Para desarrollo, con compilación y recarga durante los cambios:

```bash
pnpm dev
```

La API queda disponible en `http://localhost:7000`. Para comprobar que está
levantada:

```bash
curl http://localhost:7000/health
```

Para arrancar la versión de producción local:

```bash
pnpm start
```

Los comandos de arranque usan logging mínimo (`warn`) para no registrar cuerpos
de petición ni contenido sensible.

## Llamada a `POST /api/chat`

Con la API arrancada y desde cualquier directorio, realiza una petición JSON
incluyendo una pregunta:

```bash
curl -N -X POST http://localhost:7000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "¿Qué tecnologías usa Jorge en el proyecto?"
  }'
```

El cuerpo debe contener únicamente `question`. Debe ser una cadena de entre 1 y
1000 caracteres después de quitar espacios al principio y al final.

La respuesta es un stream Server-Sent Events (`Content-Type:
text/event-stream`): el servidor emite eventos mientras genera la respuesta, en
lugar de esperar al resultado completo.

### Contrato de eventos

| Evento | Datos | Significado |
|---|---|---|
| `sources` | `{"sources":[...]}` | Fragmentos recuperados; se emite antes de llamar a Groq. |
| `token` | `{"token":"..."}` | Fragmento de la respuesta generada por el modelo. |
| `done` | `{}` | Fin del stream. |
| `error` | `{"message":"..."}` | Error durante el stream (no filtra detalles internos). |

Secuencia normal: `sources`, uno o más `token`, `done`. Sin contexto
suficiente, la API no invoca al modelo generativo y emite únicamente
`sources` (con lista vacía) y `done`. Los errores de validación previos al
stream vuelven a responder como JSON con código `400`.

Ejemplo de frames:

```text
event: sources
data: {"sources":[{"documentId":"123","chunkIndex":0,"content":"Fragmento documental de ejemplo.","distance":0.23}]}

event: token
data: {"token":"La respuesta basada en los documentos recuperados"}

event: done
data: {}
```

### Consumo desde el front

Ejemplo con `fetch` y `ReadableStream`:

```js
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question })
})

if (response.status !== 200) {
  const error = await response.json()
  throw new Error(error.error?.message ?? 'Request failed')
}

const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const frames = buffer.split('\n\n')
  buffer = frames.pop() ?? ''

  for (const frame of frames) {
    const event = frame.match(/^event: (.+)$/m)?.[1]
    const data = frame.match(/^data: (.+)$/m)?.[1]
    if (!event || !data) continue

    const payload = JSON.parse(data)
    if (event === 'sources') renderSources(payload.sources)
    if (event === 'token') appendToken(payload.token)
    if (event === 'done') finish()
    if (event === 'error') fail(payload.message)
  }
}
```

Si el cliente se desconecta a mitad de la respuesta, el servidor cancela la
petición a Groq mediante un `AbortController` ligado a la señal de la
petición, de modo que no se sigue consumiendo el modelo generativo.

## Contrato del historial (Paso 6)

El historial temporal de conversación se recupera en `POST /api/chat`. El
servidor deriva la sesión mediante HMAC de la IP, recupera los mensajes más
 recientes y los incluye en el contexto enviado a Groq. El cliente sigue
enviando únicamente `{ question }`. Las respuestas completadas se guardan
 atómicamente al finalizar el stream.

El historial lo resuelve siempre el servidor a partir de la sesión, no el
cliente. El front mantiene su propia copia de la conversación para pintarla,
pero no la envía.

### Mensajes

| Campo | Tipo | Descripción |
|---|---|---|
| `seq` | `number` | Entero de 1 en adelante, monótono y creciente por sesión, nunca reutilizado. |
| `role` | `"user" \| "assistant"` | Único origen y único destino. No se guarda ningún rol de sistema. |
| `content` | `string` | Contenido normalizado: sin espacios en los extremos y recortado al máximo por mensaje. |
| `createdAt` | `string` | Fecha ISO 8601 informativa. El orden lo determina `seq`, no la fecha. |

El prompt de sistema se construye en cada petición a partir del contexto
recuperado y nunca se guarda como mensaje del historial.

### Orden y turnos

- El historial se lee en orden `seq` ascendente.
- Un turno es un mensaje de usuario seguido del mensaje del asistente que lo
  responde.
- Un turno puede quedar sin respuesta: si no hubo contexto suficiente, si el
  cliente se desconectó o si el proveedor falló, la pregunta del usuario se
  conserva y el siguiente turno vuelve a empezar por un mensaje de usuario.
- Por tanto el historial **nunca empieza por un mensaje del asistente**: al
  recortar, si el primer mensaje superviviente fuera del asistente, se
  descarta por quedarse sin su pregunta.
- Al recortar no se renumera `seq`. Los huecos son válidos y reflejan que el
  orden almacenado no se reescribe.
- Si la lectura de la sesión falla, el chat continúa con historial vacío y no
  registra el contenido de los mensajes.
- Dos mensajes `user` consecutivos se fusionan con una línea en blanco antes
  de enviarse a Groq.

### Límites

| Límite | Valor por defecto | Variable |
|---|---|---|
| Mensajes conservados por sesión | 20 | `HISTORY_MAX_MESSAGES` |
| Caracteres por mensaje | 2000 | `HISTORY_MAX_MESSAGE_CHARS` |
| Caracteres totales por sesión | 8000 | `HISTORY_MAX_TOTAL_CHARS` |
| TTL de sesión inactiva (minutos) | 15 | `HISTORY_SESSION_TTL_MINUTES` |

Las cuatro variables aceptan enteros positivos y se validan al arrancar; un valor
inválido detiene el arranque. El TTL se renueva con cada reutilización válida de
la sesión mediante `last_activity_at` y `expires_at`; si transcurre el TTL sin
actividad, la sesión expira. Al superar un límite se recortan los turnos más
antiguos primero, nunca el mensaje más reciente. El contenido que exceda el
máximo por mensaje se trunca en lugar de rechazarse, para que una petición
válida nunca falle por su longitud.

## Tests

Ejecuta la suite completa desde `api/`:

```bash
pnpm test
```

Los tests compilan TypeScript, ejecutan las pruebas HTTP e integración y
recogen cobertura. Necesitan el entorno local configurado según `.env` y los
servicios que requieran las pruebas disponibles.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Desarrollo con compilación y recarga. |
| `pnpm start` | Arranque local de producción. |
| `pnpm test` | Compilación y suite de tests. |
| `pnpm db:migrate` | Aplica migraciones pendientes. |
| `pnpm ingest <archivos>` | Ingresa uno o más archivos desde `ingest/`. |
