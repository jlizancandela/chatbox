# Plan: relocate SSE infrastructure

## Scope

- Move the chat SSE adapter from `src/sse.ts` to `src/chat/infrastructure/sse.ts`.
- Keep the shared contract types in `src/types.ts`.
- Update the TODO path and verify the old location is no longer referenced.

## Verification

- Check imports and references with ripgrep.
- Run `npx biome check src`.
- Run `npm run build`.
