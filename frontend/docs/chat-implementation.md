# Implementación actual del frontend

## Propósito

El frontend es un cliente Preact + TypeScript del API RAG de Chatbox. Su
responsabilidad es enviar preguntas, consumir respuestas SSE y presentar una
conversación sobre el perfil documental de Jorge.

Actualmente están implementados los tipos del contrato, el adaptador SSE, las
reglas de conversación, la persistencia temporal y sus pruebas unitarias. El
hook de streaming y el componente visual todavía no están implementados.

## Estructura actual

```text
src/
├── chat/
│   ├── application/
│   │   ├── chat-reducer.ts
│   │   └── chat-reducer.test.ts
│   ├── domain/
│   │   ├── conversation.ts
│   │   └── conversation.test.ts
│   ├── hooks/
│   │   └── useChat.ts
│   ├── infrastructure/
│   │   ├── sse.ts
│   │   ├── sse.test.ts
│   │   ├── storage.ts
│   │   └── storage.test.ts
│   └── types.ts
├── assets/
├── index.tsx
├── style.css
└── vite-env.d.ts
```

- `chat/types.ts`: tipos del contrato compartido entre frontend y API.
- `chat/domain/conversation.ts`: reglas puras, límites y construcción de
  peticiones.
- `chat/application/chat-reducer.ts`: estado y transiciones puras del turno.
- `chat/hooks/useChat.ts`: fachada reactiva local sobre `useReducer`.
- `chat/infrastructure/sse.ts`: adaptación de frames SSE a eventos tipados.
- `chat/infrastructure/storage.ts`: adaptación tolerante a `sessionStorage`.
- `*.test.ts`: pruebas unitarias de los módulos implementados.

## Tipos del chat

### `ChatMessage`

```ts
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
```

Representa un mensaje del historial. Solo se aceptan los roles `user` y
`assistant`.

### `ChatSource`

```ts
type ChatSource = {
  documentId: string;
  chunkIndex: number;
  content: string;
  distance: number;
};
```

Representa un fragmento documental recuperado por el API. Las fuentes se
reciben y se conservan en el evento SSE, aunque todavía no se muestran en una
interfaz visual.

### Eventos SSE

Todos los eventos tienen un discriminador `type`:

```ts
type SourcesEvent = {
  type: "sources";
  sources: ChatSource[];
  history: ChatMessage[];
};

type TokenEvent = {
  type: "token";
  token: string;
};

type DoneEvent = {
  type: "done";
};

type ErrorEvent = {
  type: "error";
  message: string;
};
```

`ChatEvent` es la unión de esos cuatro eventos. `TurnState` define los estados
previstos para el futuro hook: `idle`, `connecting`, `generating`, `streaming`,
`error` y `aborted`.

## Adaptador SSE

Archivo: `src/chat/infrastructure/sse.ts`.

El módulo usa `eventsource-parser` para recomponer frames que pueden llegar
partidos entre chunks. No implementa manualmente el protocolo SSE.

### `SSEParser`

```ts
type SSEParser = {
  feed: (chunk: string) => ChatEvent[];
  reset: () => void;
};
```

`feed` acepta un chunk de texto y devuelve todos los eventos completos
producidos por ese chunk. Puede devolver un array vacío si el frame todavía no
está completo. `reset` limpia el estado del parser para reutilizarlo con otro
stream.

### `createSSEParser()`

```ts
createSSEParser(): SSEParser
```

Crea un parser con estado incremental. Convierte únicamente los eventos
`sources`, `token`, `done` y `error` cuyos payloads tengan la forma esperada.
Los eventos desconocidos y los payloads inválidos se descartan devolviendo
ningún evento; no se filtran errores internos al resto de la aplicación.

### `parseSSE(data)`

```ts
parseSSE(data: string): ChatEvent | null
```

Atajo para analizar un frame completo. Devuelve el primer evento válido o
`null` si el texto no contiene un evento válido.

## Estado y reglas de conversación

Archivo: `src/chat/domain/conversation.ts`.

El frontend mantiene dos estructuras separadas:

- `messages`: transcripción visible para el usuario.
- `context`: historial canónico que se envía al API.

### Límites

```ts
HISTORY_MAX_MESSAGES = 20
HISTORY_MAX_MESSAGE_CHARS = 2000
HISTORY_MAX_TOTAL_CHARS = 8000
QUESTION_MAX_CHARS = 1000
```

`DEFAULT_LIMITS` agrupa los tres límites del historial y permite pasarlos como
opción a las funciones que recortan o construyen peticiones.

### `ConversationState`

```ts
type ConversationState = {
  messages: ChatMessage[];
  context: ChatMessage[];
};
```

### `ChatState` y `chatReducer`

Archivo: `src/chat/application/chat-reducer.ts`.

El estado reactivo combina la conversación con el ciclo del turno:

```ts
type ChatState = ConversationState & {
  currentQuestion: string | null;
  currentResponse: string;
  sources: ChatSource[];
  turnState: TurnState;
  error: ChatError | null;
};
```

`chatReducer(state, action)` es una función pura. Gestiona las acciones
`turn-started`, `sources-received`, `token-received`, `turn-completed`,
`turn-failed`, `turn-aborted`, `state-restored` y `conversation-reset`.

Al completar un turno con respuesta, añade el mensaje assistant a `messages` y
el par user/assistant a `context`. Los errores, abortos y turnos sin respuesta
no entran en `context`.

### `useChat(initial?)`

Archivo: `src/chat/hooks/useChat.ts`.

```ts
useChat(initial?: Partial<ConversationState>): ChatController
```

Crea un estado aislado por instancia del widget mediante `useReducer`. Expone
el estado y acciones `startTurn`, `receiveSources`, `receiveToken`,
`completeTurn`, `failTurn`, `abortTurn`, `restore` y `reset`. No realiza fetch
ni consume SSE todavía; `useChatStream` usará esta fachada en la siguiente fase.

### `trimHistory(messages, limits?)`

```ts
trimHistory(
  messages: readonly ChatMessage[],
  limits?: ChatLimits,
): ChatMessage[]
```

Filtra mensajes inválidos, trunca cada contenido al límite individual,
conserva los mensajes más recientes dentro del máximo permitido y elimina los
mensajes antiguos hasta respetar el límite total. Si el primer mensaje
resultante es un `assistant` sin su mensaje de usuario asociado, lo descarta.

Devuelve copias y no modifica el array original.

### `mergeContext(sourcesHistory)`

```ts
mergeContext(sourcesHistory: readonly ChatMessage[]): ChatMessage[]
```

Sustituye el contexto local por el historial que devuelve el servidor en el
evento `sources`. Filtra mensajes inválidos y devuelve copias independientes.

### `buildChatRequest(text, context, limits?)`

```ts
buildChatRequest(
  text: string,
  context: readonly ChatMessage[],
  limits?: ChatLimits,
): {
  question: string;
  history: ChatMessage[];
}
```

Recorta los espacios de la pregunta, valida que no esté vacía y exige un máximo
de 1000 caracteres. Después recorta el contexto con `trimHistory` y devuelve el
body que usará `POST /api/chat`.

Lanza:

- `Error("QUESTION_EMPTY")` si la pregunta está vacía.
- `Error("QUESTION_TOO_LONG")` si supera el límite.

### `saveToSessionStorage(messages, context)`

Archivo: `src/chat/infrastructure/storage.ts`.

```ts
saveToSessionStorage(
  messages: readonly ChatMessage[],
  context: readonly ChatMessage[],
): boolean
```

Guarda los mensajes y el contexto bajo `chatbox:v1`. Filtra mensajes inválidos
antes de serializar. Devuelve `true` si guarda correctamente y `false` si el
storage no existe, está bloqueado o lanza un error.

### `loadFromSessionStorage()`

También vive en `src/chat/infrastructure/storage.ts`.

```ts
loadFromSessionStorage(): ConversationState | null
```

Lee y valida la entrada guardada bajo `chatbox:v1`. Devuelve el estado si tiene
la forma esperada y `null` cuando no existe, el JSON está corrupto, faltan
campos, el storage no está disponible o se produce cualquier error de lectura.

## Tests actuales

Vitest cubre actualmente 20 tests:

- Parser SSE: frames completos, frames partidos, varios eventos, `sources` con
  `history`, errores, payloads inválidos y reset.
- Conversación: límites de historial, mensajes recientes, assistant huérfano,
  mensajes inválidos, validación de preguntas y merge de contexto.
- Reducer: inicio, sources, tokens, finalización, error, aborto, restauración y
  reset.
- Storage: persistencia tolerante y datos corruptos.

Comandos:

```bash
npm test -- --run
npx biome check src
npm run build
```

## Estado pendiente

Todavía no están implementados:

- `useChatStream` con `fetch`, abort, timeout y consumo de SSE.
- Componente `Chatbox` y renderizado de mensajes.
- Renderizado Markdown restringido en una interfaz real.
- Accesibilidad, responsive e integración con Astro.
- Tests del hook, del componente, de accesibilidad y de integración.
