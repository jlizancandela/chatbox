import assert from "node:assert";
import { test } from "node:test";
import {
	createHistoryLimits,
	historyTTLMinutes,
	readHistoryTTLMinutes,
	type HistoryLimits,
	type HistoryMessage,
	normalizeMessageContent,
	trimHistory,
} from "../../src/services/history.contract";

const limits = (overrides: Partial<HistoryLimits> = {}): HistoryLimits => ({
	maxMessages: 20,
	maxMessageChars: 2000,
	maxTotalChars: 8000,
	...overrides,
});

const message = (
	seq: number,
	role: HistoryMessage["role"],
	content: string,
): HistoryMessage => ({
	seq,
	role,
	content,
	createdAt: "2026-01-01T00:00:00.000Z",
});

const seqs = (messages: HistoryMessage[]): number[] =>
	messages.map((item) => item.seq);

test("createHistoryLimits falls back to the documented defaults", () => {
	assert.deepStrictEqual(createHistoryLimits({}), {
		maxMessages: 20,
		maxMessageChars: 2000,
		maxTotalChars: 8000,
	});
});

test("createHistoryLimits reads overrides from the environment", () => {
	const limits = createHistoryLimits({
		HISTORY_MAX_MESSAGES: "6",
		HISTORY_MAX_MESSAGE_CHARS: "300",
		HISTORY_MAX_TOTAL_CHARS: "900",
	});

	assert.deepStrictEqual(limits, {
		maxMessages: 6,
		maxMessageChars: 300,
		maxTotalChars: 900,
	});
});

test("readHistoryTTLMinutes defaults to 15 minutes", () => {
	assert.strictEqual(readHistoryTTLMinutes({}), 15);
	assert.strictEqual(historyTTLMinutes, 15);
});

test("readHistoryTTLMinutes reads and validates the environment", () => {
	assert.strictEqual(
		readHistoryTTLMinutes({ HISTORY_SESSION_TTL_MINUTES: "45" }),
		45,
	);

	for (const value of ["0", "-1", "3.5", "abc"]) {
		assert.throws(
			() => readHistoryTTLMinutes({ HISTORY_SESSION_TTL_MINUTES: value }),
			/HISTORY_SESSION_TTL_MINUTES must be a positive integer/,
		);
	}
});

test("createHistoryLimits rejects non positive integer values", () => {
	for (const value of ["0", "-1", "3.5", "abc"]) {
		assert.throws(
			() => createHistoryLimits({ HISTORY_MAX_MESSAGES: value }),
			/HISTORY_MAX_MESSAGES must be a positive integer/,
		);
	}
});

test("createHistoryLimits rejects a total smaller than a single message", () => {
	assert.throws(
		() =>
			createHistoryLimits({
				HISTORY_MAX_MESSAGE_CHARS: "500",
				HISTORY_MAX_TOTAL_CHARS: "400",
			}),
		/HISTORY_MAX_TOTAL_CHARS must be greater than or equal to HISTORY_MAX_MESSAGE_CHARS/,
	);
});

test("normalizeMessageContent trims, truncates and drops empty content", () => {
	const config = limits({ maxMessageChars: 10 });

	assert.strictEqual(normalizeMessageContent("  hola  ", config), "hola");
	assert.strictEqual(normalizeMessageContent("0123456789abc", config), "0123456789");
	assert.strictEqual(normalizeMessageContent("   ", config), null);
	assert.strictEqual(normalizeMessageContent("", config), null);
});

test("trimHistory keeps the newest messages within the count limit", () => {
	const history = Array.from({ length: 5 }, (_, index) =>
		message(index + 1, index % 2 === 0 ? "user" : "assistant", `m${index + 1}`),
	);

	const trimmed = trimHistory(history, limits({ maxMessages: 3 }));

	assert.deepStrictEqual(seqs(trimmed), [3, 4, 5]);
	assert.strictEqual(trimmed[0]?.role, "user");
});

test("trimHistory keeps the newest messages within the total character limit", () => {
	const history = [
		message(1, "user", "aaaa"),
		message(2, "assistant", "bbbb"),
		message(3, "user", "cccc"),
		message(4, "assistant", "dddd"),
	];

	const trimmed = trimHistory(history, limits({ maxTotalChars: 9 }));

	assert.deepStrictEqual(seqs(trimmed), [3, 4]);
});

test("trimHistory drops the assistant left without its question", () => {
	const history = [
		message(1, "user", "pregunta"),
		message(2, "assistant", "respuesta"),
		message(3, "user", "otra pregunta"),
	];

	const trimmed = trimHistory(history, limits({ maxMessages: 2 }));

	assert.deepStrictEqual(seqs(trimmed), [3]);
	assert.strictEqual(trimmed[0]?.role, "user");
});

test("trimHistory keeps an unanswered user message as a single turn", () => {
	const history = [message(1, "user", "pregunta sin respuesta")];

	const trimmed = trimHistory(history, limits({ maxMessages: 20 }));

	assert.deepStrictEqual(seqs(trimmed), [1]);
});

test("trimHistory preserves order without renumbering sequence numbers", () => {
	const history = [
		message(1, "user", "a"),
		message(2, "assistant", "b"),
		message(7, "user", "c"),
		message(9, "assistant", "d"),
	];

	const trimmed = trimHistory(history, limits({ maxMessages: 3 }));

	assert.deepStrictEqual(seqs(trimmed), [7, 9]);
});

test("trimHistory returns an empty history for an empty input", () => {
	assert.deepStrictEqual(trimHistory([], limits()), []);
});

test("trimHistory never truncates the most recent message away", () => {
	const history = [message(1, "user", "0123456789")];

	const trimmed = trimHistory(history, limits({ maxTotalChars: 2 }));

	assert.deepStrictEqual(seqs(trimmed), [1]);
});