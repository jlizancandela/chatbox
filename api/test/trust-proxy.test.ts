import assert from "node:assert";
import { test } from "node:test";
import fastify from "fastify";
import { createRateLimitMiddleware } from "../src/middleware/rate-limit";

/**
 * La cuota por IP solo significa algo si la IP que se usa es la del visitante.
 *
 * Con el proxy delante, la IP que ve la aplicación es la del proxy: sin `trustProxy`,
 * todos los visitantes comparten una clave y el límite por IP deja de distinguir a
 * nadie (#143).
 */

const appTrusting = async (
	t: { after: (fn: () => unknown) => void },
	trustProxy: string | boolean
) => {
	const app = fastify({ trustProxy });

	await app.register(createRateLimitMiddleware());

	const keys: string[] = [];

	app.get("/who", async (request) => {
		keys.push(request.ip);
		return { ip: request.ip };
	});

	t.after(() => void app.close());

	return { app, keys };
};

test("dos visitantes detrás del mismo proxy reciben IPs distintas si se confía en él", async (t) => {
	// El rango de confianza es el del **proxy**: es su dirección la que se comprueba
	// antes de creerse la cabecera. En la prueba el proxy es `127.0.0.1`, que es de
	// donde sale `inject`.
	const { app } = await appTrusting(t, "127.0.0.1");

	const first = await app.inject({
		method: "GET",
		url: "/who",
		headers: { "x-forwarded-for": "203.0.113.7" },
	});
	const second = await app.inject({
		method: "GET",
		url: "/who",
		headers: { "x-forwarded-for": "203.0.113.8" },
	});

	// Con `trustProxy` apuntando al proxy, la cabecera reescrita por el proxy es la que
	// cuenta: dos visitantes distintos son dos claves de cuota distintas.
	assert.notStrictEqual(first.json().ip, second.json().ip);
	assert.strictEqual(first.json().ip, "203.0.113.7");
	assert.strictEqual(second.json().ip, "203.0.113.8");
});

test("una cabecera de reenvío de un cliente que no es el proxy no se cree", async (t) => {
	// Con el rango del proxy real (`10.0.1.0/24`), una petición que llega de otra
	// parte no puede falsificar su IP. Por eso `trustProxy` se configura con la IP o el
	// rango del proxy, y no con un contador de saltos (#143).
	const { app } = await appTrusting(t, "10.0.1.0/24");

	const response = await app.inject({
		method: "GET",
		url: "/who",
		headers: { "x-forwarded-for": "203.0.113.7" },
	});

	assert.strictEqual(response.json().ip, "127.0.0.1");
});

test("sin confiar en el proxy, todos los visitantes comparten la misma IP", async (t) => {
	const { app } = await appTrusting(t, false);

	const first = await app.inject({
		method: "GET",
		url: "/who",
		headers: { "x-forwarded-for": "203.0.113.7" },
	});
	const second = await app.inject({
		method: "GET",
		url: "/who",
		headers: { "x-forwarded-for": "203.0.113.8" },
	});

	// Sin `trustProxy` la cabecera se ignora: es lo que pasa hoy, y por eso el límite
	// por IP no protege de nada detrás del proxy.
	assert.strictEqual(first.json().ip, second.json().ip);
});
