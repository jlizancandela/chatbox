import { expect, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

const surface = (page: import("@playwright/test").Page) =>
	page.locator(".chatbox").evaluate((element) => getComputedStyle(element).backgroundColor);
const text = (page: import("@playwright/test").Page) =>
	page.locator(".chatbox").evaluate((element) => getComputedStyle(element).color);

async function openChatbox(page: import("@playwright/test").Page, theme?: "light" | "dark") {
	await page.goto("/?widget=embedded");
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
		await expect.poll(() => text(page)).toBe("rgb(26, 27, 34)");

		await page.emulateMedia({ colorScheme: "dark" });
		await expect.poll(() => surface(page)).toBe("rgb(47, 48, 56)");
		await expect.poll(() => text(page)).toBe("rgb(241, 239, 250)");
	});

	test("T3 explicit host theme overrides the system theme", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await openChatbox(page, "light");
		await expect.poll(() => surface(page)).toBe("rgb(255, 255, 255)");
		await expect.poll(() => text(page)).toBe("rgb(26, 27, 34)");

		await page.evaluate(() => {
			document.documentElement.dataset.theme = "dark";
		});
		await expect.poll(() => surface(page)).toBe("rgb(47, 48, 56)");
		await expect.poll(() => text(page)).toBe("rgb(241, 239, 250)");
	});

	test("T4 resolves forced colors and increased contrast", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
		await openChatbox(page);
		await expect.poll(() => text(page)).toBe("rgb(0, 0, 0)");
		await expect.poll(() => surface(page)).toBe("rgb(255, 255, 255)");

		await page.emulateMedia({ colorScheme: "light", forcedColors: "none" });
		await openChatbox(page);
		const contrastResolution = await page.evaluate(() => {
			const media = matchMedia("(prefers-contrast: more)");
			const rule = Array.from(document.styleSheets)
				.flatMap((sheet) => Array.from(sheet.cssRules))
				.find(
					(candidate) =>
						candidate instanceof CSSMediaRule &&
						candidate.conditionText === "(prefers-contrast: more)"
				);
			return {
				mediaMatches: media.matches,
				rulePresent: Boolean(rule),
				text: getComputedStyle(document.querySelector(".chatbox")!).color,
			};
		});
		if (contrastResolution.mediaMatches) {
			expect(contrastResolution.text).toBe("rgb(0, 0, 0)");
		} else {
			expect(contrastResolution.rulePresent).toBe(true);
		}
	});

	test("T5 a host mapping reaches the widget in every theme path, and accessibility still wins", async ({
		page,
	}) => {
		const button = page.locator('.chatbox__footer button[type="submit"]');
		const background = () =>
			button.evaluate((element) => getComputedStyle(element).backgroundColor);

		// Los cuatro caminos que puede tomar un host: sin `data-theme` (el sistema decide, que
		// es lo que hace el portafolio con `data-theme="system"`) y con el tema explícito.
		const paths = [
			{ theme: undefined, colorScheme: "light" },
			{ theme: undefined, colorScheme: "dark" },
			{ theme: "light", colorScheme: "light" },
			{ theme: "dark", colorScheme: "light" },
		] as const;

		for (const { theme, colorScheme } of paths) {
			await page.emulateMedia({ colorScheme, forcedColors: "none" });
			await openChatbox(page, theme);
			await page.evaluate(() => {
				document.body.style.setProperty("--chatbox-host-primary", "rgb(255, 0, 0)");
			});
			await expect
				.poll(background, { message: `${theme ?? "sistema"}/${colorScheme}` })
				.toBe("rgb(255, 0, 0)");
		}

		// El mapeo del host no puede silenciar la preferencia de la persona: los colores
		// forzados siguen ganando, como en T4.
		await page.emulateMedia({ colorScheme: "light", forcedColors: "active" });
		await expect.poll(background).not.toBe("rgb(255, 0, 0)");
	});

	test("submit label is readable in light and dark themes", async ({ page }) => {
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await openChatbox(page);
			const button = page.locator('.chatbox__footer button[type="submit"]');
			await expect(button).toHaveText(strings.input.send.label);
			await expect(button).toBeVisible();
		}
	});
});
