import { describe, expect, it } from "vitest";
import { toAnnouncementText } from "../../../../src/chat/domain/announcement";

describe("toAnnouncementText", () => {
	it("drops the bold markers so the announcement reads the sentence", () => {
		expect(toAnnouncementText("**Jorge** trabaja con Preact")).toBe("Jorge trabaja con Preact");
	});

	it("keeps words that use two underscores as strong emphasis", () => {
		expect(toAnnouncementText("__Jorge__ trabaja con Preact")).toBe("Jorge trabaja con Preact");
	});

	it("drops the inline code backticks", () => {
		expect(toAnnouncementText("Usa `Preact` y `Fastify`")).toBe("Usa Preact y Fastify");
	});

	it("keeps only the label of a link", () => {
		expect(toAnnouncementText("Ver [GitHub](https://github.com/jlizancandela)")).toBe("Ver GitHub");
	});

	it("resolves a link wrapped in bold", () => {
		expect(toAnnouncementText("[**GitHub**](https://github.com/jlizancandela)")).toBe("GitHub");
	});

	it("drops unordered list markers and keeps the items", () => {
		expect(toAnnouncementText("- Preact\n- Fastify")).toBe("Preact\nFastify");
	});

	it("drops ordered list markers and keeps the items", () => {
		expect(toAnnouncementText("1. Preact\n2. Fastify")).toBe("Preact\nFastify");
	});

	it("keeps paragraph breaks so the announcement still has structure", () => {
		expect(toAnnouncementText("Primera frase.\n\nSegunda frase.")).toBe(
			"Primera frase.\n\nSegunda frase."
		);
	});

	it("leaves an arithmetic asterisk untouched instead of guessing it is emphasis", () => {
		// `*` y `_` sueltos son indistinguibles de la multiplicación y del snake_case: leerlos
		// como énfasis cambiaría el texto de la respuesta, que es peor que oír un asterisco.
		expect(toAnnouncementText("3 * 4 = 12")).toBe("3 * 4 = 12");
		expect(toAnnouncementText("Usa max__question__length")).toBe("Usa max__question__length");
	});

	it("leaves markdown it does not recognise untouched", () => {
		expect(toAnnouncementText("Columna | Valor")).toBe("Columna | Valor");
	});

	it("does not mistake a year at the start of a line for a list marker", () => {
		// `2024.` no es un ítem: borrarlo reescribiría la respuesta en lugar de limpiarla.
		expect(toAnnouncementText("2024. La película se presentó en Cannes")).toBe(
			"2024. La película se presentó en Cannes"
		);
	});

	it("returns an empty string for an empty response", () => {
		expect(toAnnouncementText("")).toBe("");
	});
});
