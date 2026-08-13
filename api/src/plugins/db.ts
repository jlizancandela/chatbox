import fastifyPostgres from "@fastify/postgres";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const db: FastifyPluginAsync = async (fastify) => {
	const databaseUrl = process.env.DATABASE_URL?.trim();

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required");
	}

	await fastify.register(fastifyPostgres, {
		connectionString: databaseUrl,
	});
};

export default fp(db);
