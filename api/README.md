# Chatbox API

## Database

Start PostgreSQL with pgvector and apply all pending migrations:

```bash
docker compose up -d db
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatbox pnpm db:migrate
```

Migrations live in `database/migrations` and are applied in filename order by
`node-pg-migrate`. Applied migrations are recorded in `pgmigrations`.

`DATABASE_URL` must be available in the environment when running the command.

The migration from the old `vector(384)` column removes incompatible stored
embeddings. Documents must then be ingested again to generate `vector(768)`
embeddings.

## Available Scripts

In the project directory, you can run:

### `pnpm dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `pnpm start`

For production mode

### `pnpm test`

Run the test cases.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
