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

	it("answers an exhausted quota with its own message and keeps the retry hint", () => {
		// La cuota no es "no he podido": es "está ocupado". El código y el texto lo distinguen,
		// y el aviso de reintento del proveedor no se tira por el camino (#144).
		expect(
			chatErrors.streamEvent({
				type: "error",
				code: "QUOTA_EXHAUSTED",
				message: "internal detail",
				retryAfterSeconds: 42,
			})
		).toEqual({
			code: "QUOTA_EXHAUSTED",
			message: strings.errors.QUOTA_EXHAUSTED,
			retryAfterSeconds: 42,
		});

		expect(
			chatErrors.streamEvent({
				type: "error",
				code: "QUOTA_EXHAUSTED",
				message: "internal detail",
			})
		).toEqual({
			code: "QUOTA_EXHAUSTED",
			message: strings.errors.QUOTA_EXHAUSTED,
		});
	});

	it("leaves a generic stream failure as the generic error", () => {
		expect(
			chatErrors.streamEvent({
				type: "error",
				code: "GENERATION_FAILED",
				message: "internal detail",
			})
		).toEqual({
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
