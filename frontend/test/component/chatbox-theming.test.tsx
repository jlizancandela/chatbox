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

	it("applies the primary token via the CSS rule on the submit button (jsdom limitation noted)", () => {
		const wrapper = document.createElement("div");
		wrapper.style.setProperty("--chatbox-color-primary", "red");
		document.body.appendChild(wrapper);

		render(<Chatbox variant="embedded" apiUrl="http://example.com" />, { container: wrapper });

		// The host's custom property is set on the ancestor.
		expect(wrapper.style.getPropertyValue("--chatbox-color-primary")).toBe("red");

		const button = wrapper.querySelector(
			".chatbox__footer button[type='submit']"
		) as HTMLButtonElement;
		expect(button).not.toBeNull();

		// The CSS rule applies var(--chatbox-color-primary) to the button.
		// jsdom does not resolve var() in computed styles (known limitation),
		// so we assert the raw value; a real browser would resolve it to "red".
		const buttonStyles = getComputedStyle(button);
		expect(buttonStyles.backgroundColor).toBe("var(--chatbox-color-primary)");

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
