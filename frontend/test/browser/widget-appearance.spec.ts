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
		await page.locator("#chatbox-question").fill("¿Cómo responde el asistente?");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();

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
