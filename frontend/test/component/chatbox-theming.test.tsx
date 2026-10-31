import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";

const DARK_MEDIA = "(prefers-color-scheme: dark)";

// Names only: the hex values are the unit test's business (single source of truth).
const DARK_TOKEN_NAMES = [
	"--chatbox-color-text",
	"--chatbox-color-surface",
	"--chatbox-color-primary",
	"--chatbox-color-link",
	"--chatbox-color-border",
	"--chatbox-color-focus",
	"--chatbox-color-error",
	"--chatbox-color-surface-subtle",
	"--chatbox-color-surface-raised",
	"--chatbox-color-accent-container",
];

const allStyleRules = (): CSSRule[] =>
	Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules));

const darkMediaRule = (): CSSMediaRule | undefined =>
	allStyleRules().find(
		(rule): rule is CSSMediaRule =>
			rule.type === CSSRule.MEDIA_RULE &&
			(rule as CSSMediaRule).media.mediaText.replace(/\s+/g, " ").trim() === DARK_MEDIA
	);

describe("Chatbox theming (RF-F61/T1)", () => {
	it("renders with .chatbox as the root class", () => {
		const { container } = render(<Chatbox variant="embedded" apiUrl="http://example.com" />);
		const root = container.querySelector(".chatbox");
		expect(root).not.toBeNull();
	});

	it("declares every role through its host token, so a host mapping reaches it", () => {
		const wrapper = document.createElement("div");
		document.body.appendChild(wrapper);

		render(<Chatbox variant="embedded" apiUrl="http://example.com" />, { container: wrapper });

		// jsdom no resuelve var() ni la cascada: se assertea el mecanismo —la declaración
		// del token— y la resolución real vive en `test/browser/theming.spec.ts`.
		const root = wrapper.querySelector(".chatbox") as HTMLElement;
		expect(root).not.toBeNull();
		expect(getComputedStyle(root).getPropertyValue("--chatbox-color-primary")).toMatch(
			/^var\(--chatbox-host-primary,\s*#00685f\)$/
		);

		document.body.removeChild(wrapper);
	});
});

describe("Chatbox theming (RF-F61/T2 — dark mechanism)", () => {
	it("ships the prefers-color-scheme: dark rule inside the imported stylesheet", () => {
		render(<Chatbox variant="embedded" apiUrl="http://example.com" />);

		const media = darkMediaRule();
		expect(media).toBeDefined();

		const chatboxRule = Array.from(media!.cssRules).find(
			(rule): rule is CSSStyleRule =>
				rule.type === CSSRule.STYLE_RULE && (rule as CSSStyleRule).selectorText === ".chatbox"
		);
		expect(chatboxRule).toBeDefined();
		for (const name of DARK_TOKEN_NAMES) {
			expect(chatboxRule!.style.getPropertyValue(name)).not.toBe("");
		}
	});

	it("consumes text and surface on .chatbox (raw var values, jsdom does not resolve them)", () => {
		const { container } = render(<Chatbox variant="embedded" apiUrl="http://example.com" />);
		const root = container.querySelector(".chatbox") as HTMLElement;
		expect(root).not.toBeNull();

		// jsdom neither evaluates @media nor resolves var(): the resolved dark
		// colors are verified in a real browser by the RF-F61/T5 ticket (#62).
		const styles = getComputedStyle(root);
		expect(styles.color).toBe("var(--chatbox-color-text)");
		expect(styles.backgroundColor).toBe("var(--chatbox-color-surface)");
	});
});
