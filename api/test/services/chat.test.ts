import assert from "node:assert";
import { test } from "node:test";
import type Groq from "groq-sdk";
import {
	buildChatMessages,
	createAskStream,
	type ChatEvent,
	type ChatSource,
} from "../../src/services/chat";
import type { HistoryMessage } from "../../src/services/history.contract";

type FakeDelta = { content?: string | null };
type FakeChunk = { choices?: Array<{ delta?: FakeDelta }> };

const source = (overrides: Partial<ChatSource> = {}): ChatSource => ({
	documentId: "1",
	chunkIndex: 0,
	content: "Contexto de ejemplo.",
	distance: 0.2,
	...overrides,
});

const chunkOf = (content: string): FakeChunk => ({
	choices: [{ delta: { content } }],
});

const emptyStream = async function* (): AsyncIterable<FakeChunk> {};

const createFakeGroq = (
	create: (
		params: Record<string, unknown>,
		options?: { signal?: AbortSignal | null },
	) => Promise<AsyncIterable<FakeChunk>>,
): Groq =>
	({
		chat: {
			completions: {
				create,
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

test("askStream emits sources and done without context and skips Groq", async () => {
	let groqCalled = false;

	const askStream = createAskStream({
		retrieve: async () => [],
		loadHistory: async () => [],
		groqClient: createFakeGroq(async () => {
			groqCalled = true;
			return emptyStream();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question", { sessionKey: "session-test" }));

	assert.strictEqual(groqCalled, false);
	assert.deepStrictEqual(events, [
		{ type: "sources", sources: [] },
		{ type: "done" },
	]);
});

test("askStream emits sources, tokens and done with context", async () => {
	let capturedParams: Record<string, unknown> | undefined;

	const askStream = createAskStream({
		retrieve: async () => [source()],
		loadHistory: async () => [],
		groqClient: createFakeGroq(async (params) => {
			capturedParams = params;
			return (async function* () {
				yield chunkOf("Hola ");
				yield { choices: [{ delta: { content: null } }] };
				yield { choices: [] };
				yield chunkOf("mundo");
			})();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question", { sessionKey: "session-test" }));

	assert.strictEqual(capturedParams?.stream, true);
	assert.strictEqual(capturedParams?.model, "model-test");
	assert.deepStrictEqual(events, [
		{ type: "sources", sources: [source()] },
		{ type: "token", token: "Hola " },
		{ type: "token", token: "mundo" },
		{ type: "done" },
	]);
});

test("askStream forwards the abort signal to Groq", async () => {
	let capturedSignal: AbortSignal | null | undefined;
	const controller = new AbortController();

	const askStream = createAskStream({
		retrieve: async () => [source()],
		loadHistory: async () => [],
		groqClient: createFakeGroq(async (_params, options) => {
			capturedSignal = options?.signal;
			return (async function* () {
				yield chunkOf("x");
			})();
		}),
		modelDefault: "model-test",
	});

	await collect(askStream("question", {
				sessionKey: "session-test",
				signal: controller.signal,
			}));

	assert.strictEqual(capturedSignal, controller.signal);
});

test("askStream emits an error event when the provider fails mid-stream", async () => {
	const askStream = createAskStream({
		retrieve: async () => [source()],
		loadHistory: async () => [],
		groqClient: createFakeGroq(async () => {
			return (async function* () {
				yield chunkOf("Hola");
				throw new Error("provider failure");
			})();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question", { sessionKey: "session-test" }));

	assert.deepStrictEqual(events, [
		{ type: "sources", sources: [source()] },
		{ type: "token", token: "Hola" },
		{
			type: "error",
			message: "An unexpected error occurred while generating the answer",
		},
	]);
});

test("askStream stops silently when aborted mid-stream", async () => {
	const controller = new AbortController();

	const askStream = createAskStream({
		retrieve: async () => [source()],
		loadHistory: async () => [],
		groqClient: createFakeGroq(async (_params, options) => {
			const signal = options?.signal;
			return (async function* () {
				await new Promise<never>((_resolve, reject) => {
					signal?.addEventListener("abort", () =>
						reject(new DOMException("The operation was aborted", "AbortError")),
					);
				});
			})();
		}),
		modelDefault: "model-test",
	});

	const events: ChatEvent[] = [];
	const collecting = (async () => {
		for await (const event of askStream("question", {
			sessionKey: "session-test",
		signal: controller.signal,
		})) {
			events.push(event);
		}
	})();

	setTimeout(() => controller.abort(), 10);
	await collecting;

	assert.deepStrictEqual(events, [{ type: "sources", sources: [source()] }]);
});

test("askStream emits an error event when retrieval fails", async () => {
	let groqCalled = false;

	const askStream = createAskStream({
		retrieve: async () => {
			throw new Error("embedding provider failure");
		},
		loadHistory: async () => [],
		groqClient: createFakeGroq(async () => {
			groqCalled = true;
			return emptyStream();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question", { sessionKey: "session-test" }));

	assert.strictEqual(groqCalled, false);
	assert.deepStrictEqual(events, [
		{
			type: "error",
			message: "An unexpected error occurred while generating the answer",
		},
	]);
});

test("buildChatMessages includes history and merges consecutive user turns", () => {
	const history: HistoryMessage[] = [
		{
			seq: 1,
			role: "user",
			content: "Primera pregunta",
			createdAt: "2026-01-01T00:00:00.000Z",
		},
		{
			seq: 2,
			role: "assistant",
			content: "Primera respuesta",
			createdAt: "2026-01-01T00:00:01.000Z",
		},
		{
			seq: 3,
			role: "user",
			content: "Pregunta sin respuesta",
			createdAt: "2026-01-01T00:00:02.000Z",
		},
	];

	assert.deepStrictEqual(buildChatMessages("Contexto", history, "Nueva pregunta"), [
		{
			role: "system",
			content:
				"You are a helpful assistant that answers questions based only on the provided context. If the context does not contain the answer, say you do not know.\n\nContext:\nContexto",
		},
		{ role: "user", content: "Primera pregunta" },
		{ role: "assistant", content: "Primera respuesta" },
		{
			role: "user",
			content: "Pregunta sin respuesta\n\nNueva pregunta",
		},
	]);
});

test("askStream continues without history when the loader fails", async () => {
	let capturedMessages: unknown;
	const askStream = createAskStream({
		retrieve: async () => [source()],
		loadHistory: async () => {
			throw new Error("history database unavailable");
		},
		groqClient: createFakeGroq(async (params) => {
			capturedMessages = params.messages;
			return emptyStream();
		}),
		modelDefault: "model-test",
	});

	await collect(askStream("question", { sessionKey: "session-test" }));

	assert.deepStrictEqual(capturedMessages, [
		{
			role: "system",
			content:
				"You are a helpful assistant that answers questions based only on the provided context. If the context does not contain the answer, say you do not know.\n\nContext:\nContexto de ejemplo.",
		},
		{ role: "user", content: "question" },
	]);
});
