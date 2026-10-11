import { describe, expect, it } from "vitest";
import { createSSEParser, parseSSE } from "./sse";

describe("SSE parser", () => {
	it("parses a complete token frame", () => {
		expect(parseSSE('event: token\ndata: {"token":"hola"}\n\n')).toEqual({
			type: "token",
			token: "hola",
		});
	});

	it("reassembles a frame split across chunks", () => {
		const parser = createSSEParser();

		expect(parser.feed('event: token\ndata: {"token":"ho')).toEqual([]);
		expect(parser.feed('la"}\n\n')).toEqual([{ type: "token", token: "hola" }]);
	});

	it("returns several events from one chunk", () => {
		const parser = createSSEParser();
		const chunk = ['event: token\ndata: {"token":"hola"}\n\n', "event: done\ndata: {}\n\n"].join(
			""
		);

		expect(parser.feed(chunk)).toEqual([{ type: "token", token: "hola" }, { type: "done" }]);
	});

	it("parses sources and its canonical history", () => {
		const parser = createSSEParser();
		const source = {
			documentId: "cv.md",
			chunkIndex: 0,
			content: "Preact",
			distance: 0.2,
		};
		const frame = `event: sources\ndata: ${JSON.stringify({
			sources: [source],
			history: [{ role: "user", content: "¿Qué usa?" }],
		})}\n\n`;

		expect(parser.feed(frame)).toEqual([
			{
				type: "sources",
				sources: [source],
				history: [{ role: "user", content: "¿Qué usa?" }],
			},
		]);
	});

	it("parses error events and ignores invalid payloads", () => {
		const parser = createSSEParser();
		const chunk = [
			'event: error\ndata: {"message":"internal detail"}\n\n',
			'event: token\ndata: {"token":42}\n\n',
			"event: unknown\ndata: {}\n\n",
		].join("");

		expect(parser.feed(chunk)).toEqual([{ type: "error", message: "internal detail" }]);
	});

	it("can be reset for a new stream", () => {
		const parser = createSSEParser();
		parser.feed('event: token\ndata: {"token":"old"}\n\n');
		parser.reset();

		expect(parser.feed("event: done\ndata: {}\n\n")).toEqual([{ type: "done" }]);
	});
});
