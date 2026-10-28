import { expect, test } from "@playwright/test";

const INHERITED_PROPERTIES = [
	"display",
	"flex-direction",
	"font-family",
	"font-size",
	"line-height",
	"margin-top",
	"color",
	"background-color",
];

const snapshot = (page: import("@playwright/test").Page) =>
	page.evaluate((properties) => {
		const selectors = [".chatbox", ".chatbox__header", ".chatbox__footer", ".chatbox h1"];
		return selectors.map((selector) => {
			const element = document.querySelector(selector) as HTMLElement;
			const style = getComputedStyle(element);
			return properties.map((property) => style.getPropertyValue(property));
		});
	}, INHERITED_PROPERTIES);

const disableHostSheet = (page: import("@playwright/test").Page) =>
	page.evaluate(() => {
		const sheets = Array.from(document.styleSheets).filter((sheet) =>
			Array.from(sheet.cssRules).some(
				(rule) => rule instanceof CSSStyleRule && rule.selectorText.startsWith("#app")
			)
		);
		for (const sheet of sheets) sheet.disabled = true;
		return sheets.length;
	});

test.describe("RF-F63 scoped styles", () => {
	test("the widget renders the same without the host stylesheet", async ({ page }) => {
		await page.goto("/?widget=embedded");
		await expect(page.locator(".chatbox")).toBeVisible();

		const withHostStyles = await snapshot(page);
		const disabledSheets = await disableHostSheet(page);
		expect(disabledSheets).toBe(1);

		await expect.poll(() => snapshot(page)).toEqual(withHostStyles);
	});
});
