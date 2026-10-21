import type { Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast";
import {
	declarationsOf,
	mediaRule,
	offsetOf,
	ruleInside,
	tokensOf,
	topLevelRule,
} from "../css-layers";

// Stitch Material 3 roles: `on-surface`, `surface-container-lowest`, `primary`,
// `secondary`, `outline`, `error`, `surface-container`, `surface-container-high`
// and `primary-container`. The dark set comes from the same export's inverse and
// fixed roles, because the export ships no dark scheme.
const LIGHT_TOKENS: Record<string, string> = {
	"--chatbox-color-text": "#1a1b22",
	"--chatbox-color-surface": "#ffffff",
	"--chatbox-color-primary": "#00685f",
	"--chatbox-color-link": "#006398",
	"--chatbox-color-border": "#6d7a77",
	"--chatbox-color-focus": "#006398",
	"--chatbox-color-error": "#ba1a1a",
	"--chatbox-color-surface-subtle": "#eeedf7",
	"--chatbox-color-surface-raised": "#e8e7f1",
	"--chatbox-color-accent-container": "#008378",
};

const DARK_TOKENS: Record<string, string> = {
	"--chatbox-color-text": "#f1effa",
	"--chatbox-color-surface": "#2f3038",
	"--chatbox-color-primary": "#6bd8cb",
	"--chatbox-color-link": "#93ccff",
	"--chatbox-color-border": "#bcc9c6",
	"--chatbox-color-focus": "#93ccff",
	"--chatbox-color-error": "#fca5a5",
	"--chatbox-color-surface-subtle": "#3a3b44",
	"--chatbox-color-surface-raised": "#45464f",
	"--chatbox-color-accent-container": "#89f5e7",
};

const declarationNodes = (rule: Rule) => rule.nodes.filter((node) => node.type === "decl");

const DARK_MEDIA = "(prefers-color-scheme: dark)";
const FORCED_COLORS_MEDIA = "(forced-colors: active)";
/**
 * The increased-contrast layer only substitutes the palette in the light scheme: the dark
 * palette already clears every floor of the contrast contract (RF-F42). The rule that carries
 * those tokens for a host-declared light theme lives in the unrestricted
 * `(prefers-contrast: more)` block — see `chatbox-contrast.test.ts`.
 */
const PREFERS_CONTRAST_MEDIA = "(prefers-contrast: more) and (prefers-color-scheme: light)";

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

/**
 * Objetivos de paleta de RF-F61: el texto del cuerpo en AAA (>=7:1), el texto cromático en AA
 * (>=4.5:1) y lo que no es texto en AA 1.4.11 (>=3:1).
 *
 * **No** son criterios de aceptación de RF-F42: el contrato de ese RF fija 4.5:1 para el texto
 * y 3:1 para los componentes visuales y el anillo de foco. Estos umbrales son más estrictos
 * para el texto del cuerpo y más exigidos para el foco. Se quedan como asertos duros a
 * propósito: una paleta que los tumbe tiene que ser una decisión consciente, no un descuido.
 * El contrato vive en `chatbox-contrast.test.ts`.
 */
const PALETTE_TARGETS: Record<string, number> = {
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
	it("declares exactly the 10 light tokens inside .chatbox", () => {
		expect(PARSED_TOKENS.light).toEqual(LIGHT_TOKENS);
	});

	it("consumes text and surface on .chatbox", () => {
		expect(declarationsOf(baseRule())).toMatchObject({
			color: "var(--chatbox-color-text)",
			"background-color": "var(--chatbox-color-surface)",
		});
	});

	it("uses var(--chatbox-color-link) for .chatbox a", () => {
		expect(declarationsOf(topLevelRule(".chatbox a"))).toMatchObject({
			color: "var(--chatbox-color-link)",
		});
	});

	it("uses the primary and surface tokens for the submit button", () => {
		expect(declarationsOf(topLevelRule('.chatbox__footer button[type="submit"]'))).toMatchObject({
			"background-color": "var(--chatbox-color-primary)",
			color: "var(--chatbox-color-surface)",
		});
	});
});

describe("Chatbox.css (RF-F61/T4 — system accessibility preferences)", () => {
	it("uses system-color keywords for forced-colors", () => {
		const tokens = tokensOf(forcedColorsRule());
		expect(Object.keys(tokens)).toHaveLength(10);
		expect(Object.values(tokens).every((value) => FORCED_COLOR_KEYWORDS.includes(value))).toBe(
			true
		);
		expect(Object.values(tokens)).toEqual(
			expect.arrayContaining(["Canvas", "CanvasText", "LinkText", "Highlight", "GrayText"])
		);
	});

	it("declares the 10 tokens for prefers-contrast: more in the light scheme", () => {
		expect(Object.keys(tokensOf(prefersContrastRule()))).toHaveLength(10);
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

	it("declares exactly the 10 dark tokens, with no extra declarations", () => {
		expect(PARSED_TOKENS.dark).toEqual(DARK_TOKENS);
		expect(declarationNodes(darkRule())).toHaveLength(10);
	});

	it("does not paint inside the dark block (tokens only)", () => {
		const props = Object.keys(declarationsOf(darkRule()));
		expect(props).not.toContain("color");
		expect(props).not.toContain("background-color");
	});

	it("places the dark block after the .chatbox defaults", () => {
		expect(offsetOf(darkRule())).toBeGreaterThan(offsetOf(baseRule()));
	});
});

for (const [theme, tokens] of Object.entries(PARSED_TOKENS)) {
	describe(`Objetivo de paleta — ${theme} (RF-F61; no es un AC de RF-F42)`, () => {
		for (const [role, minimum] of Object.entries(PALETTE_TARGETS)) {
			it(`--chatbox-color-${role} meets ${minimum}:1 against surface`, () => {
				expect(
					contrastRatio(tokens[`--chatbox-color-${role}`], tokens["--chatbox-color-surface"])
				).toBeGreaterThanOrEqual(minimum);
			});
		}

		it("submit label meets 4.5:1 against primary", () => {
			expect(
				contrastRatio(tokens["--chatbox-color-surface"], tokens["--chatbox-color-primary"])
			).toBeGreaterThanOrEqual(4.5);
		});

		// The tonal surfaces are backgrounds, not text: each is checked against the
		// ink that sits on it instead of against the shell surface.
		it("body text meets 7:1 against the tonal surface", () => {
			expect(
				contrastRatio(tokens["--chatbox-color-text"], tokens["--chatbox-color-surface-subtle"])
			).toBeGreaterThanOrEqual(7);
		});

		it("badge ink meets 4.5:1 against the accent container", () => {
			expect(
				contrastRatio(tokens["--chatbox-color-surface"], tokens["--chatbox-color-accent-container"])
			).toBeGreaterThanOrEqual(4.5);
		});
	});
}
