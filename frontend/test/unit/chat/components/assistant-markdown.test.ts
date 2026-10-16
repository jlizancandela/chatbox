import { describe, expect, it } from "vitest";
import { isSafeUrl } from "../../../../src/chat/components/AssistantMarkdown";

describe("isSafeUrl", () => {
	it("accepts absolute HTTP(S) and mailto URLs", () => {
		expect(isSafeUrl("https://example.com/profile")).toBe(true);
		expect(isSafeUrl("http://example.com")).toBe(true);
		expect(isSafeUrl("mailto:jorge@example.com")).toBe(true);
	});

	it("rejects non-absolute, malformed, and unsafe URLs", () => {
		expect(isSafeUrl("/profile")).toBe(false);
		expect(isSafeUrl("//example.com")).toBe(false);
		expect(isSafeUrl("https:example.com")).toBe(false);
		expect(isSafeUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeUrl("data:text/html,unsafe")).toBe(false);
	});
});
