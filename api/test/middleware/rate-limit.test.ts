import fastify, { type FastifyError } from "fastify";
import { test } from "node:test";
import * as assert from "node:assert";
import { createRateLimitMiddleware } from "../../src/middleware/rate-limit";

test("rate limit resets after the burst window expires", async (t) => {
	const app = fastify();

	await app.register(
		createRateLimitMiddleware({
			burstMax: 1,
			burstWindow: 50,
			dailyMax: 100,
			dailyWindow: "1 day",
		}),
	);

	app.setErrorHandler<FastifyError>((error, _request, reply) => {
		if (error.statusCode === 429) {
			return reply.code(429).send({
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: error.message,
				},
			});
		}

		return reply.code(500).send({ error: { code: "TEST_ERROR" } });
	});

	app.get("/limited", async () => ({ ok: true }));
	t.after(() => void app.close());

	const first = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(first.statusCode, 200);

	const limited = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(limited.statusCode, 429);
	const limitedBody = limited.json();
	assert.equal(limitedBody.error.code, "RATE_LIMIT_EXCEEDED");
	assert.match(
		limitedBody.error.message,
		/^Rate limit exceeded, retry in \d+ second/,
	);
	assert.ok(Number(limited.headers["retry-after"]) >= 1);

	await new Promise((resolve) => setTimeout(resolve, 100));

	const afterReset = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(afterReset.statusCode, 200);
});
