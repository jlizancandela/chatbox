import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Chatbox } from "../../src/components/Chatbox";

describe("Chatbox theming (RF-F61/T1)", () => {
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
});
