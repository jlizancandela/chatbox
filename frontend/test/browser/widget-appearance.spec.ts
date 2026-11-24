import { expect, type Locator, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";

const SOURCE = {
	documentId: "doc-1",
	chunkIndex: 0,
	title: "Currículum — Jorge.pdf",
	content: "Jorge trabaja con Preact y Fastify.",
	distance: 0.12,
};

const computedStyle = (locator: Locator, properties: string[]) =>
	locator.evaluate((element, props) => {
		const style = getComputedStyle(element as Element);
		return Object.fromEntries(
			(props as string[]).map((property) => [property, style.getPropertyValue(property)])
		);
	}, properties);

const computed = (page: Page, selector: string, properties: string[]) =>
	computedStyle(page.locator(selector).first(), properties);

const COLLAPSE_INTERACTIVE_PROPS = ["border-top-color", "background-color"];
const TRANSPARENT = "rgba(0, 0, 0, 0)";

async function sendQuestion(page: Page, question = "¿Qué usa Jorge?"): Promise<void> {
	await page.locator("#chatbox-question").fill(question);
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
}

async function expectVisibleFeedback(locator: Locator, label: string): Promise<void> {
	await expect
		.poll(() => computedStyle(locator, COLLAPSE_INTERACTIVE_PROPS))
		.not.toEqual({
			"border-top-color": TRANSPARENT,
			"background-color": TRANSPARENT,
		});
	const styles = await computedStyle(locator, COLLAPSE_INTERACTIVE_PROPS);
	expect(styles["border-top-color"], label).not.toBe(TRANSPARENT);
	expect(styles["background-color"], label).not.toBe(TRANSPARENT);
}

/**
 * Los selectores de `Chatbox.css` tienen que existir en el markup.
 * Los dos fallos que motivan esta spec eran reglas muertas: el CSS apuntaba a `ol`
 * cuando el estado vacío monta `ul`, y `.chatbox__conversation-actions` no tenía
 * ninguna regla, así que la fila de confirmación salía como bloque sin separación.
 */
test.describe("Selectores de Chatbox.css ↔ markup", () => {
	test("the empty state renders its suggestions without bullets or list indent", async ({
		page,
	}) => {
		await page.goto("/?widget=embedded");
		await expect(page.locator(".chatbox__empty ul")).toBeVisible();

		await expect
			.poll(() =>
				computed(page, ".chatbox__empty ul", [
					"display",
					"list-style-type",
					"margin",
					"padding-left",
				])
			)
			.toEqual({
				display: "flex",
				"list-style-type": "none",
				margin: "0px",
				"padding-left": "0px",
			});

		// `li` como hijo de un contenedor flex: el marcador y el margen por defecto
		// son lo que aparecía sin regla propia.
		await expect
			.poll(() => computed(page, ".chatbox__empty li", ["list-style-type", "margin"]))
			.toEqual({ "list-style-type": "none", margin: "0px" });
	});

	test("the new-conversation confirmation lays the question and its buttons out in a row", async ({
		page,
	}) => {
		await page.goto("/?widget=embedded");
		await page.getByRole("button", { name: strings.actions.newConversation }).click();
		await expect(page.locator(".chatbox__conversation-actions")).toBeVisible();

		await expect
			.poll(() =>
				computed(page, ".chatbox__conversation-actions", ["display", "gap", "align-items"])
			)
			.toMatchObject({ display: "flex", gap: "8px" });

		// El síntoma visible: la pregunta se pegaba al botón. Con `gap` hay separación real.
		const question = page.locator(".chatbox__conversation-actions > span");
		const accept = page.locator(".chatbox__conversation-actions > button").first();
		const [questionBox, acceptBox] = await Promise.all([
			question.boundingBox(),
			accept.boundingBox(),
		]);
		expect(questionBox).not.toBeNull();
		expect(acceptBox).not.toBeNull();
		expect(acceptBox!.x - (questionBox!.x + questionBox!.width)).toBeGreaterThanOrEqual(8);
	});

	test("assistant markdown separates consecutive paragraphs and lists without touching sources", async ({
		page,
	}) => {
		await mockChatApi(
			page,
			sourcesFrame([], [SOURCE]),
			tokenFrame("Primer párrafo.\n\nSegundo párrafo.\n\n- Punto uno\n- Punto dos")
		);
		await page.goto("/?widget=embedded");
		await sendQuestion(page, "¿Cómo responde el asistente?");

		const assistant = page.locator(".chatbox__message--assistant");
		const paragraphs = assistant.locator("p:not(.chatbox__sources)");
		await expect(paragraphs).toHaveCount(2);
		await expect(assistant.locator("ul")).toBeVisible();
		await expect(assistant.locator(".chatbox__sources")).toBeVisible();

		await expect
			.poll(() => computedStyle(paragraphs.nth(0), ["margin-top", "margin-bottom"]))
			.toEqual({ "margin-top": "0px", "margin-bottom": "0px" });

		await expect
			.poll(() => computedStyle(paragraphs.nth(1), ["margin-top", "margin-bottom"]))
			.toEqual({ "margin-top": "8px", "margin-bottom": "0px" });

		await expect
			.poll(() =>
				computedStyle(assistant.locator("ul"), ["margin-top", "margin-bottom", "padding-left"])
			)
			.toEqual({ "margin-top": "8px", "margin-bottom": "0px", "padding-left": "20px" });

		await expect
			.poll(() => computedStyle(assistant.locator(".chatbox__sources"), ["margin-top"]))
			.toEqual({ "margin-top": "5.6px" });
	});
});

test.describe("Rediseño visual Rufus (#190)", () => {
	test("floating and drawer variants use solid surface without backdrop blur in light, dark and with host token", async ({
		page,
	}) => {
		for (const variant of ["floating", "drawer"] as const) {
			for (const theme of [
				{ name: "light", colorScheme: "light" as const, expected: "rgb(255, 255, 255)" },
				{ name: "dark", colorScheme: "dark" as const, expected: "rgb(47, 48, 56)" },
			]) {
				await page.emulateMedia({ colorScheme: theme.colorScheme });
				await page.goto(`/?widget=${variant}`);
				await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
				await expect(page.locator("#chatbox-question")).toBeVisible();

				const styles = await computed(page, ".chatbox", ["backdrop-filter", "background-color"]);
				expect(styles["backdrop-filter"], `${variant} (${theme.name})`).toBe("none");
				expect(styles["background-color"], `${variant} (${theme.name})`).toBe(theme.expected);

				await page.evaluate(() => {
					document.body.style.setProperty("--chatbox-host-surface", "rgb(240, 244, 248)");
				});
				await expect
					.poll(() => computed(page, ".chatbox", ["background-color"]), {
						message: `${variant} (${theme.name}) host token`,
					})
					.toEqual({ "background-color": "rgb(240, 244, 248)" });
			}
		}
	});

	test("header drops bottom divider, projects top scroll gradient and keeps status region above it", async ({
		page,
	}) => {
		await page.route("**/api/chat", (route) => route.fulfill({ status: 500 }));
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await page.goto("/?widget=embedded");
			await expect(page.locator(".chatbox__header")).toBeVisible();

			const headerStyles = await computed(page, ".chatbox__header", [
				"border-bottom-width",
				"border-bottom-style",
				"z-index",
			]);
			expect(headerStyles["border-bottom-width"], colorScheme).toBe("0px");
			expect(headerStyles["border-bottom-style"], colorScheme).toBe("none");

			const after = await page.locator(".chatbox__header").evaluate((element) => {
				const style = getComputedStyle(element, "::after");
				return {
					backgroundImage: style.backgroundImage,
					pointerEvents: style.pointerEvents,
					content: style.content,
				};
			});
			expect(after.content, colorScheme).not.toBe("none");
			expect(after.pointerEvents, colorScheme).toBe("none");
			expect(after.backgroundImage, colorScheme).toContain("linear-gradient");

			await sendQuestion(page);
			await expect(page.locator(".chatbox__status--error")).toBeVisible();

			const stacking = await page.evaluate(() => {
				const root = document.querySelector(".chatbox") as HTMLElement;
				const header = document.querySelector(".chatbox__header") as HTMLElement;
				const status = document.querySelector(".chatbox__status") as HTMLElement;
				const rect = status.getBoundingClientRect();
				const topElement = document.elementsFromPoint(
					rect.left + rect.width / 2,
					rect.top + rect.height / 2
				)[0];
				const statusStyle = getComputedStyle(status);
				return {
					rootBg: getComputedStyle(root).backgroundColor,
					statusBg: statusStyle.backgroundColor,
					headerZ: Number(getComputedStyle(header).zIndex),
					statusZ: Number(statusStyle.zIndex),
					topIsStatus: topElement === status,
				};
			});
			expect(stacking.statusBg, colorScheme).toBe(stacking.rootBg);
			expect(stacking.statusZ, colorScheme).toBeGreaterThan(stacking.headerZ);
			expect(stacking.topIsStatus, colorScheme).toBe(true);
		}
	});

	test("collapse button is borderless at rest, responds on hover/focus and shows border in forced colors", async ({
		page,
	}) => {
		for (const colorScheme of ["light", "dark"] as const) {
			for (const variant of ["floating", "drawer"] as const) {
				await page.emulateMedia({ colorScheme, forcedColors: "none" });
				await page.goto(`/?widget=${variant}`);
				await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
				const collapse = page.getByRole("button", { name: strings.actions.collapse.ariaLabel });
				await expect(collapse).toBeVisible();

				const box = await collapse.boundingBox();
				expect(box).not.toBeNull();
				expect(box!.width).toBeGreaterThanOrEqual(44);
				expect(box!.height).toBeGreaterThanOrEqual(44);

				const rest = await computedStyle(collapse, COLLAPSE_INTERACTIVE_PROPS);
				expect(rest["border-top-color"], `${variant} (${colorScheme})`).toBe(TRANSPARENT);
				expect(rest["background-color"], `${variant} (${colorScheme})`).toBe(TRANSPARENT);

				await collapse.hover();
				await expectVisibleFeedback(collapse, `${variant} (${colorScheme}) hover`);

				// Move pointer away before checking :focus-visible
				await page.mouse.move(0, 0);
				await page.keyboard.press("Tab");
				await collapse.focus();
				await expectVisibleFeedback(collapse, `${variant} (${colorScheme}) focus`);

				await page.emulateMedia({ colorScheme, forcedColors: "active" });
				await page.mouse.move(0, 0);
				await collapse.blur();
				const forced = await computedStyle(collapse, [
					"border-top-width",
					"border-top-style",
					"border-top-color",
				]);
				expect(forced["border-top-width"], `${variant} (${colorScheme}) forced`).toBe("1px");
				expect(forced["border-top-style"], `${variant} (${colorScheme}) forced`).toBe("solid");
				expect(forced["border-top-color"], `${variant} (${colorScheme}) forced`).not.toBe(
					TRANSPARENT
				);
			}
		}
	});

	test("messages invert hierarchy: tonal user bubble on the right, borderless assistant text on base surface", async ({
		page,
	}) => {
		await mockChatApi(
			page,
			sourcesFrame([], [SOURCE]),
			tokenFrame("Respuesta con **Markdown** y `código`.")
		);

		for (const theme of [
			{
				name: "light",
				colorScheme: "light" as const,
				subtle: "rgb(238, 237, 247)",
				text: "rgb(26, 27, 34)",
			},
			{
				name: "dark",
				colorScheme: "dark" as const,
				subtle: "rgb(58, 59, 68)",
				text: "rgb(241, 239, 250)",
			},
		]) {
			await page.emulateMedia({ colorScheme: theme.colorScheme });
			await page.goto("/?widget=embedded");
			await page.evaluate(() => sessionStorage.clear());
			await page.reload();
			await sendQuestion(page);

			const userMsg = page.locator(".chatbox__message--user");
			const assistantMsg = page.locator(".chatbox__message--assistant");
			await expect(userMsg).toBeVisible();
			await expect(assistantMsg.locator(".chatbox__sources")).toBeVisible();

			const userStyles = await computedStyle(userMsg, [
				"align-self",
				"background-color",
				"color",
				"border-top-left-radius",
				"border-top-right-radius",
				"border-bottom-left-radius",
				"border-bottom-right-radius",
				"box-shadow",
			]);
			expect(userStyles, theme.name).toEqual({
				"align-self": "flex-end",
				"background-color": theme.subtle,
				color: theme.text,
				"border-top-left-radius": "16px",
				"border-top-right-radius": "16px",
				"border-bottom-left-radius": "16px",
				"border-bottom-right-radius": "4px",
				"box-shadow": "none",
			});

			const assistantStyles = await computedStyle(assistantMsg, [
				"background-color",
				"box-shadow",
				"border-top-width",
				"padding-top",
				"padding-left",
				"color",
			]);
			expect(assistantStyles, theme.name).toEqual({
				"background-color": "rgba(0, 0, 0, 0)",
				"box-shadow": "none",
				"border-top-width": "0px",
				"padding-top": "0px",
				"padding-left": "0px",
				color: theme.text,
			});
		}
	});

	test("turns recover explicit borders and inner padding under prefers-contrast: more and forced-colors", async ({
		page,
	}) => {
		await mockChatApi(page, sourcesFrame([], [SOURCE]), tokenFrame("Respuesta clara."));
		await page.goto("/?widget=embedded");
		await sendQuestion(page);

		const userMsg = page.locator(".chatbox__message--user");
		const assistantMsg = page.locator(".chatbox__message--assistant");
		await expect(userMsg).toBeVisible();
		await expect(assistantMsg.locator(".chatbox__sources")).toBeVisible();

		for (const media of [
			{
				name: "contrast:more light",
				colorScheme: "light" as const,
				contrast: "more" as const,
				forcedColors: "none" as const,
			},
			{
				name: "contrast:more dark",
				colorScheme: "dark" as const,
				contrast: "more" as const,
				forcedColors: "none" as const,
			},
			{
				name: "forced-colors",
				colorScheme: "light" as const,
				contrast: "no-preference" as const,
				forcedColors: "active" as const,
			},
		]) {
			await page.emulateMedia({
				colorScheme: media.colorScheme,
				contrast: media.contrast,
				forcedColors: media.forcedColors,
			});

			for (const [role, locator] of [
				["user", userMsg],
				["assistant", assistantMsg],
			] as const) {
				const styles = await computedStyle(locator, [
					"border-top-width",
					"border-top-style",
					"border-top-color",
					"padding-top",
					"padding-left",
				]);
				expect(styles["border-top-width"], `${media.name} (${role})`).toBe("1px");
				expect(styles["border-top-style"], `${media.name} (${role})`).toBe("solid");
				expect(styles["border-top-color"], `${media.name} (${role})`).not.toBe("rgba(0, 0, 0, 0)");
				expect(
					Number.parseFloat(styles["padding-top"]),
					`${media.name} (${role})`
				).toBeGreaterThanOrEqual(10);
				expect(
					Number.parseFloat(styles["padding-left"]),
					`${media.name} (${role})`
				).toBeGreaterThanOrEqual(14);
			}
		}
	});

	test("suggestions render as clean pills in widget typography while technical elements keep mono", async ({
		page,
	}) => {
		await mockChatApi(page, sourcesFrame([], [SOURCE]), tokenFrame("Usa `código` en línea."));

		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await page.goto("/?widget=embedded");
			await page.evaluate(() => sessionStorage.clear());
			await page.reload();
			await expect(page.locator(".chatbox__empty ul button").first()).toBeVisible();

			// Override host font to distinguish normal widget font from monospace code font
			await page.evaluate(() => {
				document.body.style.setProperty("--chatbox-host-font", '"Georgia", serif');
			});

			await expect
				.poll(() =>
					page
						.locator(".chatbox__empty ul button")
						.first()
						.evaluate((button) => {
							const widget = document.querySelector(".chatbox") as HTMLElement;
							const before = getComputedStyle(button, "::before");
							const style = getComputedStyle(button);
							const widgetFont = getComputedStyle(widget).fontFamily;
							return {
								beforeContent: before.content,
								borderRadius: style.borderRadius,
								inheritsWidgetFont: style.fontFamily === widgetFont,
								usesHostFont: widgetFont.includes("Georgia"),
							};
						})
				)
				.toEqual({
					beforeContent: "none",
					borderRadius: "9999px",
					inheritsWidgetFont: true,
					usesHostFont: true,
				});

			await page.locator("#chatbox-question").fill("x".repeat(900));
			await expect(page.locator(".chatbox__footer small")).toBeVisible();

			const monoBeforeSend = await page.evaluate(() => ({
				badge: getComputedStyle(document.querySelector(".chatbox__badge")!).fontFamily,
				counter: getComputedStyle(document.querySelector(".chatbox__footer small")!).fontFamily,
			}));
			expect(monoBeforeSend.badge, colorScheme).toContain("monospace");
			expect(monoBeforeSend.counter, colorScheme).toContain("monospace");

			await sendQuestion(page, "¿Qué usa?");
			await expect(page.locator(".chatbox code")).toBeVisible();
			await expect(page.locator(".chatbox__sources")).toBeVisible();

			const monoAfterSend = await page.evaluate(() => ({
				code: getComputedStyle(document.querySelector(".chatbox code")!).fontFamily,
				sources: getComputedStyle(document.querySelector(".chatbox__sources")!).fontFamily,
			}));
			expect(monoAfterSend.code, colorScheme).toContain("monospace");
			expect(monoAfterSend.sources, colorScheme).toContain("monospace");
		}
	});
});
