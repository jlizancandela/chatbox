import { describe, expect, it } from "vitest";
import { strings } from "../../src/strings.es";

describe("strings module", () => {
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

type FlattenedStringEntry = { path: string; value: unknown };

function flatten(value: unknown, path = "strings"): FlattenedStringEntry[] {
	if (typeof value !== "object" || value === null) return [{ path, value }];
	return Object.entries(value).flatMap(([key, entry]) =>
		flatten(entry, path === "strings" ? `strings.${key}` : `${path}.${key}`)
	);
}
