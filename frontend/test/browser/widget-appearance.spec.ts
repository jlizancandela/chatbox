import { expect, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

type Page = import("@playwright/test").Page;

const computed = (page: Page, selector: string, properties: string[]) =>
	page
		.locator(selector)
		.first()
		.evaluate((element, props) => {
			const style = getComputedStyle(element as Element);
			return Object.fromEntries(
				(props as string[]).map((property) => [property, style.getPropertyValue(property)])
			);
		}, properties);

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
		await page.goto("/");
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
		await page.goto("/");
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
});
