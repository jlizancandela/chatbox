# Diseño detallado de `useChatStream`

## Estado del documento

Este documento describe la implementación del hook `useChatStream`.
El hook ya está implementado; este documento conserva su contrato, decisiones
y escenarios de prueba.

La finalidad es dejar documentados el propósito, las responsabilidades, los
estados, los errores, los efectos secundarios y las pruebas necesarias antes de
comenzar la implementación.

## 1. Propósito

`useChatStream` es la capa de aplicación que conecta la interfaz del chat con
el endpoint SSE del API:

```text
Chatbox
  │
  └── useChatStream()
        │
        ├── buildChatRequest()
        ├── fetch()
        ├── ReadableStream
        ├── createSSEParser()
        ├── AbortController
        └── useChat() / chatReducer
```

El hook coordinará una petición completa: construir el body, abrir el stream,
interpretar sus eventos, actualizar el estado del turno y limpiar todos los
recursos al terminar.

No será responsable de pintar la interfaz ni de decidir cómo se muestran los
mensajes. Esas responsabilidades pertenecerán a `Chatbox`, `MessageList`,
`Composer` y otros componentes de presentación.

## 2. Responsabilidades

### Responsabilidades del hook

- Recibir una pregunta y el contexto actual.
- Construir el body de `POST /api/chat`.
- Crear un `AbortController` para el turno.
- Ejecutar `fetch` con `ReadableStream`.
- Leer chunks binarios mediante `TextDecoder`.
- Pasar los chunks al parser SSE existente.
- Convertir eventos SSE en acciones de `useChat()`.
- Agrupar tokens para evitar un render por token.
- Aplicar timeout por inactividad.
- Traducir errores técnicos a errores aptos para la interfaz.
- Cancelar y limpiar el turno actual.

### Responsabilidades que no tendrá

- Renderizar JSX.
- Renderizar Markdown.
- Mostrar directamente las fuentes.
- Recortar el historial manualmente: usará `buildChatRequest()`.
- Persistir directamente: la persistencia pertenece a `storage.ts` y al flujo
  de estado correspondiente.
- Inventar respuestas cuando no haya contexto.
- Mostrar mensajes internos del API.
- Reintentar automáticamente peticiones fallidas.

## 3. API pública prevista

El contrato público implementado es:

```ts
type UseChatStreamOptions = {
  apiUrl: string;
  chat: ChatController;
  timeoutMs?: number;
};

type UseChatStreamResult = {
  sendQuestion: (text: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
};
```

Ejemplo de uso desde el componente:

```tsx
const chat = useChat();
const stream = useChatStream({
  apiUrl,
  chat,
  timeoutMs: 30_000,
});

async function handleSubmit(question: string) {
  await stream.sendQuestion(question);
}

return (
  <button type="button" onClick={stream.abort} disabled={!stream.isStreaming}>
    Detener
  </button>
);
```

El hook recibirá el estado y las acciones de `useChat()` mediante composición o
una interfaz equivalente. No debe crear un store global ni compartir el estado
entre dos instancias del widget.

## 4. Estados del turno

Los estados definidos por el contrato son:

```ts
type TurnState =
  | "idle"
  | "connecting"
  | "generating"
  | "streaming"
  | "error"
  | "aborted";
```

### `idle`

No existe ninguna petición activa.

- El usuario puede enviar una pregunta.
- El botón principal muestra “Enviar”.
- No hay `AbortController` activo.
- No debe quedar ningún timeout pendiente.

### `connecting`

La pregunta ya se ha aceptado y el `fetch` está intentando obtener la
respuesta.

- Se crea el mensaje del usuario.
- Se crea el controller del turno.
- El botón “Enviar” se sustituye por “Detener”.
- Todavía no se ha recibido ningún evento SSE.

### `generating`

Se ha recibido `sources`, pero todavía no ha llegado ningún token.

- El historial canónico del servidor ya puede sustituir a `context`.
- Las fuentes se guardan en el estado del turno.
- El indicador “escribiendo” continúa visible.
- Puede ser una respuesta con contexto o el caso sin contexto.

### `streaming`

Se ha recibido al menos un `token`.

- Los tokens se acumulan en la respuesta actual.
- La burbuja del asistente se actualiza progresivamente.
- El turno todavía no entra en `context` hasta recibir `done`.

### `error`

La petición no pudo completarse correctamente.

- Se conserva la respuesta parcial si ya existía.
- El turno incompleto no se añade a `context`.
- Se muestra un mensaje local en español.
- La interfaz puede ofrecer “Reintentar”.

### `aborted`

El usuario o el sistema canceló el turno.

- Se conserva el texto parcial como interrumpido.
- El turno no se añade a `context`.
- No se debe presentar el aborto como un error del servidor.

### Diagrama

```text
idle
  │ sendQuestion()
  ▼
connecting
  ├── sources ───────────────▶ generating
  ├── TypeError/HTTP error ──▶ error
  ├── timeout ───────────────▶ error
  └── abort ─────────────────▶ aborted

 generating
  ├── token ─────────────────▶ streaming
  ├── done sin tokens ───────▶ idle
  ├── error ─────────────────▶ error
  ├── timeout ───────────────▶ error
  └── abort ─────────────────▶ aborted

 streaming
  ├── token ─────────────────▶ streaming
  ├── done ──────────────────▶ idle
  ├── error ─────────────────▶ error
  ├── timeout ───────────────▶ error
  └── abort ─────────────────▶ aborted
```

## 5. Construcción de la petición

El hook no debe construir el historial a mano. Debe delegarlo a la función de
dominio existente:

```ts
const request = buildChatRequest(question, chat.state.context);
```

El resultado tiene esta forma:

```json
{
  "question": "¿Qué tecnologías usa Jorge?",
  "history": [
    {
      "role": "user",
      "content": "Pregunta anterior"
    },
    {
      "role": "assistant",
      "content": "Respuesta anterior"
    }
  ]
}
```

La petición será:

```ts
const response = await fetch(`${apiUrl}/api/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
  signal: controller.signal,
});
```

### Por qué se usa `fetch`

`EventSource` no sirve para este contrato porque solo soporta peticiones `GET` y
no permite enviar el JSON con `question` e `history`. `fetch` permite usar
`POST`, enviar el body y asociar un `AbortSignal`.

### Validación previa

`buildChatRequest()` ya se ocupa de:

- eliminar espacios exteriores de la pregunta;
- rechazar preguntas vacías;
- rechazar preguntas de más de 1000 caracteres;
- filtrar y recortar el contexto;
- respetar los límites de 20 mensajes, 2000 caracteres por mensaje y 8000
  caracteres totales.

Si la validación falla antes de `fetch`, el hook debe convertir el error en un
mensaje propio y no iniciar ninguna petición.

## 6. Comprobación de la respuesta HTTP

Antes de leer `response.body`, el hook debe comprobar `response.ok` y el código
HTTP.

```ts
if (!response.ok) {
  throw mapHttpError(response.status);
}
```

La respuesta de error del API no se debe mostrar directamente al usuario. El
hook debe producir errores de interfaz estables:

| Situación | Mensaje de interfaz | Acción |
|---|---|---|
| `400` | “No se pudo enviar esa pregunta.” | Editar |
| `413` | “La conversación es demasiado larga. Empieza una nueva.” | Nueva conversación |
| `429` | “Has alcanzado el límite de preguntas. Inténtalo más tarde.” | Sin reintento automático |
| `5xx` | “Algo ha fallado. Inténtalo de nuevo.” | Reintentar |
| `TypeError`/CORS | “No se pudo conectar. Comprueba tu conexión.” | Reintentar |

El hook no debe depender de que el JSON de error tenga una forma concreta para
poder mostrar su mensaje. El cuerpo interno puede registrarse para diagnóstico
solo si el proyecto decide añadir logging seguro; nunca debe llegar a la UI.

## 7. Lectura del `ReadableStream`

Una respuesta correcta tendrá `Content-Type: text/event-stream` y un body
legible mediante `ReadableStream`.

Flujo conceptual:

```ts
const reader = response.body?.getReader();

if (!reader) {
  throw new Error("STREAM_UNAVAILABLE");
}

const decoder = new TextDecoder();
const parser = createSSEParser();

while (true) {
  const { done, value } = await reader.read();

  if (done) {
    break;
  }

  const chunk = decoder.decode(value, { stream: true });
  const events = parser.feed(chunk);

  for (const event of events) {
    handleEvent(event);
  }
}
```

### Por qué no se debe hacer `JSON.parse(chunk)`

Los chunks de red no coinciden necesariamente con los frames SSE. Un evento
puede llegar partido en varios chunks y varios eventos pueden llegar juntos en
uno solo. `createSSEParser()` mantiene el buffer y solo devuelve eventos
completos.

### Cierre del stream

El API termina normalmente con un evento `done`. Si el reader termina sin haber
recibido `done`, el hook debe tratarlo como una respuesta interrumpida:

```text
stream cerrado + no done → estado error
```

No debe guardar el turno incompleto en `context`.

## 8. Mapeo de eventos SSE al estado

El parser existente produce esta unión:

```ts
type ChatEvent = SourcesEvent | TokenEvent | DoneEvent | ErrorEvent;
```

El hook traducirá cada evento a una acción de `useChat()`:

```ts
for (const event of events) {
  switch (event.type) {
    case "sources":
      chat.receiveSources(event.sources, event.history);
      break;

    case "token":
      enqueueToken(event.token);
      break;

    case "done":
      flushPendingTokens();
      chat.completeTurn();
      break;

    case "error":
      chat.failTurn(chatErrors.streamEvent(event));
      break;
  }
}
```

### Evento `sources`

El evento llega antes de los tokens:

```json
{
  "sources": [
    {
      "documentId": "cv.md",
      "chunkIndex": 0,
      "content": "Experiencia con Preact",
      "distance": 0.2
    }
  ],
  "history": [
    {
      "role": "user",
      "content": "Pregunta anterior"
    }
  ]
}
```

El hook debe guardar las fuentes y sustituir `context` por `history`. Las
fuentes no se mostrarán todavía en el MVP.

### Evento `token`

Cada token se acumula en la respuesta actual. El hook no debe añadir todavía el
turno al contexto porque la respuesta aún puede fallar o ser abortada.

### Evento `done`

Cuando hay al menos un token, `completeTurn()` puede confirmar el turno:

```text
messages ← pregunta + respuesta completa
context  ← contexto anterior + pregunta + respuesta completa
```

Si llega `sources: []` y después `done` sin tokens, no se añade el turno al
contexto. La interfaz mostrará después el mensaje local de “no lo tengo”.

### Evento `error`

El texto recibido en `event.message` no se muestra directamente. El código
`event.code` decide el error de interfaz: `QUOTA_EXHAUSTED` tiene su propio
mensaje ("el asistente está ocupado", no "algo falló") y el resto cae en el
genérico. `retryAfterSeconds` viaja con el error cuando el proveedor lo da.

## 9. Agrupación de tokens con `requestAnimationFrame`

Los modelos pueden emitir muchos tokens por segundo. Actualizar el estado una
vez por token provocaría renders innecesarios y podría hacer que la interfaz
perdiera fluidez.

La solución es acumular tokens y publicar una actualización como máximo por
frame:

```ts
let pendingTokens = "";
let frameId: number | null = null;

function enqueueToken(token: string) {
  pendingTokens += token;

  if (frameId !== null) {
    return;
  }

  frameId = requestAnimationFrame(() => {
    if (pendingTokens.length > 0) {
      chat.receiveToken(pendingTokens);
    }

    pendingTokens = "";
    frameId = null;
  });
}
```

### Limpieza del frame

El frame pendiente debe cancelarse al terminar, abortar o fallar:

```ts
function flushPendingTokens() {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
  }

  if (pendingTokens.length > 0) {
    chat.receiveToken(pendingTokens);
    pendingTokens = "";
  }
}
```

Nunca debe quedar un callback de un turno anterior capaz de modificar el nuevo
turno.

## 10. Timeout por inactividad

El timeout inicial será de 30 segundos:

```ts
const DEFAULT_TIMEOUT_MS = 30_000;
```

No es un límite artificial de duración total. Es un límite de inactividad: si
el servidor no produce actividad durante ese periodo, la petición se cancela y
se trata como error de red.

El timer debe:

- iniciarse al comenzar el turno;
- reiniciarse al recibir actividad del stream según la decisión final de la
  implementación;
- limpiarse con `done`;
- limpiarse con `error`;
- limpiarse con `abort`;
- no quedar activo después de cambiar a `idle`, `error` o `aborted`.

Una implementación posible:

```ts
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function armTimeout() {
  clearTimeout(timeoutId ?? undefined);
  timeoutId = setTimeout(() => {
    controller.abort();
    chat.failTurn({
      code: "TIMEOUT",
      message: "No se pudo conectar. Comprueba tu conexión.",
    });
  }, timeoutMs);
}
```

La decisión de reiniciar el timer por chunk recibido o por evento SSE completo
debe quedar fijada en los tests. La opción más segura es reiniciarlo cuando
llega un chunk del stream, porque demuestra que la conexión sigue activa aunque
el frame todavía no esté completo.

## 11. AbortController

Cada turno tendrá su propio controller:

```ts
const controller = new AbortController();
```

`abort()` debe:

1. comprobar si existe una petición activa;
2. llamar a `controller.abort()`;
3. cancelar el reader si está disponible;
4. cancelar el `requestAnimationFrame` pendiente;
5. limpiar el timeout;
6. cambiar el estado a `aborted`;
7. evitar que callbacks antiguos modifiquen el siguiente turno.

El aborto no debe producir un mensaje de error de red. Es una acción intencional
del usuario.

### Carrera entre abort y done

Si `done` y `abort()` ocurren casi al mismo tiempo, solo el primer resultado
válido del turno puede confirmar o cancelar el turno. Para evitar actualizaciones
tardías se puede usar una identidad de turno:

```ts
const turnId = Symbol("chat-turn");
```

Los callbacks deben comprobar que siguen perteneciendo al turno activo antes de
despachar acciones.

## 12. Casos especiales

### Sin contexto suficiente

Secuencia:

```text
sources: { sources: [], history: [...] }
done: {}
```

No hay `token`. El hook termina el turno sin añadirlo a `context`. La UI será la
responsable de mostrar el texto local configurado.

### Error antes de `sources`

Un evento `error` puede ser el primer frame válido. El hook debe pasar a `error`
sin asumir que ya existe una fuente o una respuesta parcial.

### Error después de tokens

La respuesta parcial se conserva para poder marcarla como incompleta, pero no se
confirma en `context`.

### Doble envío

Mientras exista un turno activo, la interfaz debe deshabilitar el envío o el
hook debe rechazar una segunda llamada. No se deben ejecutar dos streams sobre
el mismo estado de conversación.

### `response.body === null`

Se trata como error de transporte. No se intenta leer ni se crea un parser sin
stream.

## 13. Limpieza garantizada

La implementación debe centralizar la limpieza:

```text
finalización normal ─┐
error ────────────────┤
abort ────────────────┤──► clear timeout
stream incompleto ───┘    cancel frame
                           cancelar reader
                           invalidar callbacks
```

Esto evita memory leaks, actualizaciones después de desmontar el componente y
cambios de estado de una pregunta antigua sobre una pregunta nueva.

## 14. Tests previstos

Los tests deben vivir bajo `test/`, separados del código productivo.

### Flujo normal

Simular:

```text
fetch → sources → token("Hola") → token(".") → done
```

Comprobar:

- estados en orden;
- respuesta final `Hola.`;
- `done` confirma el turno;
- el contexto contiene el par user/assistant;
- se limpian timer, reader y frame.

### Sin contexto

Simular `sources` vacío seguido de `done`.

Comprobar:

- no se recibe ningún token;
- no se añade respuesta inventada;
- el turno no entra en `context`;
- el hook vuelve a `idle`.

### Errores HTTP

Probar respuestas `400`, `413`, `429` y `500`.

Comprobar que cada una produce el mensaje propio y que nunca se muestra el
JSON interno del servidor.

### Error de red/CORS

Hacer que `fetch` lance `TypeError` y comprobar el mensaje de conexión.

### Error mid-stream

Enviar un token y después un evento `error`.

Comprobar que:

- se conserva la respuesta parcial;
- el estado es `error`;
- el turno no entra en `context`;
- el mensaje del servidor no llega a la UI.

### Abort

Abortar antes de recibir datos y durante la recepción de tokens.

Comprobar que:

- se llama a `AbortController.abort()`;
- el estado es `aborted`;
- no aparece un error de red;
- no se confirma el turno;
- no quedan timers ni frames pendientes.

### Timeout

Usar timers falsos y dejar el stream sin actividad durante 30 segundos.

Comprobar que:

- se aborta el controller;
- el estado termina en `error`;
- se muestra el mensaje de conexión;
- no se confirma el turno.

### Stream sin `done`

Cerrar el reader después de uno o más tokens sin enviar `done`.

Comprobar que el resultado se marca como interrumpido y no entra en `context`.

### Chunks partidos

Enviar un frame SSE partido en varias lecturas y varios frames dentro de una
sola lectura. El hook debe delegar este comportamiento a `createSSEParser()` y
no implementar un parser paralelo.

## 15. Relación con los módulos actuales

```text
chat/domain/conversation.ts
  └── valida y construye el request

chat/application/chat-reducer.ts
  └── aplica las transiciones del turno

chat/hooks/useChat.ts
  └── expone el estado reactivo y las acciones

chat/infrastructure/sse.ts
  └── convierte texto SSE en ChatEvent

chat/infrastructure/storage.ts
  └── guarda y restaura la conversación

useChatStream.ts
  └── coordina fetch, reader, parser, abort y timeout
```

El hook debe reutilizar estos módulos. No debe duplicar reglas de historial,
validación SSE o persistencia.

## 16. Estado de implementación

La implementación actual se encuentra en `src/chat/hooks/useChatStream.ts` y
su runner testeable se expone mediante `createChatStreamRunner()`. Los tests
relacionados están en `test/unit/chat/hooks/use-chat-stream.test.ts`.

## 17. Definición de terminado

La futura implementación estará terminada cuando:

- `useChatStream` envíe preguntas con el contexto recortado;
- procese correctamente `sources`, `token`, `done` y `error`;
- actualice `useChat` sin hacer estado global;
- agrupe tokens por frame de animación;
- aborte y limpie todos los recursos;
- aplique timeout por inactividad;
- traduzca errores sin filtrar mensajes internos;
- no confirme turnos incompletos;
- todos los tests del hook pasen;
- `npm run lint`, `npm test -- --run` y `npm run build` pasen.
