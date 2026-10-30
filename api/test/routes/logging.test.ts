import assert from "node:assert";
import { test } from "node:test";
import type { Logger } from "../../src/infrastructure/logging";
import { findSecretValues, SECRET_KEYS } from "../../src/infrastructure/logging";
import { build, fakeGroq, fakePg, parseSSE, testDependencies } from "../helper";

type Recorded = {
	requests: unknown[];
	failures: unknown[];
};

const recordingLogger = (recorded: Recorded): Logger => ({
	request: (trace) => recorded.requests.push(trace),
	failure: (failure) => recorded.failures.push(failure),
});

test("cada petición deja una traza con su identificador, método, ruta y estado", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const app = await build(t, testDependencies({ logger: recordingLogger(recorded) }));

	const response = await app.inject({ method: "GET", url: "/health" });

	assert.strictEqual(response.statusCode, 200);
	assert.strictEqual(recorded.requests.length, 1);

	const trace = recorded.requests[0] as Record<string, unknown>;
	assert.strictEqual(trace.method, "GET");
	assert.strictEqual(trace.url, "/health");
	assert.strictEqual(trace.statusCode, 200);
	assert.ok(typeof trace.durationMs === "number");
	assert.ok(typeof trace.requestId === "string" && trace.requestId.length > 0);
});

test("la respuesta lleva el identificador de correlación", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const app = await build(t, testDependencies({ logger: recordingLogger(recorded) }));

	const response = await app.inject({ method: "GET", url: "/health" });

	assert.ok(response.headers["x-request-id"]);
});

test("el identificador que ya viaja en la petición se respeta", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const app = await build(t, testDependencies({ logger: recordingLogger(recorded) }));

	const response = await app.inject({
		method: "GET",
		url: "/health",
		headers: { "x-request-id": "abc-123" },
	});

	assert.strictEqual(response.headers["x-request-id"], "abc-123");
	assert.strictEqual((recorded.requests[0] as Record<string, unknown>).requestId, "abc-123");
});

test("dos peticiones distintas tienen identificadores distintos", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const app = await build(t, testDependencies({ logger: recordingLogger(recorded) }));

	await app.inject({ method: "GET", url: "/health" });
	await app.inject({ method: "GET", url: "/health" });

	const first = (recorded.requests[0] as Record<string, unknown>).requestId;
	const second = (recorded.requests[1] as Record<string, unknown>).requestId;

	assert.notStrictEqual(first, second);
});

test("la traza de una petición no lleva el cuerpo ni el historial", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const app = await build(t, testDependencies({ logger: recordingLogger(recorded) }));

	await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: {
			question: "¿Qué usa Jorge?",
			history: [{ role: "user", content: "una pregunta anterior" }],
		},
	});

	const trace = JSON.stringify(recorded.requests[0]);

	assert.ok(!trace.includes("¿Qué usa Jorge?"));
	assert.ok(!trace.includes("una pregunta anterior"));
});

test("un fallo del proveedor se registra con su clasificación", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const groqError = Object.assign(new Error("quota"), { status: 429 });
	// Sin fragmentos no se llega al proveedor: hace falta contexto para que la generación
	// falle de verdad.
	const app = await build(
		t,
		testDependencies({
			logger: recordingLogger(recorded),
			pg: fakePg([{ document_id: "1", chunk_index: 0, title: "CV", content: "c", distance: 0.1 }]),
			groqClient: fakeGroq([], { failWith: groqError }).client,
		})
	);

	const response = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: { question: "¿Qué usa Jorge?" },
	});

	const frames = parseSSE(response.body);
	const error = frames.find((frame) => frame.event === "error");

	assert.ok(error, "el stream debería cerrar con un evento de error");
	assert.deepStrictEqual(error?.data, {
		code: "QUOTA_EXHAUSTED",
		message: "An unexpected error occurred while generating the answer",
	});

	// Y el log guarda la clasificación, para que un operador no investigue en el sitio
	// equivocado (#146).
	assert.strictEqual(recorded.failures.length, 1);
	assert.strictEqual((recorded.failures[0] as Record<string, unknown>).code, "QUOTA_EXHAUSTED");
	assert.strictEqual((recorded.failures[0] as Record<string, unknown>).status, 429);
});

test("un fallo que no es de cuota se registra con su propia clasificación", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const groqError = Object.assign(new Error("boom"), { status: 500 });
	const app = await build(
		t,
		testDependencies({
			logger: recordingLogger(recorded),
			pg: fakePg([{ document_id: "1", chunk_index: 0, title: "CV", content: "c", distance: 0.1 }]),
			groqClient: fakeGroq([], { failWith: groqError }).client,
		})
	);

	await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: { question: "¿Qué usa Jorge?" },
	});

	assert.strictEqual(recorded.failures.length, 1);
	assert.strictEqual((recorded.failures[0] as Record<string, unknown>).code, "GENERATION_FAILED");
});

test("ninguna clave de proveedor llega al log", async (t) => {
	const recorded: Recorded = { requests: [], failures: [] };
	const secret = "gsk-no-me-puedo-mostrar";
	process.env.GROQ_API_KEY = secret;

	try {
		const groqError = Object.assign(new Error("fallo"), { status: 500 });
		const app = await build(
			t,
			testDependencies({
				logger: recordingLogger(recorded),
				groqClient: fakeGroq([], { failWith: groqError }).client,
			})
		);

		await app.inject({
			method: "POST",
			url: "/api/chat",
			payload: { question: "¿Qué usa Jorge?" },
		});

		const everything = JSON.stringify({ ...recorded.requests, ...recorded.failures });

		assert.ok(!everything.includes(secret), "la clave del proveedor no puede aparecer en el log");
	} finally {
		delete process.env.GROQ_API_KEY;
	}
});

test("el detector de secretos muerde: encuentra la clave cuando está presente", () => {
	// Si el detector no encontrara nada, la prueba anterior no protegería de nada.
	const found = findSecretValues({ nested: { GROQ_API_KEY: "secreto" } }, SECRET_KEYS);

	assert.strictEqual(found.length, 1);
	assert.strictEqual(found[0].value, "secreto");
});
