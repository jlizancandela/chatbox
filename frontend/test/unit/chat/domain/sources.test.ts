import { describe, expect, it } from "vitest";
import { sourceTitles } from "../../../../src/chat/domain/sources";
import type { ChatSource } from "../../../../src/chat/types";

const source = (title: string, chunkIndex = 0): ChatSource => ({
	documentId: `${title}-${chunkIndex}`,
	chunkIndex,
	title,
	content: "fragmento",
	distance: 0.2,
});

describe("sourceTitles", () => {
	it("returns the distinct document titles, in the order they appear", () => {
		expect(
			sourceTitles([
				source("Currículum", 0),
				source("Currículum", 1),
				source("Informe de GitHub", 0),
			])
		).toEqual(["Currículum", "Informe de GitHub"]);
	});

	it("returns nothing when there are no sources", () => {
		expect(sourceTitles([])).toEqual([]);
	});
});
