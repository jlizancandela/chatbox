import fastifyPostgres from "@fastify/postgres";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const db: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyPostgres, {
		connectionString: process.env.DATABASE_URL,
	});
};

export default fp(db);
