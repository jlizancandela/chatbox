import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export const BURST_MAX = 20;
export const BURST_WINDOW = "1 minute";
export const DAILY_MAX = 100;
export const DAILY_WINDOW = "1 day";

export type RateLimitConfig = {
	burstMax: number;
	burstWindow: number | string;
	dailyMax: number;
	dailyWindow: number | string;
};

export const defaultRateLimitConfig: RateLimitConfig = {
	burstMax: BURST_MAX,
	burstWindow: BURST_WINDOW,
	dailyMax: DAILY_MAX,
	dailyWindow: DAILY_WINDOW,
};

export const createRateLimitMiddleware = (
	config: RateLimitConfig = defaultRateLimitConfig,
): FastifyPluginAsync =>
	fp(async (fastify) => {
		await fastify.register(rateLimit, {
			max: config.burstMax,
			timeWindow: config.burstWindow,
		});
		await fastify.register(rateLimit, {
			max: config.dailyMax,
			timeWindow: config.dailyWindow,
		});
	});

const rateLimitMiddleware: FastifyPluginAsync = createRateLimitMiddleware();

export default rateLimitMiddleware;
