# AGENTS.md

## Descripción
Chatbox es un MVP de RAG vectorial: ingiere documentos, almacena sus embeddings
en PostgreSQL con pgvector, recupera contexto por similitud y genera respuestas
fundamentadas con Groq.

## Stack
- API: Fastify 5 + TypeScript estricto (bootstrapped con Fastify-CLI)
- Datos: PostgreSQL + extensión pgvector
- Embeddings: Google Gemini `gemini-embedding-001` (768 dimensiones)
- Generación: Groq (`openai/gpt-oss-20b`)
- Chunking: `@langchain/textsplitters`
- Migraciones: node-pg-migrate
- Formatter/linter: Biome · Package manager: pnpm

## Estructura
- `api/` — el backend (única app). Todo el código vive aquí.
- `docs/` — plan de implementación KISS (`plan-implementacion-api-chatbox.md`)
- `api/TODO.md` — estado real del MVP (espejo del plan, con checkboxes)
- `.agents/`, `.claude/`, `.atl/` — skills y tooling de agentes (no tocar app)

## Layout del código (api/src)
Cargado automáticamente por @fastify/autoload desde `app.ts`:
- `plugins/` — db (pg), groq, errors (handler JSON), schemas, sensible, support
- `routes/` — `root.ts` (`GET /`, `GET /health`) y `routes/api/index.ts` (`POST /chat`)
- `services/` — lógica de negocio (`documents`, `documentEmbeddings`)
- `repositories/` — SQL puro (`documents`)
- `schemas/` — schemas JSON compartidos
- `cli/ingest.ts` — comando de ingesta

## Esquema de BD
`documents` (fuente original) 1—N `document_chunks` (fragmentos con embedding).
Ver `api/database/erd.md`. Migraciones en `api/database/migrations/`.

## Comandos (en api/)
- `pnpm dev` — arranca en modo dev (puerto 7000)
- `pnpm start` — producción
- `pnpm test` — build + tests (node --test + ts-node + c8)
- `pnpm db:migrate` — aplica migraciones (requiere DATABASE_URL)

## Variables de entorno (api/.env, gitignored)
DATABASE_URL, GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL, GEMINI_VECTOR_DIMENSION,
GROQ_API_KEY, GROQ_MODEL_DEFAULT. Compose: POSTGRES_USER/PASSWORD/DB.

## Estado del proyecto
Ver `api/TODO.md` para el estado actual del MVP.
