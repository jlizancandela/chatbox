# Spec: estado local del chat con reducer

## Objetivo

Integrar el estado de conversación con Preact mediante un hook local y un
reducer puro, sin introducir un store global, Context ni una dependencia
externa de estado.

## Alcance

- Mantener las reglas puras de `chat/domain/conversation.ts`.
- Crear `chat/application/chat-reducer.ts` con el estado y las transiciones del
  turno.
- Crear `chat/hooks/useChat.ts` como fachada reactiva aislada por instancia.
- Mover la persistencia a `chat/infrastructure/storage.ts`.
- Cubrir reducer y storage con Vitest.
- Preparar la integración futura con `useChatStream`, sin implementar fetch ni
  streaming en esta unidad.

## Estado y transiciones

El estado incluye `messages`, `context`, `currentQuestion`, `currentResponse`,
`sources`, `turnState` y `error`. El reducer gestiona inicio, sources, tokens,
finalización, error, aborto, restauración y reset.

Un turno solo se añade a `context` cuando termina con una respuesta completa.
Los errores, abortos y respuestas sin tokens conservan el estado visible, pero
no entran en el contexto canónico.

## Criterios de aceptación

- `chatReducer` es puro y no depende del DOM.
- `useChat` crea un estado independiente por instancia.
- `conversation.ts` conserva únicamente reglas de dominio.
- `storage.ts` absorbe errores de `sessionStorage` y valida datos cargados.
- Los tests cubren las transiciones y la persistencia.
- Biome, Vitest y build pasan.

## Fuera de alcance

- `useChatStream`.
- `Chatbox`, Composer y MessageList.
- Context, Zustand, Jotai y Nanostores.
- AbortController, timeout y agrupación de tokens.
