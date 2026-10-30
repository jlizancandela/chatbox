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
- `frontend/` — el widget (Preact + Vite). Un spec por RF en `frontend/.specs/`; el texto de interfaz se centraliza en `frontend/src/strings.es.ts` (RF-F62, migración en curso).
  **Antes de tocar `frontend/`, lee `frontend/AGENTS.md`**: tiene la arquitectura de `src/`, el
  reparto de tests, la verificación mínima y las trampas del toolchain (TypeScript es el port
  nativo, sin API de parser). No se carga solo, así que este puntero es la única vía.

## Layout del código (api/src)
Cargado automáticamente por @fastify/autoload desde `app.ts`:
- `dependencies.ts` — el punto **único** de inyección de los proveedores externos al
  construir la aplicación (base de datos, generación, embeddings). Los plugins los
  reciben en las opciones de construcción y los decoran en la instancia; en producción
  no se pasa nada y se usan los reales. Es el seam que usan los tests para correr sin
  red ni credenciales. Ver `docs/decisions/012-seam-de-proveedores-y-suite-hermetica.md`.
- `plugins/` — db (pg), groq, embedding, errors (handler JSON), schemas, sensible, support
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
GROQ_API_KEY, GROQ_MODEL_DEFAULT, CORS_ORIGIN. Compose: POSTGRES_USER/PASSWORD/DB.

## Estado del proyecto
Ver `api/TODO.md` para el estado actual del MVP.

## Regla de trabajo

El flujo (issue → plan → aprobación → implementación → verificación → commit → PR → merge)
se define una vez en `docs/decisions/001-development-workflow.md`. Aquí solo lo específico
de este monorepo:

- Presentar un plan con alcance, archivos afectados, riesgos y verificaciones antes de
  implementar, y no modificar archivos hasta recibir aprobación explícita.
- Tras la aprobación, ejecutar el plan entero sin volver a pedir permiso archivo a archivo.
- Verificar con las comprobaciones del proyecto afectado: `api/` usa `pnpm test`; `frontend/`
  usa `npm run verify` (ver `frontend/AGENTS.md`).

## Agent skills

### Issue tracker

Issues y specs viven en GitHub Issues; se usa `gh` para las operaciones. Consulta `docs/agents/issue-tracker.md`.

`gh issue view <n>` desnudo falla en este repo: el proyecto clásico está deprecado. Leer siempre con campos explícitos:

```bash
gh issue view <n> --repo jlizancandela/chatbox --json number,title,body,labels,comments
```

### Domain docs

Repositorio single-context: `GLOSSARY.md` en la raíz y ADRs bajo `docs/decisions/`. Consulta `docs/agents/domain.md`.
