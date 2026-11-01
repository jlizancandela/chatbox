import * as assert from "node:assert";
import { test } from "node:test";
import Fastify, { type FastifyServerOptions } from "fastify";
import errors from "../../src/plugins/errors";
import { build, testDependencies } from "../helper";

/**
 * El contrato de errores públicos.
 *
 * Un solo envelope `{error:{code,message}}` para todo lo que la API devuelve como
 * error, incluido lo que genera el framework y no un handler: el 404 de una ruta que
 * no existe y el 415 de un `Content-Type` que no sabe leer (#176).
 */

const envelope = (code: string, message: string) => ({ error: { code, message } });

test("una ruta inexistente responde el envelope, no la forma de Fastify", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({ url: "/no-existe" });

	assert.equal(res.statusCode, 404);
	assert.deepStrictEqual(res.json(), envelope("NOT_FOUND", "Resource not found"));
});

test("una ruta inexistente bajo el prefijo también", async (t) => {
	const app = await build(t, testDependencies());

	// El prefijo lo pone el autoload: si el not-found handler quedara encapsulado en la
	// raíz, `/api/...` volvería a la forma por defecto.
	const res = await app.inject({ url: "/api/no-existe" });

	assert.equal(res.statusCode, 404);
	assert.deepStrictEqual(res.json(), envelope("NOT_FOUND", "Resource not found"));
});

test("un Content-Type no soportado responde 415, no 500", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		payload: "question=hola",
	});

	assert.equal(res.statusCode, 415);
	assert.deepStrictEqual(res.json(), envelope("UNSUPPORTED_MEDIA_TYPE", "Unsupported media type"));
});

/** Una app mínima con el plugin de errores y una ruta que falla. */
const buildFailing = async (
	t: { after: (fn: () => unknown) => void },
	options: FastifyServerOptions = {}
) => {
	const app = Fastify(options);

	await app.register(errors);

	app.get("/falla", async () => {
		throw new Error("causa interna que no debe salir en la respuesta");
	});

	t.after(() => app.close());

	return app;
};

test("un error no manejado responde 500 sin filtrar su mensaje", async (t) => {
	const app = await buildFailing(t);

	const res = await app.inject({ url: "/falla" });

	assert.equal(res.statusCode, 500);
	assert.deepStrictEqual(res.json(), envelope("INTERNAL_ERROR", "An unexpected error occurred"));
});

test("un error no manejado queda registrado con su causa y la petición", async (t) => {
	const lines: string[] = [];
	const app = await buildFailing(t, {
		logger: { level: "error", stream: { write: (line: string) => void lines.push(line) } },
	});

	await app.inject({ url: "/falla" });

	const log = lines.join("");

	// Fastify no escribe esta línea cuando el handler es propio: si el handler deja de
	// registrarla, aquí no hay nada y el fallo llega a producción sin causa (#176).
	assert.match(log, /causa interna que no debe salir en la respuesta/);
	assert.match(log, /"requestId"/);
});
