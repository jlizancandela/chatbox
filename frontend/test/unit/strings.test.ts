import { describe, expect, it } from "vitest";
import chatErrorsSource from "../../src/chat/infrastructure/chat-errors.ts?raw";
import { strings } from "../../src/strings.es";

// Los códigos se leen del fuente y no de una lista escrita aquí: añadir un error nuevo
// rompe esta suite sin tocar el test. El test de guarda de abajo es lo que delata un
// cambio de formato en el fuente (por ejemplo, renombrar la helper privada).
const emittedCodes = [...chatErrorsSource.matchAll(/error\(\s*['"]([A-Z_0-9]+)['"]/g)].map(
	(match) => match[1]
);

describe("strings module", () => {
	it("reads the error codes from the source", () => {
		expect(emittedCodes.length).toBeGreaterThan(0);
	});

	it("has exactly one text per emitted error code, and none for a code that is never emitted", () => {
		expect(Object.keys(strings.errors).sort()).toEqual([...new Set(emittedCodes)].sort());
		for (const code of emittedCodes) {
			expect(strings.errors[code as keyof typeof strings.errors], `code ${code}`).toEqual(
				expect.any(String)
			);
		}
	});

	it("interpolates the character counter", () => {
		expect(strings.input.chars(812, 1000)).toBe("812/1000");
	});

	it("models the message author as a closed record of roles", () => {
		expect(Object.keys(strings.messages.author).sort()).toEqual(["assistant", "user"]);
	});

	it("pairs every visible button label with an aria label", () => {
		expect(Object.keys(strings.input.send).sort()).toEqual(["ariaLabel", "label"]);
		expect(Object.keys(strings.input.stop).sort()).toEqual(["ariaLabel", "label"]);
		expect(strings.input.send.ariaLabel).not.toBe(strings.input.send.label);
		expect(strings.input.stop.ariaLabel).not.toBe(strings.input.stop.label);
	});

	it("has no empty or whitespace-only text", () => {
		for (const { path, value } of flatten(strings)) {
			if (typeof value !== "string") continue;
			expect(value.trim(), path).not.toBe("");
		}
	});
});

type Leaf = { path: string; value: unknown };

function flatten(value: unknown, path = "strings"): Leaf[] {
	if (typeof value !== "object" || value === null) return [{ path, value }];
	return Object.entries(value).flatMap(([key, entry]) =>
		flatten(entry, path === "strings" ? `strings.${key}` : `${path}.${key}`)
	);
}
