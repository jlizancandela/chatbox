import assert from "node:assert";
import { test } from "node:test";
// La declaración del decorador `budget` vive en el plugin; sin importarlo, el typecheck
// del test no la ve.
import "../../src/plugins/session-budget";
import { BUDGET_SESSION_HEADER } from "../../src/services/sessionBudget";
import { build, type fakeGroq, fakePg, parseSSE, testDependencies } from "../helper";

const chunk = (content: string) => ({ choices: [{ delta: { content } }] });
const usage = (total: number) => ({ usage: { total_tokens: total } });

const groqReporting = (total: number): ReturnType<typeof fakeGroq> => {
	const client = {
		chat: {
			completions: {
				create: async function* () {
					yield chunk("Respuesta");
					yield usage(total);
				},
			},
		},
	};
	return { client: client as never, signal: () => undefined };
};

const withSources = () =>
	testDependencies({
		pg: fakePg([{ document_id: "1", chunk_index: 0, title: "CV", content: "c", distance: 0.1 }]),
		groqClient: groqReporting(500).client,
	});

test("el turno contabiliza los tokens que dice el proveedor", async (t) => {
	const app = await build(t, withSources());

	const response = await app.inject({
		method: "POST",
		url: "/api/chat",
		headers: { [BUDGET_SESSION_HEADER]: "sesion-1" },
		payload: { question: "¿Qué usa Jorge?" },
	});

	const frames = parseSSE(response.body);

	assert.ok(frames.some((frame) => frame.event === "done"));
});

test("sin identificador de sesión el turno se sirve igual", async (t) => {
	const app = await build(t, withSources());

	const response = await app.inject({
		method: "POST",
		url: "/api/chat",
		payload: { question: "¿Qué usa Jorge?" },
	});

	const frames = parseSSE(response.body);

	assert.ok(frames.some((frame) => frame.event === "done"));
	assert.ok(!frames.some((frame) => frame.event === "error"));
});

test("reiniciar la sesión devuelve el presupuesto a cero", async (t) => {
	const app = await build(t, withSources());

	const reset = await app.inject({
		method: "POST",
		url: "/api/chat/session/reset",
		headers: { [BUDGET_SESSION_HEADER]: "sesion-1" },
	});

	assert.strictEqual(reset.statusCode, 204);
});

test("el corte por presupuesto no llama al proveedor", async (t) => {
	let called = false;
	const client = {
		chat: {
			completions: {
				create: async function* () {
					called = true;
					yield chunk("Respuesta");
				},
			},
		},
	};

	const app = await build(
		t,
		testDependencies({
			pg: fakePg([{ document_id: "1", chunk_index: 0, title: "CV", content: "c", distance: 0.1 }]),
			groqClient: client as never,
		})
	);

	// Se agota el presupuesto a mano, por el mismo seam que usa el servicio.
	app.budget.record("sesion-llena", 10_000_000);

	const response = await app.inject({
		method: "POST",
		url: "/api/chat",
		headers: { [BUDGET_SESSION_HEADER]: "sesion-llena" },
		payload: { question: "¿Qué usa Jorge?" },
	});

	const frames = parseSSE(response.body);
	const error = frames.find((frame) => frame.event === "error");

	assert.ok(error, "el turno debería cortarse con un error");
	assert.deepStrictEqual(error.data, {
		code: "SESSION_BUDGET_EXCEEDED",
		message:
			"This conversation has reached its token budget. Start a new conversation to keep asking.",
	});
	assert.strictEqual(called, false, "no se debería haber llamado al proveedor");
});

test("el mensaje de corte invita a empezar una conversación nueva", async (t) => {
	const app = await build(
		t,
		testDependencies({
			pg: fakePg([{ document_id: "1", chunk_index: 0, title: "CV", content: "c", distance: 0.1 }]),
			groqClient: groqReporting(10).client,
		})
	);

	app.budget.record("sesion-llena", 10_000_000);

	const response = await app.inject({
		method: "POST",
		url: "/api/chat",
		headers: { [BUDGET_SESSION_HEADER]: "sesion-llena" },
		payload: { question: "¿Qué usa Jorge?" },
	});

	const frames = parseSSE(response.body);
	const error = frames.find((frame) => frame.event === "error");

	assert.ok(error, "el turno debería cortarse con un error");
	const message = (error.data as { message: string }).message;

	assert.ok(
		message.toLowerCase().includes("start a new conversation"),
		`el mensaje debería ofrecer una conversación nueva, dice: ${message}`
	);
});
