/**
 * RF-F45 — los nombres accesibles resueltos en un navegador real.
 *
 * Nivel de verificación: **resolución**. El nombre accesible de un control no lo decide el
 * código: lo computa el navegador, con sus reglas de nombre desde el contenido, desde
 * `aria-label` y desde la etiqueta asociada. Este nivel pregunta al árbol de accesibilidad real;
 * el nivel de mecanismo (`test/unit/chatbox-accessible-names.test.ts`) mira el código, que es
 * donde el nombre se puede perder sin que nadie lo note.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { NAME_STATES, type NameState, ROOT_CLASS, WIDGET_LANGUAGE } from "../accessible-names";
import { mockChatApi, tokenFrame } from "../chat-frames";
import { CONTROL_ATTRIBUTE } from "../touch-targets";

/**
 * Los controles del widget que necesitan nombre accesible.
 *
 * La clase del widget y la identidad de control vienen del contrato: dos definiciones que
 * divergen son dos contratos.
 */
const CONTROL_SELECTOR = [
	`.${ROOT_CLASS} button`,
	`.${ROOT_CLASS} textarea`,
	`.${ROOT_CLASS} a`,
	`.${ROOT_CLASS} [role="button"]`,
].join(", ");

/**
 * El nombre accesible que el navegador le da a un control.
 *
 * Se lee del árbol de accesibilidad: `ariaSnapshot()` devuelve el nodo como lo ve el
 * Accessibility Tree, con el rol y el nombre ya computados. Un control sin nombre aparece
 * como `- button` a secas, y uno que no está en el árbol —porque es `aria-hidden`— no
 * devuelve nada: las dos formas de quedarse mudo se distinguen así.
 */
function accessibleNameOf(snapshot: string): string | null {
	const match = /^\s*-\s*[a-z]+\s+"([^"]*)"/.exec(snapshot);
	return match ? match[1] : null;
}

/** La identidad de cada control del widget, para saber cuál se quedó sin nombre. */
async function identitiesOf(page: Page): Promise<string[]> {
	return page
		.locator(CONTROL_SELECTOR)
		.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("data-chatbox-control") ?? "sin identidad")
		);
}

/**
 * Los controles que el navegador deja sin nombre.
 *
 * La lista vacía es el resultado bueno; el nombre de un control sin nombre es lo que dice
 * el informe cuando algo se rompe.
 */
async function unnamedControls(page: Page): Promise<string[]> {
	const controls = page.locator(CONTROL_SELECTOR);
	const count = await controls.count();
	const unnamed: string[] = [];

	for (let index = 0; index < count; index += 1) {
		const control = controls.nth(index);
		const snapshot = (await control.ariaSnapshot()) ?? "";
		if (accessibleNameOf(snapshot) !== null) continue;
		unnamed.push((await control.getAttribute(CONTROL_ATTRIBUTE)) ?? `control ${index}`);
	}

	return unnamed;
}

async function openChatbox(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.locator(`.${ROOT_CLASS}`)).toBeVisible();
}

/** Deja la petición en el aire: el turno queda en curso sin depender del stream. */
async function holdTheTurn(page: Page): Promise<void> {
	const held = new Promise<void>(() => {});
	await page.route("**/api/chat", async (route) => {
		await held;
		await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
	});
}

/**
 * Cómo se deja el widget en cada estado del contrato.
 *
 * La clave es del tipo `NameState`: añadir un estado al contrato rompe la compilación hasta
 * que exista su escenario. Sin esto, el contrato declararía estados que nadie comprueba.
 */
const SETUP: Record<NameState, (page: Page) => Promise<void>> = {
	vacío: async (page) => {
		await openChatbox(page);
	},
	"campo lleno": async (page) => {
		await openChatbox(page);
		await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");
	},
	"turno en curso": async (page) => {
		await holdTheTurn(page);
		await openChatbox(page);
		await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		await expect(page.locator(".chatbox__status")).toContainText(strings.messages.writing);
	},
	"confirmación abierta": async (page) => {
		await openChatbox(page);
		await page.getByRole("button", { name: strings.actions.newConversation }).click();
		await expect(page.locator(".chatbox__conversation-actions")).toBeVisible();
	},
	desplazado: async (page) => {
		// Con movimiento reducido el scroll es instantáneo: el botón «Ir al final» no se
		// mueve mientras el test lo busca.
		await page.emulateMedia({ reducedMotion: "reduce" });
		const answer = Array.from({ length: 120 }, (_, index) => `palabra${index} `).join("");
		await mockChatApi(page, ...[answer].map((text) => tokenFrame(text)));

		await openChatbox(page);
		await page.locator("#chatbox-question").fill("Cuéntame algo largo");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra119");

		// Precondición, no decoración: si la conversación no se desplaza, el botón no
		// aparece y el test pasaría sin haber comprobado nada.
		const scrollable = await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			return conversation !== null && conversation.scrollHeight > conversation.clientHeight;
		});
		expect(scrollable, "la conversación debería ser desplazable").toBe(true);

		await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			if (!conversation) return;
			conversation.scrollTop = 0;
			conversation.dispatchEvent(new Event("scroll"));
		});
		await expect(page.locator(`[${CONTROL_ATTRIBUTE}="scroll-to-end"]`)).toBeVisible();
	},
};

/** El escenario de un estado del contrato. */
const setupOf = (state: NameState): ((page: Page) => Promise<void>) => SETUP[state];

test.describe("RF-F45 — los nombres accesibles del widget", () => {
	test.use({ viewport: { width: 420, height: 520 } });

	for (const state of NAME_STATES) {
		test(`todo control tiene nombre en el estado «${state}»`, async ({ page }) => {
			await SETUP[state](page);

			const unnamed = await unnamedControls(page);
			expect(unnamed, `controles sin nombre accesible en el estado «${state}»`).toEqual([]);
		});
	}

	test("el widget declara su idioma, no lo hereda", async ({ page }) => {
		await openChatbox(page);

		// El idioma efectivo del widget: el `lang` más cercano en el árbol. Tiene que ser el
		// propio widget —si el `lang` se quitara, el más cercano sería el del sitio host— y
		// tiene que ser el del widget, no el del host.
		const declaration = await page.evaluate((rootClass) => {
			const root = document.querySelector(rootClass);
			if (!root) return null;
			const owner = root.closest("[lang]");
			return {
				declaredByRoot: owner === root,
				language: root.getAttribute("lang"),
			};
		}, `.${ROOT_CLASS}`);

		expect(declaration).toEqual({ declaredByRoot: true, language: WIDGET_LANGUAGE });
	});

	test("el campo de texto se nombra con su etiqueta", async ({ page }) => {
		await openChatbox(page);

		const field = page.locator("#chatbox-question");
		const snapshot = (await field.ariaSnapshot()) ?? "";

		// El nombre accesible del campo es el texto de su etiqueta: es la resolución de la
		// asociación, no la presencia del atributo `for`.
		expect(accessibleNameOf(snapshot)).toBe(strings.input.label);
	});

	test("un botón solo-icono sin nombre se detecta", async ({ page }) => {
		// La entrada que rechaza: sin ella, la comprobación de arriba pasaría con un widget
		// lleno de botones mudos. El botón se inyecta en el DOM porque el widget no tiene
		// ninguno: el caso es el que el contrato tiene que vigilar.
		await openChatbox(page);
		await page.evaluate((rootClass) => {
			const root = document.querySelector(rootClass);
			if (!root) return;
			const button = document.createElement("button");
			button.type = "button";
			button.setAttribute("data-chatbox-control", "sin-nombre");
			const icon = document.createElement("span");
			icon.setAttribute("aria-hidden", "true");
			icon.textContent = "×";
			button.append(icon);
			root.append(button);
		}, `.${ROOT_CLASS}`);

		const unnamed = await unnamedControls(page);
		expect(unnamed).toContain("sin-nombre");
	});

	test("el estado vacío trae los controles que solo existen ahí", async ({ page }) => {
		await setupOf("vacío")(page);

		const identities = await identitiesOf(page);
		expect(identities).toContain("suggestion");
		expect(identities).toContain("new-conversation");
	});

	test("la confirmación abierta trae sus dos botones", async ({ page }) => {
		await setupOf("confirmación abierta")(page);

		const identities = await identitiesOf(page);
		expect(identities).toContain("confirm-accept");
		expect(identities).toContain("confirm-cancel");
	});
});
