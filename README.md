# Chatbox

[![API CI](https://github.com/jlizancandela/chatbox/actions/workflows/api.yml/badge.svg?branch=main)](https://github.com/jlizancandela/chatbox/actions/workflows/api.yml) [![Frontend CI](https://github.com/jlizancandela/chatbox/actions/workflows/frontend.yml/badge.svg?branch=main)](https://github.com/jlizancandela/chatbox/actions/workflows/frontend.yml) [![License](https://img.shields.io/github/license/jlizancandela/chatbox)](LICENSE) [![Widget tag](https://img.shields.io/github/v/tag/jlizancandela/chatbox?label=widget)](https://github.com/jlizancandela/chatbox/tags) [![Docker pulls](https://img.shields.io/docker/pulls/jlizancandela/api_chatbox?label=api%20image)](https://hub.docker.com/r/jlizancandela/api_chatbox)

![Fastify](https://img.shields.io/badge/Fastify-000000?logo=fastify&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white) ![Groq](https://img.shields.io/badge/Groq-F55036?logo=groq&logoColor=white) ![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

Widget de chat que responde **solo** con lo que hay en un corpus documental. Ingesta los
documentos, los convierte en vectores y responde citando de dónde sale cada respuesta. Si
no hay contexto suficiente, no llama al modelo generativo y lo dice.

Es el widget que usa [jorgelizancandela.com](https://jorgelizancandela.com), y se instala
**directo desde este repositorio**: sin registro de paquetes, sin cuenta y sin token.

```bash
npm i github:jlizancandela/chatbox#v0.2.0 preact
```

## Cómo funciona

```text
documentos ──► chunking ──► EmbeddingGemma (768 dims, en proceso)
                                     │
                                     ▼
                           PostgreSQL + pgvector
                                     │
pregunta ──► embedding ──► similitud coseno ──► Groq ──► SSE al navegador
```

La respuesta viaja en Server-Sent Events: primero los `sources` recuperados, después los
`token` según se generan y al final `done`. El servidor **no** persiste el historial: el
cliente lo envía en cada petición y lo recorta a los límites acordados con el API.

## Estructura

| Ruta | Qué es |
|---|---|
| `api/` | Backend Fastify 5: ingesta, recuperación vectorial y generación. |
| `frontend/` | Widget Preact + Vite. Es lo que se publica como dependencia. |
| `docs/` | Plan de implementación, specs y ADRs. |
| `GLOSSARY.md` | Vocabulario del dominio. |
| `AGENTS.md` | Reglas de trabajo del repositorio. |

## Arranque rápido

### La API

Necesita Docker, pnpm y una clave de Groq.

```bash
cd api
cp .env.example .env          # rellena DATABASE_URL, GROQ_API_KEY y CORS_ORIGIN
pnpm install
docker compose up -d db
set -a && source .env && set +a
pnpm db:migrate
pnpm embeddings:fetch         # ~200 MB de pesos, una sola vez
pnpm ingest curriculum-jorge-lizan.md
pnpm dev
```

```bash
curl http://localhost:7000/health
```

### El widget

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

La guía completa de cada parte —variables, ingesta, imagen Docker, despliegue, contrato
de la API, props del widget— vive en su README:

- [`api/README.md`](api/README.md)
- [`frontend/README.md`](frontend/README.md)

## Documentación

- [`GLOSSARY.md`](GLOSSARY.md) — términos del dominio.
- [`docs/decisions/`](docs/decisions/) — ADRs, con el porqué de cada decisión.
- [`docs/plan-implementacion-api-chatbox.md`](docs/plan-implementacion-api-chatbox.md) — plan del MVP.
- [`api/TODO.md`](api/TODO.md) y [`frontend/TODO.md`](frontend/TODO.md) — estado real.

## Licencia

MIT. Ver [`LICENSE`](LICENSE).
