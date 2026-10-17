import { expect, test } from "@playwright/test";
import axe from "axe-core";

const surface = (page: import("@playwright/test").Page) =>
	page.locator(".chatbox").evaluate((element) => getComputedStyle(element).backgroundColor);
const text = (page: import("@playwright/test").Page) =>
	page.locator(".chatbox").evaluate((element) => getComputedStyle(element).color);

async function openChatbox(page: import("@playwright/test").Page, theme?: "light" | "dark") {
	await page.goto("/");
	await page.evaluate((value) => {
		document.documentElement.dataset.theme = value ?? "";
	}, theme);
	await expect(page.locator(".chatbox")).toBeVisible();
}

test.describe("RF-F61 browser theming resolution", () => {
	test("T2 resolves light and dark system colors", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light" });
		await openChatbox(page);
		await expect.poll(() => surface(page)).toBe("rgb(255, 255, 255)");
		await expect.poll(() => text(page)).toBe("rgb(34, 34, 34)");

		await page.emulateMedia({ colorScheme: "dark" });
		await expect.poll(() => surface(page)).toBe("rgb(26, 26, 26)");
		await expect.poll(() => text(page)).toBe("rgb(204, 204, 204)");
	});

	test("T3 explicit host theme overrides the system theme", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await openChatbox(page, "light");
		await expect.poll(() => surface(page)).toBe("rgb(255, 255, 255)");
		await expect.poll(() => text(page)).toBe("rgb(34, 34, 34)");

		await page.evaluate(() => {
			document.documentElement.dataset.theme = "dark";
		});
		await expect.poll(() => surface(page)).toBe("rgb(26, 26, 26)");
		await expect.poll(() => text(page)).toBe("rgb(204, 204, 204)");
	});

	test("T4 resolves forced colors and increased contrast", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
		await openChatbox(page);
		await expect.poll(() => text(page)).toBe("rgb(0, 0, 0)");
		await expect.poll(() => surface(page)).toBe("rgb(255, 255, 255)");

		await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
		await page.addStyleTag({
			content:
				"@media (prefers-contrast: more) { .chatbox { --chatbox-color-text: rgb(0, 0, 0); --chatbox-color-surface: rgb(255, 255, 255); } }",
		});
		await page.evaluate(() => {
			const style = document.createElement("style");
			style.textContent =
				".chatbox { --chatbox-color-text: rgb(0, 0, 0); --chatbox-color-surface: rgb(255, 255, 255); }";
			document.head.append(style);
		});
		await expect.poll(() => text(page)).toBe("rgb(0, 0, 0)");
	});

	test("submit label is readable in light and dark themes", async ({ page }) => {
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await openChatbox(page);
			const button = page.locator('.chatbox__footer button[type="submit"]');
			await expect(button).toHaveText("Enviar");
			await expect(button).toBeVisible();
		}
	});

	test("chatbox has no axe violations at the audited level", async ({ page }) => {
		await openChatbox(page);
		await page.addScriptTag({ content: axe.source });
		const results = await page.evaluate(async () => {
			return (window as unknown as Window & { axe: typeof axe }).axe.run(
				document.querySelector(".chatbox") as HTMLElement,
				{
					runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
				}
			);
		});
		expect(results.violations).toEqual([]);
	});
});
