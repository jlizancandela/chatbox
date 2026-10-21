import { expect, type Page, test } from "@playwright/test";
import axe from "axe-core";
import { strings } from "../../src/strings.es";
import { doneFrame, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";

async function openChatbox(page: Page) {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
	await expect(page.locator("#chatbox-question")).toBeFocused();
}

async function sendByKeyboard(page: Page, question: string) {
	await page.locator("#chatbox-question").fill(question);
	await page.keyboard.press("Enter");
	await expect(page.locator(".chatbox__message--assistant").first()).toBeVisible();
}

// Marks every control inside the widget with its DOM index so Tab order can be checked.
async function markFocusables(page: Page): Promise<number> {
	return page.evaluate(() => {
		const focusables = Array.from(
			document.querySelectorAll<HTMLElement>(
				".chatbox button:not(:disabled), .chatbox textarea, .chatbox a[href]"
			)
		);
		focusables.forEach((element, index) => {
			element.dataset.kbd = String(index);
		});
		return focusables.length;
	});
}

test.describe("RF-F40 keyboard navigation", () => {
	test("Tab recorre todos los controles en orden con foco visible", async ({ page }) => {
		await openChatbox(page);
		const count = await markFocusables(page);
		expect(count).toBeGreaterThan(2);

		const readFocus = () =>
			page.evaluate(() => {
				const element = document.activeElement as HTMLElement;
				const style = getComputedStyle(element);
				return {
					index: element.dataset.kbd,
					outlineStyle: style.outlineStyle,
					outlineWidth: style.outlineWidth,
				};
			});

		// Desde el textarea (foco inicial) se retrocede hasta el primer control del widget.
		for (let step = 0; step < count; step += 1) {
			if ((await readFocus()).index === "0") break;
			await page.keyboard.press("Shift+Tab");
		}

		for (let index = 0; index < count; index += 1) {
			const focused = await readFocus();
			expect(focused.index).toBe(String(index));
			expect(focused.outlineStyle).toBe("solid");
			expect(focused.outlineWidth).toBe("2px");
			await page.keyboard.press("Tab");
		}
	});

	test("tras enviar con Enter el foco queda en el campo de texto", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta breve."));
		await openChatbox(page);
		await sendByKeyboard(page, "¿Qué experiencia tiene Jorge?");
		await expect(page.locator("#chatbox-question")).toBeFocused();
	});

	test("tras enviar con el botón el foco queda en el campo de texto", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta breve."));
		await openChatbox(page);
		await page.locator("#chatbox-question").fill("¿Qué stack usa?");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Enter");
		await expect(page.locator(".chatbox__message--assistant").first()).toBeVisible();
		await expect(page.locator("#chatbox-question")).toBeFocused();
	});

	test("tras enviar una sugerencia el foco queda en el campo de texto", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta breve."));
		await openChatbox(page);
		const suggestion = page.getByRole("navigation", {
			name: strings.a11y.emptyStateNavLabel,
		});
		await suggestion.getByRole("button").first().focus();
		await page.keyboard.press("Enter");
		await expect(page.locator(".chatbox__message--assistant").first()).toBeVisible();
		await expect(page.locator("#chatbox-question")).toBeFocused();
	});

	test("confirmación de nueva conversación gestiona el foco por teclado", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta breve."));
		await openChatbox(page);
		await sendByKeyboard(page, "¿Qué sabes de Jorge?");

		const newConversation = page.getByRole("button", {
			name: strings.actions.newConversation,
		});
		await newConversation.focus();
		await page.keyboard.press("Enter");

		const cancel = page.getByRole("button", { name: strings.actions.confirm.cancel });
		await expect(cancel).toBeFocused();

		await page.keyboard.press("Enter");
		await expect(newConversation).toBeFocused();

		await page.keyboard.press("Enter");
		await expect(cancel).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(page.getByRole("button", { name: strings.actions.confirm.accept })).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator("#chatbox-question")).toBeFocused();
		await expect(page.locator(".chatbox__message")).toHaveCount(0);
	});

	test("Enter durante una respuesta no la cancela", async ({ page }) => {
		let releaseStream: () => void = () => {};
		const released = new Promise<void>((resolve) => {
			releaseStream = resolve;
		});
		await page.route("**/api/chat", async (route) => {
			await released;
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: sourcesFrame() + tokenFrame("Respuesta completa.") + doneFrame,
			});
		});
		await openChatbox(page);
		await page.locator("#chatbox-question").fill("¿Qué proyectos tiene?");
		await page.keyboard.press("Enter");

		const stop = page.getByRole("button", { name: strings.input.stop.ariaLabel });
		await expect(stop).toBeVisible();
		await page.locator("#chatbox-question").fill("segunda pregunta");
		await page.keyboard.press("Enter");

		releaseStream();
		await expect(page.locator(".chatbox__message--assistant").first()).toContainText(
			"Respuesta completa."
		);
		await expect(page.getByRole("button", { name: strings.input.send.ariaLabel })).toBeVisible();
	});

	test("'Ir al final' aparece después del último mensaje en el orden de Tab", async ({ page }) => {
		const longAnswer = Array.from({ length: 60 }, (_, i) => `Párrafo ${i + 1}.`).join("\n\n");
		await mockChatApi(page, tokenFrame(longAnswer));
		await openChatbox(page);
		await page.addStyleTag({ content: ".chatbox { height: 400px; }" });
		await sendByKeyboard(page, "¿Qué has hecho?");

		const overflow = await page.locator(".chatbox__conversation").evaluate((element) => ({
			scrollHeight: element.scrollHeight,
			clientHeight: element.clientHeight,
		}));
		expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

		await page.locator(".chatbox__conversation").evaluate((element) => {
			element.scrollTop = 0;
			element.dispatchEvent(new Event("scroll"));
		});
		const scrollToEnd = page.getByRole("button", { name: strings.actions.scrollToEnd });
		await expect(scrollToEnd).toBeVisible();

		const followsLastMessage = await scrollToEnd.evaluate((button) => {
			const messages = document.querySelectorAll(".chatbox__message");
			const last = messages[messages.length - 1];
			return Boolean(last.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
		});
		expect(followsLastMessage).toBe(true);
	});

	test("the widget has no axe violations with a conversation and confirmation open", async ({
		page,
	}) => {
		await mockChatApi(page, tokenFrame("Respuesta breve."));
		await openChatbox(page);
		await sendByKeyboard(page, "¿Qué experiencia tiene?");
		await page.getByRole("button", { name: strings.actions.newConversation }).click();

		await page.addScriptTag({ content: axe.source });
		const results = await page.evaluate(async () => {
			return (window as unknown as Window & { axe: typeof axe }).axe.run(
				document.querySelector(".chatbox") as HTMLElement,
				{ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }
			);
		});
		expect(results.violations).toEqual([]);
	});
});
