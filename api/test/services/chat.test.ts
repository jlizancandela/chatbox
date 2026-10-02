import assert from "node:assert";
import { test } from "node:test";
import type Groq from "groq-sdk";
import {
	createAskStream,
	type ChatEvent,
	type ChatSource,
} from "../../src/services/chat";

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
		groqClient: createFakeGroq(async () => {
			groqCalled = true;
			return emptyStream();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question"));

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

	const events = await collect(askStream("question"));

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
		groqClient: createFakeGroq(async (_params, options) => {
			capturedSignal = options?.signal;
			return (async function* () {
				yield chunkOf("x");
			})();
		}),
		modelDefault: "model-test",
	});

	await collect(askStream("question", controller.signal));

	assert.strictEqual(capturedSignal, controller.signal);
});

test("askStream emits an error event when the provider fails mid-stream", async () => {
	const askStream = createAskStream({
		retrieve: async () => [source()],
		groqClient: createFakeGroq(async () => {
			return (async function* () {
				yield chunkOf("Hola");
				throw new Error("provider failure");
			})();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question"));

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
		for await (const event of askStream("question", controller.signal)) {
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
		groqClient: createFakeGroq(async () => {
			groqCalled = true;
			return emptyStream();
		}),
		modelDefault: "model-test",
	});

	const events = await collect(askStream("question"));

	assert.strictEqual(groqCalled, false);
	assert.deepStrictEqual(events, [
		{
			type: "error",
			message: "An unexpected error occurred while generating the answer",
		},
	]);
});