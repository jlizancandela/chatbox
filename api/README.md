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

| Variable | Obligatoria | Secreto | Valor por defecto | Uso |
|---|---:|---:|---|---|
| `DATABASE_URL` | Sí | Sí | — | Conexión de la API a PostgreSQL. |
| `GEMINI_API_KEY` | Sí | Sí | — | Generación de embeddings con Gemini. |
| `GEMINI_EMBEDDING_MODEL` | No | No | `gemini-embedding-001` | Modelo de embeddings. |
| `GEMINI_VECTOR_DIMENSION` | No | No | `768` | Dimensión de los vectores; la del esquema es `768`. |
| `GROQ_API_KEY` | Sí | Sí | — | Acceso al modelo generativo de Groq. |
| `GROQ_MODEL_DEFAULT` | No | No | `openai/gpt-oss-20b` | Modelo usado para responder. |
| `SIMILARITY_THRESHOLD` | No | No | `0.5` | Umbral de similitud coseno para recuperar contexto. |
| `RETRIEVAL_TOP_K` | No | No | `5` | Número de fragmentos recuperados por pregunta. |
| `GENERATION_TEMPERATURE` | No | No | `0.6` | Temperatura de la generación, entre `0` y `2`. |
| `GENERATION_MAX_COMPLETION_TOKENS` | No | No | `2048` | Límite de tokens de la respuesta, razonamiento incluido. |
| `GENERATION_REASONING_EFFORT` | No | No | `low` | Esfuerzo de razonamiento del modelo: `low`, `medium` o `high`. |
| `CORS_ORIGIN` | Sí | No | — | Único origen permitido por CORS, por ejemplo `http://localhost:3000`. |

«Secreto» marca las variables cuyo valor no debe aparecer en un repositorio, en una
imagen ni en un log: las claves de los proveedores y la URL de la base de datos, que
lleva la contraseña dentro.

Los valores con los que la API está configurada hoy, y de dónde sale cada clave real,
viven en `api/README.local.md`: ese fichero no se versiona, porque lleva valores que
no deben salir de la máquina.

El límite de tokens incluye el razonamiento del modelo: con un esfuerzo alto, el
modelo puede gastar el presupuesto antes de responder y devolver la respuesta
vacía. `GENERATION_MAX_COMPLETION_TOKENS` tiene que cubrir las dos cosas. Con
`low`, el razonamiento de una pregunta del widget son unos pocos tokens; con
`medium` (el valor por defecto del proveedor) son del orden de varios cientos.

### Variables de Docker Compose

Estas variables configuran el contenedor de PostgreSQL definido en
`compose.yaml`:

| Variable | Obligatoria | Secreto | Valor por defecto | Uso |
|---|---:|---:|---|---|
| `POSTGRES_USER` | No | No | `postgres` | Usuario creado en PostgreSQL. |
| `POSTGRES_PASSWORD` | Sí | Sí | — | Contraseña del usuario de PostgreSQL. |
| `POSTGRES_DB` | No | No | `chatbox` | Base de datos creada. |

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

> **Una base de datos con una migración que ya no está en el directorio se queda
> atascada.** `node-pg-migrate` compara la lista de migraciones aplicadas con la
> lista de ficheros por posición, así que un registro huérfano en `pgmigrations`
> —una migración que se aplicó en su día y luego se borró del repositorio— impide
> aplicar cualquier otra. El caso real del repositorio es `004_conversation_history`,
> que se eliminó al quitar el historial en el servidor y dejó su fila en las bases
> de datos que lo:applyaron. La salida es borrar esa fila:
>
> ```sql
> DELETE FROM pgmigrations WHERE name = '004_conversation_history';
> ```
>
> La migración que la acompaña, `005_drop_conversation_history`, hace el resto
> (`DROP TABLE IF EXISTS`) y no deja rastro.


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
3. Genera embeddings de 768 dimensiones con Gemini, con el tipo de tarea de
   documento (`RETRIEVAL_DOCUMENT`) y el título del documento.
4. Guarda el documento, sus fragmentos y vectores en PostgreSQL.
5. Informa los archivos y fragmentos procesados; termina con código de error si
   algún archivo falla.

Asegúrate de haber aplicado las migraciones y de tener configurados
`DATABASE_URL` y `GEMINI_API_KEY` antes de ingerir.

### Reingerir el corpus

La versión de un documento se calcula con su contenido, su título y la firma de la
configuración de embeddings (modelo, dimensión y tipo de tarea).

La ingesta compara la versión **antes** de pedir los embeddings: si el documento ya está
con esa versión, lo reactiva y no hace ni una llamada al proveedor. Reingerir un corpus
sin cambios es gratis y lo dice en el log:

```text
✓ curriculum-jorge-lizan.md — sin cambios
✓ informe-github-jlizancandela.md — sin cambios
Done. 2 files, 13 chunks, 2 unchanged, 0 errors.
```

Solo se vuelve a embeber lo que cambió, y solo si **de verdad** cambió: el contenido, el
título o la firma de embeddings.

Cambiar la firma de embeddings —por ejemplo, pasar de un tipo de tarea a otro— invalida
el corpus: los vectores anteriores viven en otro espacio y no son comparables con los
nuevos. Cuando eso ocurre hay que reingerir:

```bash
pnpm ingest curriculum-jorge-lizan.md informe-github-jlizancandela.md
```

El corpus se embebe antes de que se sirva la primera consulta: comparar vectores de
espacios distintos no da error, da rankings sin sentido. Después de reingerir,
`SIMILARITY_THRESHOLD` hay que recalibrarlo sobre el espacio nuevo, porque el umbral
vigente se calibró sobre el anterior. El CLI de calibración imprime las distancias
de los mejores fragmentos sin llamar al modelo generativo:

```bash
node dist/cli/calibrate.js "¿Qué stack tecnológico usa Jorge?"
```

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

## La imagen de Docker

La API se distribuye como imagen en Docker Hub: `jlizancandela/api_chatbox`. El tag
`latest` apunta al último push a `main`, y cada push publica además un tag con el
SHA del commit.

La imagen lleva el TypeScript ya compilado, las dependencias de producción, las
migraciones y el corpus que se ingiere. Arranca como un usuario sin privilegios
(`node`), escucha en `$PORT` y comprueba su salud contra `/health`.

### Variables de la imagen

Además de las variables de la API, la imagen lee:

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---:|---|---|
| `PORT` | No | `7000` | Puerto en el que escucha la API. |
| `SKIP_MIGRATIONS` | No | `0` | Con `1`, el contenedor arranca **sin** aplicar migraciones. |
| `NODE_ENV` | No | `production` | Modo de ejecución. |

Las claves de los proveedores no están en la imagen: viajan por variables de
entorno, igual que en local.

### Con Compose

`compose.yaml` levanta la API y PostgreSQL con pgvector, aplica las migraciones y
espera a que la base de datos esté lista:

```bash
cp .env.example .env   # y rellena los secretos
docker compose up -d --build
curl http://localhost:7000/health
```

La API queda en `http://localhost:7000` y la base de datos en `5432`. El servicio
`api` depende de `db` con `condition: service_healthy`: sin ese healthcheck, el
primer arranque choca contra una base de datos que todavía está arrancando.

### Con Docker a pelo

```bash
docker build -t chatbox-api:test api/
docker run --rm -p 7000:7000 \
  -e DATABASE_URL=postgresql://postgres:change-me@host.docker.internal:5432/chatbox \
  -e GEMINI_API_KEY=... \
  -e GEMINI_VECTOR_DIMENSION=768 \
  -e GROQ_API_KEY=... \
  -e CORS_ORIGIN=https://jorgelizancandela.com \
  chatbox-api:test
```

### Migraciones

El contenedor aplica las migraciones pendientes antes de arrancar. Es seguro
repetirlo: `node-pg-migrate` solo aplica lo que falta.

Con más de una réplica, las migraciones tienen que correr una sola vez. Para eso
está `SKIP_MIGRATIONS`: con `1`, el contenedor arranca sin tocar el esquema y
espera a que otro lo haga.

```bash
docker compose run --rm -e SKIP_MIGRATIONS=1 api start
```

### Ingesta

El comando `ingest` lee el corpus que viaja en la imagen y lo graba en la base de
datos:

```bash
docker compose run --rm api ingest curriculum-jorge-lizan.md
docker compose run --rm api ingest curriculum-jorge-lizan.md informe-github-jlizancandela.md
```

Sin nombres, ingiere todo el corpus de la imagen:

```bash
docker compose run --rm api ingest
```

El comando **aplica las migraciones antes de ingerir**, así que funciona sobre una base
de datos recién creada sin que la API haya arrancado nunca. Y no vuelve a embeber lo que
no cambió: si el corpus de la imagen es el mismo que el de la base, la ingesta termina en
un segundo y sin llamar al proveedor.

### Healthcheck

La imagen declara un `HEALTHCHECK` contra `/health`:

```bash
docker inspect --format '{{.State.Health.Status}}' <contenedor>
```

Un contenedor `healthy` es el que responde `{"status":"ok"}` en `/health` y el que
el balanceador da por bueno.

### En el VPS

El VPS (`/home/jorge/svr`) corre su propio `docker-compose.yml`, con Traefik
enrutando por `Host(...)` y `cloudflared` publicando el túnel. Los servicios del
chatbox son dos: `chatbox-api` (el servicio, con la imagen
`jlizancandela/api_chatbox`) y `chatbox-db` (PostgreSQL con pgvector, con volumen
nombrado).

```yaml
services:
  chatbox-api:
    image: jlizancandela/api_chatbox:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chatboxapi.rule=Host(`api.jorgelizancandela.com`)"
      - "traefik.http.routers.chatboxapi.entrypoints=web"
      - "traefik.http.services.chatboxapi.loadbalancer.server.port=7000"
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@chatbox-db:5432/chatbox
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      GEMINI_VECTOR_DIMENSION: "768"
      GROQ_API_KEY: ${GROQ_API_KEY}
      CORS_ORIGIN: https://jorgelizancandela.com
    depends_on:
      - chatbox-db
    networks:
      - traefik-public
    restart: always

  chatbox-db:
    image: pgvector/pgvector:pg18
    volumes:
      - chatbox-db-data:/var/lib/postgresql
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: chatbox
    restart: always
```

El despliegue es el de siempre: `just deploy` tira de la imagen y levanta el stack.

**La ingesta va colgada del despliegue**, no del arranque del contenedor. Como el corpus
viaja dentro de la imagen, cualquier cambio en un documento obliga a publicar una imagen
nueva; con la ingesta dentro de `just deploy`, el corpus no se queda viejo nunca y el
arranque de la API no depende del proveedor de embeddings:

```make
deploy:
	docker compose down
	docker compose pull
	docker compose up -d
	docker compose run --rm chatbox-api ingest
```

Y como la ingesta no reembebe lo que no cambió, un despliegue sin documentos nuevos
termina en un segundo.

El hostname `api.jorgelizancandela.com` se declara en el panel de Cloudflare: el
túnel corre con `--token` y sus ingress no viven en un fichero.

## Llamada a `POST /api/chat`

Con la API arrancada y desde cualquier directorio, realiza una petición JSON
incluyendo una pregunta:

```bash
curl -N -X POST http://localhost:7000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "¿Qué tecnologías usa Jorge en el proyecto?",
    "history": []
  }'
```

El cuerpo debe contener `question` (obligatorio) y opcionalmente `history`.
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

### Historial de conversación

El cliente envía el historial de la conversación en cada petición, dentro del
campo `history` del cuerpo de la petición:

```json
{
  "question": "...",
  "history": [
    { "role": "user", "content": "Primera pregunta" },
    { "role": "assistant", "content": "Primera respuesta" }
  ]
}
```

El servidor no persiste el historial. Este campo es opcional; si se omite, la
conversación empieza sin historial. Los mensajes de usuario y asistente se
incluyen tal cual en el contexto enviado a Groq.

## Tests

Ejecuta la suite completa desde `api/`:

```bash
pnpm test
```

Los tests compilan TypeScript, ejecutan la suite y recogen cobertura. `pnpm verify`
es lo mismo sin cobertura, y es lo que corre CI.

La suite es **hermética**: no hace ninguna petición a los proveedores y no necesita
sus credenciales. Los proveedores externos —base de datos, generación y embeddings—
entran por el **punto único de inyección de la aplicación**, las opciones de
construcción (`src/dependencies.ts`): los tests de ruta pasan dobles por ahí y en
producción no se pasa nada, así que se usan los de verdad. Los servicios, a su vez,
reciben su colaborador por parámetro en vez de construirlo dentro.

Lo único que pide el entorno es lo del test de integración de `pgvector`
(`DATABASE_URL`) y `CORS_ORIGIN`. Ni claves de Gemini ni de Groq.

Un guardián (`test/setup.ts`, cargado con `-r`) cierra `fetch` a todo lo que no sea el
bucle local: si un test se olvida de un doble, falla al instante y dice qué URL intentó
alcanzar, en vez de quedarse colgado hasta que la red agota el tiempo. Para hablar con
el proveedor de verdad a propósito, `API_TEST_ALLOW_NETWORK=1`.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Desarrollo con compilación y recarga. |
| `pnpm start` | Arranque local de producción. |
| `pnpm test` | Compilación y suite de tests con cobertura. |
| `pnpm verify` | Compilación, typecheck de los tests y suite, sin cobertura. |
| `pnpm test:run` | Solo la suite, sin el paso de compilación previa (ts-node compila al vuelo). |
| `pnpm db:migrate` | Aplica migraciones pendientes. |
| `pnpm ingest <archivos>` | Ingresa uno o más archivos desde `ingest/`. |
