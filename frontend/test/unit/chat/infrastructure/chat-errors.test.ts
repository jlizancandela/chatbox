import { describe, expect, it } from "vitest";
import { chatErrors } from "../../../../src/chat/infrastructure/chat-errors";
import { strings } from "../../../../src/strings.es";

// El texto se importa por clave: cambiar la redacción no rompe esta suite, y el
// barrido de literales fuera del módulo de textos vive en el test de inventario (#76).
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
			message: strings.errors.STREAM_ERROR,
		});
	});

	it.each([
		["network", "NETWORK_ERROR"],
		["stream", "STREAM_ERROR"],
		["incomplete", "INCOMPLETE_STREAM"],
		["timeout", "TIMEOUT"],
		["invalidQuestion", "QUESTION_INVALID"],
	] as const)("composes %s from its strings.errors key", (factory, code) => {
		expect(chatErrors[factory]()).toEqual({ code, message: strings.errors[code] });
	});
});
