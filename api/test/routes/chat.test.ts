import * as assert from "node:assert";
import { request } from "node:http";
import { test } from "node:test";
import { BURST_MAX } from "../../src/middleware/rate-limit";
import { CHAT_BODY_LIMIT_BYTES } from "../../src/schemas/chat";
import { build, CHUNK, fakeGroq, fakePg, parseSSE, testDependencies } from "../helper";

test("chat stream returns empty sources and done when no chunk matches", async (t) => {
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([]),
			groqClient: fakeGroq(["No debería llegar aquí"]).client,
		})
	);

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Cómo se prepara una paella valenciana?",
		},
	});

	assert.equal(res.statusCode, 200);
	assert.equal(res.headers["content-type"], "text/event-stream");

	const frames = parseSSE(res.payload);
	assert.equal(frames.length, 2);
	assert.equal(frames[0].event, "sources");
	assert.deepStrictEqual(frames[0].data, { sources: [], history: [] });
	assert.equal(frames[1].event, "done");
	assert.deepStrictEqual(frames[1].data, {});
});

test("chat stream returns sources, tokens and done for a relevant question", async (t) => {
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: fakeGroq(["Jorge", " ", "usa", " React"]).client,
		})
	);

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?",
		},
	});

	assert.equal(res.statusCode, 200);
	assert.equal(res.headers["content-type"], "text/event-stream");

	const frames = parseSSE(res.payload);

	assert.ok(frames.length >= 3, `expected at least 3 frames, got ${frames.length}`);

	const [first] = frames;
	assert.equal(first.event, "sources");
	const sources = (first.data as { sources: Array<unknown> }).sources;
	assert.ok(Array.isArray(sources));
	assert.ok(sources.length > 0, "expected at least one source");
	assert.ok(sources.length <= 5);

	for (const source of sources as Array<{
		documentId: string;
		chunkIndex: number;
		title: string;
		content: string;
		distance: number;
	}>) {
		assert.equal(typeof source.documentId, "string");
		assert.equal(typeof source.chunkIndex, "number");
		assert.equal(typeof source.title, "string");
		assert.equal(typeof source.content, "string");
		assert.equal(typeof source.distance, "number");
		assert.ok(source.distance < 0.5);
	}

	const tokenFrames = frames.filter((frame) => frame.event === "token");
	assert.ok(tokenFrames.length > 0, "expected at least one token frame");
	for (const frame of tokenFrames) {
		const token = (frame.data as { token: string }).token;
		assert.equal(typeof token, "string");
		assert.ok(token.length > 0);
	}

	const last = frames[frames.length - 1];
	assert.equal(last.event, "done");
	assert.deepStrictEqual(last.data, {});
});

test("chat stream emits a generic error when Groq fails after sources", async (t) => {
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: fakeGroq([], {
				failWith: new Error("provider secret that must not leak"),
			}).client,
		})
	);

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?",
		},
	});

	assert.equal(res.statusCode, 200);
	assert.equal(res.headers["content-type"], "text/event-stream");

	const frames = parseSSE(res.payload);
	assert.equal(frames[0].event, "sources");
	assert.equal(frames[frames.length - 1].event, "error");
	assert.deepStrictEqual(frames[frames.length - 1].data, {
		code: "GENERATION_FAILED",
		message: "An unexpected error occurred while generating the answer",
	});
	assert.equal(res.payload.includes("provider secret that must not leak"), false);
});

test("chat stream classifies an exhausted quota and keeps the retry hint", async (t) => {
	// La cuota se reconoce por el estado del proveedor, no por el texto: 429. El visitante
	// necesita un código propio porque la respuesta correcta es "vuelve más tarde", no
	// "algo se rompió" (#144).
	const quota = Object.assign(new Error("429 provider detail that must not leak"), {
		status: 429,
		headers: new Headers({ "retry-after": "42" }),
	});
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: fakeGroq([], { failWith: quota }).client,
		})
	);

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?",
		},
	});

	const frames = parseSSE(res.payload);
	assert.equal(frames[0].event, "sources");
	assert.equal(frames[frames.length - 1].event, "error");
	assert.deepStrictEqual(frames[frames.length - 1].data, {
		code: "QUOTA_EXHAUSTED",
		message: "An unexpected error occurred while generating the answer",
		retryAfterSeconds: 42,
	});
	assert.equal(res.payload.includes("provider detail that must not leak"), false);
});

test("chat stream leaves the retry hint out when the provider gives none", async (t) => {
	const quota = Object.assign(new Error("quota"), { status: 429 });
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: fakeGroq([], { failWith: quota }).client,
		})
	);

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?",
		},
	});

	const frames = parseSSE(res.payload);
	assert.deepStrictEqual(frames[frames.length - 1].data, {
		code: "QUOTA_EXHAUSTED",
		message: "An unexpected error occurred while generating the answer",
	});
});

test("chat stream aborts Groq when the HTTP client disconnects", async (t) => {
	// El stream se deja largo a propósito: si el doble terminase al instante, la generación
	// habría acabado antes de que el cliente se fuese y el abort no tendría nada que cortar.
	const groq = fakeGroq(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"], {
		delayMs: 100,
	});
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([CHUNK]),
			groqClient: groq.client,
		})
	);

	await app.listen({ host: "127.0.0.1", port: 0 });
	const address = app.server.address();
	assert.ok(address && typeof address === "object");

	const clientRequest = request({
		host: "127.0.0.1",
		port: address.port,
		method: "POST",
		path: "/api/chat",
		headers: { "content-type": "application/json" },
	});

	const sourcesReceived = new Promise<void>((resolve, reject) => {
		clientRequest.once("response", (response) => {
			response.once("data", () => resolve());
			response.once("error", reject);
		});
		clientRequest.once("error", (error) => {
			if ((error as NodeJS.ErrnoException).code !== "ECONNRESET") reject(error);
		});
	});

	clientRequest.end(
		JSON.stringify({
			question: "¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?",
		})
	);

	await sourcesReceived;
	clientRequest.destroy();

	await new Promise<void>((resolve, reject) => {
		const deadline = setTimeout(() => reject(new Error("Groq signal was not aborted")), 1000);
		const check = () => {
			if (groq.signal()?.aborted) {
				clearTimeout(deadline);
				resolve();
			} else {
				setImmediate(check);
			}
		};
		check();
	});
});

test("chat route rejects a whitespace-only question", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "   ",
		},
	});

	assert.equal(res.statusCode, 400);
	assert.deepStrictEqual(res.json(), {
		error: {
			code: "INVALID_QUESTION",
			message: "Question must be between 1 and 1000 characters long.",
		},
	});
});

test("chat route rejects a question longer than 1000 characters", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "a".repeat(1001),
		},
	});

	assert.equal(res.statusCode, 400);
	assert.deepStrictEqual(res.json(), {
		error: {
			code: "INVALID_QUESTION",
			message: "Question must be between 1 and 1000 characters long.",
		},
	});
});

for (const [name, payload] of [
	["missing body", undefined],
	["missing question", {}],
	["empty question", { question: "" }],
] as const) {
	test(`chat route rejects ${name}`, async (t) => {
		const app = await build(t, testDependencies());

		const res = await app.inject({
			method: "POST",
			url: "/api/chat",
			...(payload === undefined ? {} : { payload }),
		});

		assert.equal(res.statusCode, 400);
		assert.deepStrictEqual(res.json(), {
			error: {
				code: "VALIDATION_ERROR",
				message: "Request validation failed",
			},
		});
	});
}

test("chat route rejects malformed JSON", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		headers: { "content-type": "application/json" },
		payload: '{"question":',
	});

	assert.equal(res.statusCode, 400);
	assert.deepStrictEqual(res.json(), {
		error: {
			code: "VALIDATION_ERROR",
			message: "Request validation failed",
		},
	});
});

test("chat route rejects a request body larger than the configured limit", async (t) => {
	const app = await build(t, testDependencies());

	const res = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "a".repeat(CHAT_BODY_LIMIT_BYTES),
		},
	});

	assert.equal(res.statusCode, 413);
	assert.deepStrictEqual(res.json(), {
		error: {
			code: "REQUEST_TOO_LARGE",
			message: "Request body is too large",
		},
	});
});

test("chat route applies the burst rate limit", async (t) => {
	// La ráfaga son 20 peticiones por minuto: la 21 sale 429. Sin este test, quitar
	// `fastify.register(rateLimitMiddleware)` de la ruta no rompe nada y la ráfaga
	// quedaría inerte en silencio — verde sin proteger nada.
	const app = await build(t, testDependencies());

	for (let i = 0; i < BURST_MAX; i++) {
		const res = await app.inject({
			method: "POST",
			url: "/api/chat",
			payload: { question: "hola" },
		});

		assert.equal(res.statusCode, 200, `petición ${i + 1} dentro de la ráfaga`);
	}

	const limited = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: { question: "hola" },
	});

	assert.equal(limited.statusCode, 429);
	const body = limited.json();
	assert.equal(body.error.code, "RATE_LIMIT_EXCEEDED");
	assert.match(body.error.message, /^Rate limit exceeded, retry in \d+ (second|minute)/);
	assert.ok(Number(limited.headers["retry-after"]) >= 1);
});
