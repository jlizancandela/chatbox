import assert from "node:assert";
import { test } from "node:test";
import type Groq from "groq-sdk";
import { type ChatEvent, createAskStream } from "../../src/services/chat";
import { createSessionBudget } from "../../src/services/sessionBudget";

type FakeDelta = { content?: string | null };
type FakeUsage = { total_tokens?: number };
type FakeChunk = { choices?: Array<{ delta?: FakeDelta }>; usage?: FakeUsage };

const source = {
	documentId: "1",
	chunkIndex: 0,
	title: "Currículum",
	content: "Contexto de ejemplo.",
	distance: 0.2,
};

const groqWith = (chunks: FakeChunk[]): Groq =>
	({
		chat: {
			completions: {
				create: async function* () {
					for (const chunk of chunks) {
						yield chunk;
					}
				},
			},
		},
	}) as unknown as Groq;

const collect = async (stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> => {
	const events: ChatEvent[] = [];
	for await (const event of stream) {
		events.push(event);
	}
	return events;
};

const askStreamWith = (
	chunks: FakeChunk[],
	deps: { budget?: ReturnType<typeof createSessionBudget>; sessionId?: string } = {}
) =>
	createAskStream({
		retrieve: async () => [source],
		groqClient: groqWith(chunks),
		modelDefault: "modelo",
		historyLimits: { maxMessages: 12, maxMessageChars: 1000, maxTotalChars: 4000 },
		generation: { temperature: 0.6, maxCompletionTokens: 1200, reasoningEffort: "low" },
		...(deps.budget ? { budget: deps.budget } : {}),
	})("Pregunta", { history: [], ...(deps.sessionId ? { sessionId: deps.sessionId } : {}) });

test("el turno cuenta los tokens que dice el proveedor", async () => {
	const budget = createSessionBudget({ maxTokens: 10_000, maxTurns: 10 });

	await collect(
		askStreamWith(
			[{ choices: [{ delta: { content: "hola" } }] }, { usage: { total_tokens: 1234 } }],
			{ budget, sessionId: "sesion-1" }
		)
	);

	assert.strictEqual(budget.usedTokens("sesion-1"), 1234);
	assert.strictEqual(budget.usedTurns("sesion-1"), 1);
});

test("un turno que termina sin texto sigue contabilizando", async () => {
	const budget = createSessionBudget({ maxTokens: 10_000, maxTurns: 10 });

	await collect(
		askStreamWith([{ usage: { total_tokens: 900 } }], { budget, sessionId: "sesion-1" })
	);

	// El consumo se produjo aunque el modelo no dijera nada: se pagaron los tokens.
	assert.strictEqual(budget.usedTokens("sesion-1"), 900);
	assert.strictEqual(budget.usedTurns("sesion-1"), 1);
});

test("al agotarse el presupuesto el turno se corta con su propio código", async () => {
	const budget = createSessionBudget({ maxTokens: 1000, maxTurns: 10 });
	budget.record("sesion-1", 1000);

	const events = await collect(
		askStreamWith([{ choices: [{ delta: { content: "hola" } }] }], {
			budget,
			sessionId: "sesion-1",
		})
	);

	const error = events.find((event) => event.type === "error");

	assert.ok(error, "el turno debería cortarse con un error");
	assert.strictEqual(error.type === "error" ? error.code : undefined, "SESSION_BUDGET_EXCEEDED");
});

test("un turno cortado por presupuesto no llama al proveedor", async () => {
	let called = false;
	const budget = createSessionBudget({ maxTokens: 1000, maxTurns: 10 });
	budget.record("sesion-1", 1000);

	const stream = createAskStream({
		retrieve: async () => [source],
		groqClient: {
			chat: {
				completions: {
					create: async function* () {
						called = true;
						yield { choices: [{ delta: { content: "hola" } }] };
					},
				},
			},
		} as unknown as Groq,
		modelDefault: "modelo",
		historyLimits: { maxMessages: 12, maxMessageChars: 1000, maxTotalChars: 4000 },
		generation: { temperature: 0.6, maxCompletionTokens: 1200, reasoningEffort: "low" },
		budget,
	})("Pregunta", { history: [], sessionId: "sesion-1" });

	const events = await collect(stream);

	assert.strictEqual(called, false, "no se debería haber llamado al proveedor");
	assert.ok(events.some((event) => event.type === "error"));
});

test("sin identificador de sesión el presupuesto no corta", async () => {
	const budget = createSessionBudget({ maxTokens: 1, maxTurns: 1 });

	const events = await collect(
		askStreamWith([{ choices: [{ delta: { content: "hola" } }] }], { budget })
	);

	assert.ok(!events.some((event) => event.type === "error"));
});
