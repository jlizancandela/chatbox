import { describe, expect, it } from "vitest";
import { chatErrors } from "../../../../src/chat/infrastructure/chat-errors";

describe("chat error translation", () => {
	it.each([
		[400, "HTTP_400"],
		[413, "HTTP_413"],
		[429, "HTTP_429"],
		[500, "HTTP_SERVER"],
	])("maps HTTP %s to a local error", (status, code) => {
		expect(chatErrors.http(status).code).toBe(code);
	});

	it("does not expose transport details", () => {
		expect(chatErrors.stream()).toEqual({
			code: "STREAM_ERROR",
			message: "No he podido completar la respuesta.",
		});
	});
});
