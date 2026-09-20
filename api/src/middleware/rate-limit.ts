import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export const BURST_MAX = 20;
export const BURST_WINDOW = "1 minute";
export const DAILY_MAX = 100;
export const DAILY_WINDOW = "1 day";

const rateLimitMiddleware: FastifyPluginAsync = async (fastify) => {
	await fastify.register(rateLimit, {
		max: BURST_MAX,
		timeWindow: BURST_WINDOW,
	});
	await fastify.register(rateLimit, {
		max: DAILY_MAX,
		timeWindow: DAILY_WINDOW,
	});
};

export default fp(rateLimitMiddleware);
