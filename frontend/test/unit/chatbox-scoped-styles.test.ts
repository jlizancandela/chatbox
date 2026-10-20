import postcss from "postcss";
import { describe, expect, it } from "vitest";
import chatboxCss from "../../src/components/Chatbox.css?raw";
import globalCss from "../../src/style.css?raw";

const CHATBOX_SELECTOR =
	/^(\[data-theme="(?:dark|light)"\] )?\.chatbox(?:__[\w-]+)?(?:[\s:[>+~.]|$)/;
const DEMO_SELECTOR = /^#app(?![\w-])/;

const selectorsOf = (css: string): string[] => {
	const selectors: string[] = [];
	postcss.parse(css).walkRules((rule) => {
		if (rule.parent?.type === "atrule" && (rule.parent as postcss.AtRule).name === "keyframes") {
			return;
		}
		selectors.push(...rule.selectors);
	});
	return selectors;
};

describe("RF-F63 scoped styles — Chatbox.css", () => {
	it("every selector is scoped to the .chatbox root", () => {
		const selectors = selectorsOf(chatboxCss);
		expect(selectors.length).toBeGreaterThan(0);
		for (const selector of selectors) {
			expect(selector, selector).toMatch(CHATBOX_SELECTOR);
		}
	});
});

describe("RF-F63 scoped styles — guard rejects global selectors", () => {
	it.each([":root", "body", "section", "img", "html", "*", ".resource", "#app-shell"])(
		"rejects %s as a widget selector",
		(selector) => {
			expect(CHATBOX_SELECTOR.test(selector)).toBe(false);
		}
	);

	it.each([":root", "body", "section", ".resource", "img", ".chatbox"])(
		"rejects %s as a demo selector",
		(selector) => {
			expect(DEMO_SELECTOR.test(selector)).toBe(false);
		}
	);
});

describe("RF-F63 scoped styles — src/style.css", () => {
	it("contains only demo-page selectors scoped to #app", () => {
		const selectors = selectorsOf(globalCss);
		expect(selectors.length).toBeGreaterThan(0);
		for (const selector of selectors) {
			expect(selector, selector).toMatch(DEMO_SELECTOR);
		}
	});

	it("does not style the root element, body or section, which the widget inherits", () => {
		const selectors = selectorsOf(globalCss);
		expect(selectors).not.toContain(":root");
		expect(selectors).not.toContain("body");
		expect(selectors).not.toContain("section");
	});
});
