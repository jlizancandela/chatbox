import fastifyPostgres from "@fastify/postgres";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppOptions } from "../dependencies";

/**
 * La base de datos.
 *
 * Con `dependencies.pg` se decora la instancia con esa base y no se abre ninguna
 * conexión: es lo que usan los tests para no depender de PostgreSQL. Sin ella, hace
 * falta `DATABASE_URL` y se registra `@fastify/postgres` como siempre.
 */
const db: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
	const injected = opts.dependencies?.pg;

	if (injected) {
		fastify.decorate("pg", injected);
		return;
	}

	const databaseUrl = process.env.DATABASE_URL?.trim();

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required");
	}

	await fastify.register(fastifyPostgres, {
		connectionString: databaseUrl,
	});
};

export default fp(db);
