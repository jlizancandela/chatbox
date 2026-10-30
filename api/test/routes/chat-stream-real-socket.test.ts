import * as assert from "node:assert";
import { test } from "node:test";
import {
	build,
	CHUNK,
	fakeGroq,
	fakePg,
	parseSSE,
	type TestContext,
	testDependencies,
} from "../helper";

/**
 * Levanta la aplicación sobre un puerto real. `inject()` no sirve aquí: no pasa por
 * el socket, y el bug vive exactamente en cómo el socket cierra el request mientras
 * la respuesta sigue abierta (#93). Toda la suite de rutas usa `inject` y por eso no
 * lo veía.
 *
 * Lo que se sustituye son los proveedores —base de datos, embeddings y generación—,
 * no el transporte: el socket es de verdad.
 */
async function serve(t: TestContext, tokens: string[] = ["Hola", " ", "mundo"]) {
	const groq = fakeGroq(tokens, { delayMs: 100 });

	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: groq.client,
		})
	);

	await app.listen({ port: 0, host: "127.0.0.1" });

	const { port } = app.server.address() as { port: number };
	return { url: `http://127.0.0.1:${port}`, signal: groq.signal };
}

test("chat stream completes over a real socket instead of stopping after sources", async (t) => {
	const { url } = await serve(t);

	const res = await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ question: "¿Qué hace Jorge?" }),
	});

	assert.equal(res.status, 200);
	assert.equal(res.headers.get("content-type"), "text/event-stream");

	const frames = parseSSE(await res.text());
	const events = frames.map((frame) => frame.event);

	assert.deepStrictEqual(events, ["sources", "token", "token", "token", "done"]);

	const answer = frames
		.filter((frame) => frame.event === "token")
		.map((frame) => (frame.data as { token: string }).token)
		.join("");
	assert.equal(answer, "Hola mundo");
});

test("chat stream aborts the model request when the client goes away", async (t) => {
	// Quitar la cancelación por descuido parece inofensivo: cuando el cliente se va, el
	// stream de Node se corta igual. Lo que se pierde es el otro efecto — que la petición al
	// proveedor se cancele—, y eso es lo que este test afirma: la señal que llega al modelo
	// queda abortada, de modo que no se sigue generando (y cobrando) hacia un cliente que ya
	// no está.
	//
	// Se afirma sobre la señal, no sobre lo que recibe el cliente, porque eso es lo único que
	// distingue este caso de "no hay cancelación": un stream abandonado tampoco entrega `done`.
	const { url, signal } = await serve(t, ["a", "b", "c", "d", "e", "f", "g", "h"]);

	const controller = new AbortController();
	const res = await fetch(`${url}/api/chat`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ question: "¿Qué hace Jorge?" }),
		signal: controller.signal,
	});

	const reader = res.body!.getReader();
	const decoder = new TextDecoder();

	for (;;) {
		let chunk: Awaited<ReturnType<typeof reader.read>>;
		try {
			chunk = await reader.read();
		} catch {
			// El propio abort del cliente corta la lectura. Es el camino normal de este test.
			break;
		}
		if (chunk.done) break;
		if (decoder.decode(chunk.value, { stream: true }).includes("event: token")) {
			controller.abort();
		}
	}

	// El cierre del socket es asíncrono: hay que dar margen antes de mirar la señal.
	await new Promise((resolve) => setTimeout(resolve, 200));

	const modelSignal = signal();
	assert.ok(modelSignal, "el modelo debería recibir una señal de cancelación");
	assert.equal(
		modelSignal.aborted,
		true,
		"al irse el cliente, la petición al modelo debería quedar abortada"
	);
});
