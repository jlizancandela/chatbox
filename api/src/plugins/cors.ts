import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const corsPlugin: FastifyPluginAsync = async (fastify) => {
	const origin = process.env.CORS_ORIGIN?.trim();

	if (!origin) {
		throw new Error("CORS_ORIGIN must be configured");
	}

	await fastify.register(cors, { origin });
};

export default fp(corsPlugin);
