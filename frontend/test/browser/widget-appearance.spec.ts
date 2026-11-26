import { expect, type Locator, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { holdChatAnswer, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";
import { contrastRatio, isTransparent } from "../contrast";

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

test.describe("Compositor flotante y pie ligero (#191)", () => {
	test("footer drops top border and projects bottom fade gradient without blocking clicks", async ({
		page,
	}) => {
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await page.goto("/?widget=embedded");
			await expect(page.locator(".chatbox__footer")).toBeVisible();

			const footerStyles = await computed(page, ".chatbox__footer", [
				"border-top-width",
				"border-top-style",
				"pointer-events",
			]);
			expect(footerStyles["border-top-width"], colorScheme).toBe("0px");
			expect(footerStyles["border-top-style"], colorScheme).toBe("none");
			expect(footerStyles["pointer-events"], colorScheme).toBe("none");

			const formPointerEvents = await computed(page, ".chatbox__footer form", ["pointer-events"]);
			expect(formPointerEvents["pointer-events"], colorScheme).toBe("auto");

			const before = await page.locator(".chatbox__footer").evaluate((element) => {
				const style = getComputedStyle(element, "::before");
				return {
					content: style.content,
					pointerEvents: style.pointerEvents,
					backgroundImage: style.backgroundImage,
				};
			});
			expect(before.content, colorScheme).not.toBe("none");
			expect(before.pointerEvents, colorScheme).toBe("none");
			expect(before.backgroundImage, colorScheme).toContain("linear-gradient");
		}
	});

	test("floating composer hides label visually, keeps accessible name and 16px floor, and reserves space for circular send/stop button", async ({
		page,
	}) => {
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			await page.goto("/?widget=embedded");
			await page.evaluate(() => sessionStorage.clear());
			await page.reload();

			const field = page.locator("#chatbox-question");
			const label = page.locator('.chatbox__footer label[for="chatbox-question"]');
			const submit = page.locator('.chatbox__footer button[type="submit"]');
			await expect(field).toBeVisible();

			const labelBox = await label.boundingBox();
			expect(labelBox, colorScheme).not.toBeNull();
			expect(labelBox!.width, colorScheme).toBeLessThanOrEqual(1);
			expect(labelBox!.height, colorScheme).toBeLessThanOrEqual(1);
			expect(await field.ariaSnapshot(), colorScheme).toContain(strings.input.label);

			await page.addStyleTag({ content: "html { font-size: 14px; }" });
			const fieldStyles = await computedStyle(field, [
				"box-shadow",
				"border-top-left-radius",
				"font-size",
				"padding-right",
			]);
			expect(fieldStyles["box-shadow"], colorScheme).not.toBe("none");
			expect(
				Number.parseFloat(fieldStyles["border-top-left-radius"]),
				colorScheme
			).toBeGreaterThanOrEqual(16);
			expect(Number.parseFloat(fieldStyles["font-size"]), colorScheme).toBeGreaterThanOrEqual(16);

			const assertEmbeddedWithoutOverlap = async (labelTag: string) => {
				const geometry = await page.evaluate(() => {
					const textarea = document.querySelector("#chatbox-question") as HTMLElement;
					const button = document.querySelector(
						'.chatbox__footer button[type="submit"]'
					) as HTMLElement;
					const textareaRect = textarea.getBoundingClientRect();
					const buttonRect = button.getBoundingClientRect();
					const paddingRight = Number.parseFloat(getComputedStyle(textarea).paddingRight);
					return {
						textareaRect,
						buttonRect,
						textRightEdge: textareaRect.left + textareaRect.width - paddingRight,
					};
				});
				expect(Math.round(geometry.buttonRect.width), labelTag).toBe(44);
				expect(Math.round(geometry.buttonRect.height), labelTag).toBe(44);
				expect(geometry.buttonRect.left, labelTag).toBeGreaterThanOrEqual(
					geometry.textareaRect.left
				);
				expect(geometry.buttonRect.right, labelTag).toBeLessThanOrEqual(
					geometry.textareaRect.right
				);
				expect(geometry.buttonRect.top, labelTag).toBeGreaterThanOrEqual(geometry.textareaRect.top);
				expect(geometry.buttonRect.bottom, labelTag).toBeLessThanOrEqual(
					geometry.textareaRect.bottom
				);
				expect(geometry.textRightEdge, labelTag).toBeLessThanOrEqual(geometry.buttonRect.left);
			};

			await field.fill("Una línea corta");
			await assertEmbeddedWithoutOverlap(`${colorScheme} single-line`);

			await field.fill("Línea 1\nLínea 2\nLínea 3\nLínea 4");
			await assertEmbeddedWithoutOverlap(`${colorScheme} multi-line`);

			// Tab desde el campo va inmediatamente al botón Enviar con anillo reglamentario
			await field.focus();
			await page.keyboard.press("Tab");
			await expect(submit).toBeFocused();
			const focusRing = await computedStyle(submit, [
				"outline-style",
				"outline-width",
				"outline-offset",
			]);
			expect(focusRing["outline-style"], colorScheme).toBe("solid");
			expect(focusRing["outline-width"], colorScheme).toBe("2px");
			expect(focusRing["outline-offset"], colorScheme).toBe("2px");

			const sendIconPath = await submit.locator("svg.chatbox__icon path").getAttribute("d");
			const sendRadius = await computedStyle(submit, ["border-radius"]);
			expect(sendRadius["border-radius"], colorScheme).toBe("9999px");

			const release = await holdChatAnswer(page, tokenFrame("Respuesta"));
			await submit.click();

			const stopButton = page.getByRole("button", { name: strings.input.stop.ariaLabel });
			await expect(stopButton).toBeVisible();
			const stopIconPath = await stopButton.locator("svg.chatbox__icon path").getAttribute("d");
			expect(stopIconPath, colorScheme).not.toBe(sendIconPath);

			const stopBox = await stopButton.boundingBox();
			expect(Math.round(stopBox!.width), colorScheme).toBe(44);
			expect(Math.round(stopBox!.height), colorScheme).toBe(44);

			const stopColors = await computedStyle(stopButton, ["color", "background-color"]);
			expect(
				contrastRatio(stopColors.color, stopColors["background-color"]),
				`${colorScheme} stop contrast`
			).toBeGreaterThanOrEqual(4.5);

			release();
			await expect(page.locator(".chatbox__message--assistant")).toContainText("Respuesta");
			await page.unroute("**/api/chat");
		}
	});

	test("secondary footer row groups new conversation and contact link cleanly across viewports and high-contrast modes", async ({
		page,
	}) => {
		for (const colorScheme of ["light", "dark"] as const) {
			for (const viewport of [
				{ name: "desktop", width: 420, height: 640 },
				{ name: "narrow", width: 360, height: 640 },
			]) {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await page.emulateMedia({
					colorScheme,
					contrast: "no-preference",
					forcedColors: "none",
				});
				await page.goto("/?widget=embedded&contact=mailto:jorge@example.com");

				const field = page.locator("#chatbox-question");
				const secondary = page.locator(".chatbox__footer-secondary");
				const newConv = secondary.getByRole("button", { name: strings.actions.newConversation });
				const contact = secondary.getByRole("link", { name: strings.input.contactLink });
				await expect(newConv).toBeVisible();
				await expect(contact).toBeVisible();

				const [fieldBox, newConvBox, contactBox, widgetBox] = await Promise.all([
					field.boundingBox(),
					newConv.boundingBox(),
					contact.boundingBox(),
					page.locator(".chatbox").boundingBox(),
				]);
				expect(newConvBox!.y, `${colorScheme} ${viewport.name}`).toBeGreaterThan(
					fieldBox!.y + fieldBox!.height
				);
				expect(contactBox!.y, `${colorScheme} ${viewport.name}`).toBeGreaterThan(
					fieldBox!.y + fieldBox!.height
				);
				expect(newConvBox!.width, `${colorScheme} ${viewport.name}`).toBeGreaterThanOrEqual(44);
				expect(newConvBox!.height, `${colorScheme} ${viewport.name}`).toBeGreaterThanOrEqual(44);
				expect(
					newConvBox!.x + newConvBox!.width,
					`${colorScheme} ${viewport.name}`
				).toBeLessThanOrEqual(contactBox!.x);
				expect(
					contactBox!.x + contactBox!.width,
					`${colorScheme} ${viewport.name}`
				).toBeLessThanOrEqual(widgetBox!.x + widgetBox!.width);

				// Orden de Tab: campo -> submit -> nueva conversación -> contactar
				await field.fill("Pregunta");
				await field.focus();
				await page.keyboard.press("Tab");
				await expect(page.locator('.chatbox__footer button[type="submit"]')).toBeFocused();
				await page.keyboard.press("Tab");
				await expect(newConv).toBeFocused();
				await page.keyboard.press("Tab");
				await expect(contact).toBeFocused();

				// Confirmación en línea conserva botones >= 44px junto al enlace
				await newConv.click();
				const accept = secondary.getByRole("button", { name: strings.actions.confirm.accept });
				const cancel = secondary.getByRole("button", { name: strings.actions.confirm.cancel });
				await expect(accept).toBeVisible();
				await expect(cancel).toBeVisible();
				const [acceptBox, cancelBox] = await Promise.all([
					accept.boundingBox(),
					cancel.boundingBox(),
				]);
				expect(acceptBox!.height).toBeGreaterThanOrEqual(44);
				expect(cancelBox!.height).toBeGreaterThanOrEqual(44);
				await cancel.click();
			}

			// En reposo el botón es discreto sin borde; en alto contraste y colores forzados recupera borde
			const newConv = page
				.locator(".chatbox__footer-secondary")
				.getByRole("button", { name: strings.actions.newConversation });
			const restStyles = await computedStyle(newConv, ["border-top-width", "background-color"]);
			expect(restStyles["border-top-width"], `${colorScheme} rest`).toBe("0px");
			expect(isTransparent(restStyles["background-color"]), `${colorScheme} rest`).toBe(true);

			for (const media of [
				{ name: "contrast:more", contrast: "more" as const, forcedColors: "none" as const },
				{
					name: "forced-colors",
					contrast: "no-preference" as const,
					forcedColors: "active" as const,
				},
			]) {
				await page.emulateMedia({
					colorScheme,
					contrast: media.contrast,
					forcedColors: media.forcedColors,
				});
				const accessibleStyles = await computedStyle(newConv, [
					"border-top-width",
					"border-top-style",
				]);
				expect(accessibleStyles["border-top-width"], `${colorScheme} ${media.name}`).toBe("1px");
				expect(accessibleStyles["border-top-style"], `${colorScheme} ${media.name}`).toBe("solid");
			}
		}
	});

	test("scroll-to-end appears as a floating 44x44 icon-only circle above the footer fade", async ({
		page,
	}) => {
		const longAnswer = Array.from({ length: 140 }, (_, index) => `palabra${index}`).join(" ");
		await page.setViewportSize({ width: 420, height: 520 });

		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
			await mockChatApi(page, sourcesFrame(), tokenFrame(longAnswer));
			await page.goto("/?widget=embedded");
			await page.evaluate(() => sessionStorage.clear());
			await page.reload();

			await sendQuestion(page, "Cuéntame algo largo");
			await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra139");

			await page.evaluate(() => {
				const conversation = document.querySelector(".chatbox__conversation") as HTMLElement;
				conversation.scrollTop = 0;
				conversation.dispatchEvent(new Event("scroll"));
			});

			const scrollBtn = page.getByRole("button", { name: strings.actions.scrollToEnd });
			await expect(scrollBtn).toBeVisible();

			const details = await page.evaluate(() => {
				const button = document.querySelector(
					'[data-chatbox-control="scroll-to-end"]'
				) as HTMLElement;
				const footer = document.querySelector(".chatbox__footer") as HTMLElement;
				const icon = button.querySelector("svg.chatbox__icon");
				const clone = button.cloneNode(true) as Element;
				for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
				const btnRect = button.getBoundingClientRect();
				const footerRect = footer.getBoundingClientRect();
				const style = getComputedStyle(button);
				const centerHits = document.elementsFromPoint(
					btnRect.left + btnRect.width / 2,
					btnRect.top + btnRect.height / 2
				);
				return {
					width: btnRect.width,
					height: btnRect.height,
					borderRadius: style.borderRadius,
					boxShadow: style.boxShadow,
					visibleText: (clone.textContent ?? "").trim(),
					iconHidden: icon?.getAttribute("aria-hidden"),
					buttonBottom: btnRect.bottom,
					footerTop: footerRect.top,
					centerClickable: button.contains(centerHits[0]),
				};
			});

			expect(Math.round(details.width), colorScheme).toBe(44);
			expect(Math.round(details.height), colorScheme).toBe(44);
			expect(details.borderRadius, colorScheme).toBe("9999px");
			expect(details.boxShadow, colorScheme).not.toBe("none");
			expect(details.visibleText, colorScheme).toBe("");
			expect(details.iconHidden, colorScheme).toBe("true");
			expect(details.buttonBottom, colorScheme).toBeLessThanOrEqual(details.footerTop + 1);
			expect(details.centerClickable, colorScheme).toBe(true);

			await page.emulateMedia({ colorScheme, reducedMotion: "reduce", forcedColors: "active" });
			const forcedBorder = await computedStyle(scrollBtn, ["border-top-width", "border-top-style"]);
			expect(forcedBorder["border-top-width"], `${colorScheme} forced`).toBe("1px");
			expect(forcedBorder["border-top-style"], `${colorScheme} forced`).toBe("solid");
			await page.emulateMedia({ colorScheme, reducedMotion: "reduce", forcedColors: "none" });

			await scrollBtn.click();
			await expect(scrollBtn).toBeHidden();
			await page.unroute("**/api/chat");
		}
	});
});
