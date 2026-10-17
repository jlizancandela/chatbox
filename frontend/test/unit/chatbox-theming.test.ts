import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import css from "../../src/components/Chatbox.css?raw";

const root = postcss.parse(css);

const LIGHT_TOKENS: Record<string, string> = {
	"--chatbox-color-text": "#222",
	"--chatbox-color-surface": "#ffffff",
	"--chatbox-color-primary": "#005fcc",
	"--chatbox-color-link": "#005fcc",
	"--chatbox-color-border": "#6b7280",
	"--chatbox-color-focus": "#005fcc",
	"--chatbox-color-error": "#b91c1c",
};

const DARK_TOKENS: Record<string, string> = {
	"--chatbox-color-text": "#ccc",
	"--chatbox-color-surface": "#1a1a1a",
	"--chatbox-color-primary": "#66b3ff",
	"--chatbox-color-link": "#66b3ff",
	"--chatbox-color-border": "#6b7280",
	"--chatbox-color-focus": "#66b3ff",
	"--chatbox-color-error": "#fca5a5",
};

const declarations = (rule: Rule): Record<string, string> =>
	Object.fromEntries(
		rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])
	);

const tokensOf = (rule: Rule): Record<string, string> =>
	Object.fromEntries(
		Object.entries(declarations(rule)).filter(([prop]) => prop.startsWith("--chatbox-color-"))
	);

const declarationNodes = (rule: Rule) => rule.nodes.filter((node) => node.type === "decl");

const topLevelRule = (selector: string): Rule => {
	const rule = root.nodes.find(
		(node): node is Rule => node.type === "rule" && node.selector === selector
	);
	if (!rule) throw new Error(`Missing top-level CSS rule: ${selector}`);
	return rule;
};

const mediaRule = (condition: string): AtRule => {
	const media = root.nodes.find(
		(node): node is AtRule =>
			node.type === "atrule" &&
			node.name === "media" &&
			(node.params ?? "").replace(/\s+/g, " ").trim() === condition
	);
	if (!media) throw new Error(`Missing media query: ${condition}`);
	return media;
};

const ruleInside = (container: AtRule, selector: string): Rule => {
	const rule = (container.nodes ?? []).find(
		(node): node is Rule => node.type === "rule" && node.selector === selector
	);
	if (!rule) throw new Error(`Missing rule ${selector} inside @media ${container.params}`);
	return rule;
};

const DARK_MEDIA = "(prefers-color-scheme: dark)";
const FORCED_COLORS_MEDIA = "(forced-colors: active)";
const PREFERS_CONTRAST_MEDIA = "(prefers-contrast: more)";

const FORCED_COLOR_KEYWORDS = [
	"Canvas",
	"CanvasText",
	"LinkText",
	"Highlight",
	"ButtonText",
	"ButtonFace",
	"GrayText",
];

const baseRule = (): Rule => topLevelRule(".chatbox");

const darkRule = (): Rule => ruleInside(mediaRule(DARK_MEDIA), ".chatbox");
const forcedColorsRule = (): Rule => ruleInside(mediaRule(FORCED_COLORS_MEDIA), ".chatbox");
const prefersContrastRule = (): Rule => ruleInside(mediaRule(PREFERS_CONTRAST_MEDIA), ".chatbox");
const hostRule = (theme: "dark" | "light"): Rule =>
	topLevelRule(`[data-theme="${theme}"] .chatbox`);

const offsetOf = (rule: Rule): number => {
	const offset = rule.source?.start?.offset;
	if (offset === undefined) throw new Error("Missing source offset");
	return offset;
};

const relativeLuminance = (value: string): number => {
	const hex = value.replace("#", "");
	const expanded =
		hex.length === 3
			? hex
					.split("")
					.map((char) => char + char)
					.join("")
			: hex;
	const [r, g, b] = (expanded.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16) / 255);
	const linear = (component: number): number =>
		component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrast = (a: string, b: string): number => {
	const first = relativeLuminance(a);
	const second = relativeLuminance(b);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

// Minimum ratio per token role, per the RF-F61 palette target:
// body text AAA (>=7:1), chromatic text AA (>=4.5:1), non-text AA 1.4.11 (>=3:1).
const CONTRAST_MINIMUMS: Record<string, number> = {
	text: 7,
	link: 4.5,
	primary: 4.5,
	focus: 4.5,
	error: 4.5,
	border: 3,
};

const PARSED_TOKENS = {
	light: tokensOf(baseRule()),
	dark: tokensOf(darkRule()),
};

describe("Chatbox.css (RF-F61/T1 — light defaults)", () => {
	it("declares exactly the 7 light tokens inside .chatbox", () => {
		expect(PARSED_TOKENS.light).toEqual(LIGHT_TOKENS);
	});

	it("consumes text and surface on .chatbox", () => {
		expect(declarations(baseRule())).toMatchObject({
			color: "var(--chatbox-color-text)",
			"background-color": "var(--chatbox-color-surface)",
		});
	});

	it("uses var(--chatbox-color-link) for .chatbox a", () => {
		expect(declarations(topLevelRule(".chatbox a"))).toMatchObject({
			color: "var(--chatbox-color-link)",
		});
	});

	it("uses the primary and surface tokens for the submit button", () => {
		expect(declarations(topLevelRule('.chatbox__footer button[type="submit"]'))).toMatchObject({
			"background-color": "var(--chatbox-color-primary)",
			color: "var(--chatbox-color-surface)",
		});
	});
});

describe("Chatbox.css (RF-F61/T4 — system accessibility preferences)", () => {
	it("uses system-color keywords for forced-colors", () => {
		const tokens = tokensOf(forcedColorsRule());
		expect(Object.keys(tokens)).toHaveLength(7);
		expect(Object.values(tokens).every((value) => FORCED_COLOR_KEYWORDS.includes(value))).toBe(
			true
		);
		expect(Object.values(tokens)).toEqual(
			expect.arrayContaining(["Canvas", "CanvasText", "LinkText", "Highlight", "GrayText"])
		);
	});

	it("overrides all 7 tokens for prefers-contrast: more", () => {
		expect(Object.keys(tokensOf(prefersContrastRule()))).toHaveLength(7);
		expect(offsetOf(prefersContrastRule())).toBeGreaterThan(offsetOf(baseRule()));
	});

	it("places accessibility overrides after the theme layers", () => {
		expect(offsetOf(prefersContrastRule())).toBeGreaterThan(offsetOf(hostRule("light")));
		expect(offsetOf(forcedColorsRule())).toBeGreaterThan(offsetOf(prefersContrastRule()));
	});
});

describe("Chatbox.css (RF-F61/T3 — explicit host themes)", () => {
	it("keeps both host theme selectors after the system dark layer", () => {
		expect(offsetOf(hostRule("dark"))).toBeGreaterThan(offsetOf(darkRule()));
		expect(offsetOf(hostRule("light"))).toBeGreaterThan(offsetOf(darkRule()));
	});

	it("declares complete dark and light token sets", () => {
		expect(tokensOf(hostRule("dark"))).toEqual(DARK_TOKENS);
		expect(tokensOf(hostRule("light"))).toEqual(LIGHT_TOKENS);
	});
});

describe("Chatbox.css (RF-F61/T2 — prefers-color-scheme: dark)", () => {
	it("targets .chatbox inside the dark media query", () => {
		expect(darkRule().selector).toBe(".chatbox");
	});

	it("declares exactly the 7 dark tokens, with no extra declarations", () => {
		expect(PARSED_TOKENS.dark).toEqual(DARK_TOKENS);
		expect(declarationNodes(darkRule())).toHaveLength(7);
	});

	it("does not paint inside the dark block (tokens only)", () => {
		const props = Object.keys(declarations(darkRule()));
		expect(props).not.toContain("color");
		expect(props).not.toContain("background-color");
	});

	it("places the dark block after the .chatbox defaults", () => {
		expect(offsetOf(darkRule())).toBeGreaterThan(offsetOf(baseRule()));
	});
});

for (const [theme, tokens] of Object.entries(PARSED_TOKENS)) {
	describe(`RF-F61 contrast — ${theme}`, () => {
		for (const [role, minimum] of Object.entries(CONTRAST_MINIMUMS)) {
			it(`--chatbox-color-${role} meets ${minimum}:1 against surface`, () => {
				expect(
					contrast(tokens[`--chatbox-color-${role}`], tokens["--chatbox-color-surface"])
				).toBeGreaterThanOrEqual(minimum);
			});
		}

		it("submit label meets 4.5:1 against primary", () => {
			expect(
				contrast(tokens["--chatbox-color-surface"], tokens["--chatbox-color-primary"])
			).toBeGreaterThanOrEqual(4.5);
		});
	});
}
