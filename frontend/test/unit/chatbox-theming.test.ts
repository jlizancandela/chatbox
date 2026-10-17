import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "../../src/components/Chatbox.css");

describe("Chatbox.css (RF-F61/T3)", () => {
	const readCss = () => readFileSync(cssPath, "utf8");

	it("declares the 7 light tokens inside .chatbox", () => {
		const css = readCss();
		const block = css.match(/\.chatbox\s*\{([^}]*)\}/);
		expect(block).not.toBeNull();
		const body = block![1];
		expect(body).toMatch(/--chatbox-color-text:\s*#222/);
		expect(body).toMatch(/--chatbox-color-surface:\s*#ffffff/);
		expect(body).toMatch(/--chatbox-color-primary:\s*#005fcc/);
		expect(body).toMatch(/--chatbox-color-link:\s*#005fcc/);
		expect(body).toMatch(/--chatbox-color-border:\s*#6b7280/);
		expect(body).toMatch(/--chatbox-color-focus:\s*#005fcc/);
		expect(body).toMatch(/--chatbox-color-error:\s*#b91c1c/);
	});

	it("uses var(--chatbox-color-link) for .chatbox a", () => {
		const css = readCss();
		expect(css).toMatch(/\.chatbox\s+a\s*\{[^}]*color:\s*var\(--chatbox-color-link\)/);
	});

	it("declares dark system tokens and explicit host theme tokens", () => {
		const css = readCss();
		expect(css).toMatch(
			/@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*--chatbox-color-surface:\s*#1a1a1a/
		);
		expect(css).toMatch(
			/\[data-theme="dark"\]\s+\.chatbox\s*\{[\s\S]*--chatbox-color-text:\s*#ccc/
		);
		expect(css).toMatch(
			/\[data-theme="light"\]\s+\.chatbox\s*\{[\s\S]*--chatbox-color-text:\s*#222/
		);
	});

	it("places explicit host selectors after the system dark media query", () => {
		const css = readCss();
		expect(css.indexOf('[data-theme="dark"] .chatbox')).toBeGreaterThan(
			css.indexOf("@media (prefers-color-scheme: dark)")
		);
		expect(css.indexOf('[data-theme="light"] .chatbox')).toBeGreaterThan(
			css.indexOf("@media (prefers-color-scheme: dark)")
		);
	});
});
