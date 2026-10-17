import { render } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const setMediaPreference = (dark: boolean) => {
	window.matchMedia = ((query: string) => ({
		matches: query === "(prefers-color-scheme: dark)" ? dark : false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
};

import { Chatbox } from "../../src/components/Chatbox";

describe("Chatbox theming (RF-F61/T3)", () => {
	let originalMatchMedia: typeof window.matchMedia;

	beforeEach(() => {
		originalMatchMedia = window.matchMedia;
	});

	afterEach(() => {
		window.matchMedia = originalMatchMedia;
		document.body.innerHTML = "";
	});
	it("renders with .chatbox as the root class", () => {
		const { container } = render(<Chatbox apiUrl="http://example.com" />);
		const root = container.querySelector(".chatbox");
		expect(root).not.toBeNull();
	});

	it("applies the primary token via the CSS rule on the submit button (jsdom limitation noted)", () => {
		const wrapper = document.createElement("div");
		wrapper.style.setProperty("--chatbox-color-primary", "red");
		document.body.appendChild(wrapper);

		render(<Chatbox apiUrl="http://example.com" />, { container: wrapper });

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

	it("honors a dark host theme when the system is light", () => {
		setMediaPreference(false);
		const wrapper = document.createElement("div");
		wrapper.dataset.theme = "dark";
		document.body.appendChild(wrapper);
		render(<Chatbox apiUrl="http://example.com" />, { container: wrapper });

		const css = getComputedStyle(wrapper.querySelector(".chatbox")!);
		expect(css.getPropertyValue("--chatbox-color-text").trim()).toBe("#ccc");
		expect(css.getPropertyValue("--chatbox-color-surface").trim()).toBe("#1a1a1a");
	});

	it("honors a light host theme when the system is dark", () => {
		setMediaPreference(true);
		const wrapper = document.createElement("div");
		wrapper.dataset.theme = "light";
		document.body.appendChild(wrapper);
		render(<Chatbox apiUrl="http://example.com" />, { container: wrapper });

		const css = getComputedStyle(wrapper.querySelector(".chatbox")!);
		expect(css.getPropertyValue("--chatbox-color-text").trim()).toBe("#222");
		expect(css.getPropertyValue("--chatbox-color-surface").trim()).toBe("#ffffff");
	});
});
