# Frontend Chatbox

Frontend del widget de chat RAG de Chatbox. Está construido con Preact, Vite y
TypeScript, y consumirá `POST /api/chat` mediante Server-Sent Events.

## Estado actual

La implementación actual incluye:

- Tipos del contrato del chat en `src/chat/types.ts`.
- Parser SSE en `src/chat/infrastructure/sse.ts`.
- Reglas puras de conversación en `src/chat/domain/conversation.ts`.
- Estado local con `useChat()` y `chatReducer`.
- Persistencia temporal en `src/chat/infrastructure/storage.ts`.
- Hook `useChatStream` para fetch, SSE, abort y timeout.
- Tests unitarios con Vitest en `test/unit/`, separados del código productivo.

La documentación técnica de estos módulos está en
[`docs/chat-implementation.md`](docs/chat-implementation.md).

El componente visual todavía está pendiente. Consulta
[`TODO.md`](TODO.md) para el estado completo.

## Comandos

Ejecutar desde `frontend/`:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run format
npm test -- --run
npm run test:watch
```

Los tests se organizan por tipo bajo `test/`: `unit/`, `component/`,
`integration/` y `accessibility/`. Actualmente solo existe `test/unit/`.

## Integración prevista

El componente se integrará posteriormente como una isla Preact en Astro. El
frontend no ingiere documentos, no genera embeddings y no persiste datos en el
servidor.
