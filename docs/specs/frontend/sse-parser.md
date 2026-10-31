# Plan: frontend SSE parser

## Scope

- Add `eventsource-parser` as the SSE framing dependency.
- Create `src/chat/infrastructure/sse.ts` as the adapter from generic SSE messages to the frontend chat event types.
- Keep stream transport, abort handling, timeouts, and UI state outside this module.

## Design

- `parseSSE(data: string)` parses one complete frame and returns a typed event or `null`.
- `createSSEParser()` keeps parser state across chunks and returns all complete typed events from each `feed()` call.
- `sources`, `token`, `done`, and `error` payloads are JSON-decoded and structurally validated.

## Verification

- `npx biome check src/chat/infrastructure/sse.ts`
- `npm run build`
