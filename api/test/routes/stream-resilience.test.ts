import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fp from "fastify-plugin";
import app from "../../src/app";
import { toSSE } from "../../src/routes/api";
import type { ChatEvent } from "../../src/services/chat";
import { parseSSE, testDependencies } from "../helper";

/**
 * Un origen de eventos que muere después del primer frame. No hay proveedor de mentira que
 * produzca esto: el servicio ya convierte sus fallos en un evento de error. Es la garantía
 * del pipeline la que se afirma aquí — la que evita que un fallo del transporte acabe en el
 * manejador de errores con la respuesta ya empezada (#144).
 */
async function* failsAfterTheFirstFrame(): AsyncIterable<ChatEvent> {
	yield { type: "sources", sources: [], history: [] };
	throw new Error("the source died after the first frame");
}

test("the SSE pipeline turns a failing source into a closing error frame", async () => {
	const frames: string[] = [];

	for await (const frame of toSSE(failsAfterTheFirstFrame())) {
		frames.push(frame);
	}

	const parsed = parseSSE(frames.join(""));

	assert.deepStrictEqual(
		parsed.map((frame) => frame.event),
		["sources", "error"],
	);
	assert.deepStrictEqual(parsed[1].data, {
		code: "GENERATION_FAILED",
		message: "An unexpected error occurred while generating the answer",
	});
});

test("a response that fails after its headers closes cleanly instead of answering JSON", async (t) => {
	// El fallo original, tal cual: una respuesta que ya emitió cabeceras y parte del cuerpo
	// recibe un error. El manejador intentaba `send` con un cuerpo JSON, `writeHead` lanzaba
	// ERR_HTTP_HEADERS_SENT y el proceso se iba por delante. Aquí se afirma lo observable:
	// el cliente recibe lo que ya se escribió, la conexión termina, no aparece un cuerpo JSON
	// y nada se lanza fuera de la petición.
	const crashes: unknown[] = [];
	const capture = (error: unknown): void => {
		crashes.push(error);
	};
	process.on("uncaughtException", capture);
	t.after(() => process.off("uncaughtException", capture));

	const instance = Fastify({ logger: false });
	await instance.register(fp(app), { dependencies: testDependencies() });

	// Un plugin posterior hereda el manejador de errores ya registrado por la aplicación; una
	// ruta añadida a pelo antes de arrancar capturaría el manejador por defecto.
	await instance.register(async (scope) => {
		scope.get("/starts-then-throws", async (_request, reply) => {
			reply.raw.writeHead(200, { "content-type": "text/event-stream" });
			reply.raw.write('event: sources\ndata: {"sources":[],"history":[]}\n\n');
			throw new Error("boom after the headers were sent");
		});
	});

	await instance.ready();
	t.after(() => instance.close());
	await instance.listen({ port: 0, host: "127.0.0.1" });

	const { port } = instance.server.address() as { port: number };
	const res = await fetch(`http://127.0.0.1:${port}/starts-then-throws`, {
		// Sin el arreglo la petición no termina: el proceso muere con la respuesta abierta.
		signal: AbortSignal.timeout(2000),
		// Sin esto, undici deja la conexión viva en su pool y el cierre del servidor espera.
		headers: { connection: "close" },
	});

	assert.equal(res.status, 200);
	assert.equal(res.headers.get("content-type"), "text/event-stream");

	const body = await res.text();

	assert.deepStrictEqual(crashes, []);
	assert.equal(body, 'event: sources\ndata: {"sources":[],"history":[]}\n\n');
	assert.equal(body.includes("INTERNAL_ERROR"), false);
});
