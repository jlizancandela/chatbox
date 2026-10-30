import * as assert from "node:assert";
import { test } from "node:test";
import fastify, { type FastifyError } from "fastify";
import { createRateLimitMiddleware } from "../../src/middleware/rate-limit";

const appWith = async (
	t: { after: (fn: () => unknown) => void },
	config: Parameters<typeof createRateLimitMiddleware>[0]
) => {
	const app = fastify();

	await app.register(createRateLimitMiddleware(config));

	app.setErrorHandler<FastifyError>((error, _request, reply) => {
		if (error.statusCode === 429) {
			return reply.code(429).send({
				error: { code: "RATE_LIMIT_EXCEEDED", message: error.message },
			});
		}

		return reply.code(500).send({ error: { code: "TEST_ERROR" } });
	});

	// La ruta vive dentro del ámbito del middleware: es lo que la protege. El hook
	// está declarado en la instancia, así que la ruta lo llama.
	app.get("/limited", async (request, reply) => {
		const limit = await app.checkRateLimits(request, reply);

		if (limit !== "none") {
			return reply.code(429).send({
				error: { code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded" },
			});
		}

		return { ok: true };
	});

	t.after(() => void app.close());

	return app;
};

test("la ráfaga corta antes que el diario, y ambos cuentan sobre la misma ruta", async (t) => {
	const app = await appWith(t, {
		burstMax: 2,
		burstWindow: "1 minute",
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 100,
		globalWindow: "1 day",
	});

	// Con la ráfaga en 2, la tercera petición tiene que rebotar. Antes del arreglo la
	// ráfaga no se aplicaba y todas pasaban (#143).
	const first = await app.inject({ method: "GET", url: "/limited" });
	const second = await app.inject({ method: "GET", url: "/limited" });
	const third = await app.inject({ method: "GET", url: "/limited" });

	assert.equal(first.statusCode, 200);
	assert.equal(second.statusCode, 200);
	assert.equal(third.statusCode, 429);
});

test("exactamente N peticiones pasan con límite N y la siguiente se rechaza", async (t) => {
	const app = await appWith(t, {
		burstMax: 20,
		burstWindow: "1 minute",
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 100,
		globalWindow: "1 day",
	});

	const statuses: number[] = [];
	for (let attempt = 0; attempt < 25; attempt++) {
		const response = await app.inject({ method: "GET", url: "/limited" });
		statuses.push(response.statusCode);
	}

	const accepted = statuses.filter((status) => status === 200).length;
	const rejected = statuses.filter((status) => status === 429).length;

	// Con la marca de exceso, 20 pasan y 5 rebotan. Con la de exclusión, ninguna.
	assert.equal(accepted, 20);
	assert.equal(rejected, 5);
});

test("la cabecera del límite reporta la ráfaga, no solo el diario", async (t) => {
	const app = await appWith(t, {
		burstMax: 20,
		burstWindow: "1 minute",
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 100,
		globalWindow: "1 day",
	});

	const response = await app.inject({ method: "GET", url: "/limited" });
	const limit = Number(response.headers["x-ratelimit-limit"]);

	// La cabecera decía 100 (el diario) y ahora dice 20 (la ráfaga): la ráfaga es la
	// que corta antes, y es la que el visitante nota.
	assert.equal(limit, 20);
});

test("el límite diario también corta cuando la ráfaga no lo ha hecho", async (t) => {
	const app = await appWith(t, {
		burstMax: 100,
		burstWindow: "1 minute",
		dailyMax: 2,
		dailyWindow: "1 day",
		globalMax: 100,
		globalWindow: "1 day",
	});

	const first = await app.inject({ method: "GET", url: "/limited" });
	const second = await app.inject({ method: "GET", url: "/limited" });
	const third = await app.inject({ method: "GET", url: "/limited" });

	assert.equal(first.statusCode, 200);
	assert.equal(second.statusCode, 200);
	assert.equal(third.statusCode, 429);
});

test("el tope global corta con su propio código, no con el genérico", async (t) => {
	const app = await appWith(t, {
		burstMax: 100,
		burstWindow: "1 minute",
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 2,
		globalWindow: "1 day",
	});

	const first = await app.inject({ method: "GET", url: "/limited" });
	const second = await app.inject({ method: "GET", url: "/limited" });
	const third = await app.inject({ method: "GET", url: "/limited" });

	assert.equal(first.statusCode, 200);
	assert.equal(second.statusCode, 200);
	assert.equal(third.statusCode, 429);
});

test("el tope global cuenta a todos los visitantes, no solo a uno", async (t) => {
	const app = await appWith(t, {
		burstMax: 100,
		burstWindow: "1 minute",
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 2,
		globalWindow: "1 day",
	});

	// La clave del tope global es una constante, no la IP: por eso es global. Sin esto,
	// un atacante con varias IPs agotaría la cuota de todos (#143).
	await app.inject({ method: "GET", url: "/limited", headers: { "x-forwarded-for": "1.1.1.1" } });
	await app.inject({ method: "GET", url: "/limited", headers: { "x-forwarded-for": "2.2.2.2" } });
	const third = await app.inject({
		method: "GET",
		url: "/limited",
		headers: { "x-forwarded-for": "3.3.3.3" },
	});

	assert.equal(third.statusCode, 429);
});

test("rate limit resets after the burst window expires", async (t) => {
	const app = await appWith(t, {
		burstMax: 1,
		burstWindow: 50,
		dailyMax: 100,
		dailyWindow: "1 day",
		globalMax: 100,
		globalWindow: "1 day",
	});

	const first = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(first.statusCode, 200);

	const limited = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(limited.statusCode, 429);
	const limitedBody = limited.json();
	assert.equal(limitedBody.error.code, "RATE_LIMIT_EXCEEDED");
	assert.ok(Number(limited.headers["retry-after"]) >= 1);

	await new Promise((resolve) => setTimeout(resolve, 100));

	const afterReset = await app.inject({ method: "GET", url: "/limited" });
	assert.equal(afterReset.statusCode, 200);
});
