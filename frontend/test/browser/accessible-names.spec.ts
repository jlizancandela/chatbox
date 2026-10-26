/**
 * RF-F45 — los nombres accesibles resueltos en un navegador real.
 *
 * Nivel de verificación: **resolución**. El nombre accesible de un control no lo decide el
 * código: lo computa el navegador, con sus reglas de nombre desde el contenido, desde
 * `aria-label` y desde la etiqueta asociada. Este nivel pregunta al árbol de accesibilidad real;
 * el nivel de mecanismo (`test/unit/chatbox-accessible-names.test.ts`) mira el código, que es
 * donde el nombre se puede perder sin que nadie lo note.
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { type NameState, WIDGET_LANGUAGE } from "../accessible-names";
import { mockChatApi, tokenFrame } from "../chat-frames";

/** Los controles del widget que necesitan nombre accesible. */
const CONTROL_SELECTOR = ".chatbox button, .chatbox textarea, .chatbox a[href]";

/**
 * El nombre accesible que el navegador le da a un control.
 *
 * Se lee del árbol de accesibilidad: `ariaSnapshot()` devuelve el nodo como lo ve el
 *Accessibility Tree, con el rol y el nombre ya computados. Un control sin nombre aparece
 * como `- button` a secas, y uno que no está en el árbol (porque es `aria-hidden`) no
 * devuelve nada: las dos formas de quedarse mudo se distinguen así.
 */
function accessibleNameOf(snapshot: string): string | null {
	const match = /^\s*-\s*[a-z]+\s+"([^"]*)"/.exec(snapshot);
	return match ? match[1] : null;
}

/** El texto visible del control: lo que la persona ve, que no es lo mismo que su nombre. */
async function visibleTextOf(control: Locator): Promise<string> {
	return ((await control.textContent()) ?? "").trim();
}

/**
 * Todo control del widget tiene nombre accesible.
 *
 * El nombre se pide al navegador, control por control, y en el estado en que el control
 * aparece: un botón que solo existe con la confirmación abierta también tiene que nombrarse
 * con ella abierta.
 */
async function assertEveryControlIsNamed(page: Page, state: NameState): Promise<void> {
	const controls = page.locator(CONTROL_SELECTOR);
	const count = await controls.count();
	expect(count, `sin controles en el estado: ${state}`).toBeGreaterThan(0);

	for (let index = 0; index < count; index += 1) {
		const control = controls.nth(index);
		const identity =
			(await control.getAttribute("data-chatbox-control")) ?? "control sin identidad";
		const tag = await control.evaluate((element) => element.tagName.toLowerCase());
		const snapshot = (await control.ariaSnapshot()) ?? "";
		const name = accessibleNameOf(snapshot);

		expect(
			name,
			`${identity} (${state}) no tiene nombre accesible: ${JSON.stringify(snapshot)}`
		).not.toBeNull();
		expect(name, `${identity} (${state}) tiene el nombre accesible vacío`).not.toBe("");

		// R3: un botón sin texto visible se nombra con `aria-label` (o con `aria-labelledby`,
		// que nombra lo mismo por otra vía). Sin texto no hay de dónde sacar el nombre, así
		// que tiene que declararlo. Los campos no entran aquí: los nombra su etiqueta.
		if (tag === "button" && (await visibleTextOf(control)) === "") {
			const declared =
				(await control.getAttribute("aria-label")) ??
				(await control.getAttribute("aria-labelledby"));
			expect(
				declared,
				`${identity} (${state}) no tiene texto visible y necesita \`aria-label\``
			).toBeTruthy();
		}
	}
}

async function openChatbox(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
}

test("el widget declara el idioma del componente", async ({ page }) => {
	await openChatbox(page);

	// El idioma efectivo del widget: el `lang` que declara el propio componente, no el que
	// hereda del sitio host. Si el widget dejara de declararlo, el nombre accesible se
	// pronunciaría con la fonética del idioma del host.
	const effective = await page.evaluate(() => {
		const root = document.querySelector(".chatbox");
		if (!root) return null;
		return root.closest("[lang]")?.getAttribute("lang") ?? null;
	});

	expect(effective).toBe(WIDGET_LANGUAGE);
});

test("el campo de texto se nombra con su etiqueta", async ({ page }) => {
	await openChatbox(page);

	const field = page.locator("#chatbox-question");
	const snapshot = (await field.ariaSnapshot()) ?? "";

	// El nombre accesible del campo es el texto de su etiqueta: es la resolución de la
	// asociación, no la presencia del atributo `for`.
	expect(accessibleNameOf(snapshot)).toBe(strings.input.label);
});

test("todo control del estado vacío tiene nombre", async ({ page }) => {
	await openChatbox(page);

	await assertEveryControlIsNamed(page, "vacío");

	// El estado vacío tiene los controles que no aparecen en ningún otro: sin ellos, la
	// comprobación de arriba se conformaría con el botón de enviar.
	const identities = await page
		.locator(CONTROL_SELECTOR)
		.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("data-chatbox-control"))
		);
	expect(identities).toContain("suggestion");
	expect(identities).toContain("new-conversation");
});

test("los controles con el campo lleno y durante el turno tienen nombre", async ({ page }) => {
	// La petición se queda en el aire: el turno queda en curso sin depender de cuánto tarda
	// el stream en terminar.
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/chat", async (route) => {
		await held;
		await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
	});

	await openChatbox(page);
	await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");

	await assertEveryControlIsNamed(page, "campo lleno");

	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
	await expect(page.locator(".chatbox__status")).toContainText(strings.messages.writing);

	await assertEveryControlIsNamed(page, "turno en curso");

	// Durante el turno el botón de enviar es el de detener: es otro control con otro nombre.
	await expect(page.getByRole("button", { name: strings.input.stop.ariaLabel })).toBeVisible();

	release();
});

test("los controles de la confirmación tienen nombre", async ({ page }) => {
	await openChatbox(page);
	await page.getByRole("button", { name: strings.actions.newConversation }).click();
	await expect(page.locator(".chatbox__conversation-actions")).toBeVisible();

	await assertEveryControlIsNamed(page, "confirmación abierta");

	const identities = await page
		.locator(CONTROL_SELECTOR)
		.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("data-chatbox-control"))
		);
	expect(identities).toContain("confirm-accept");
	expect(identities).toContain("confirm-cancel");
});

test.describe("con una conversación larga", () => {
	test.use({ viewport: { width: 420, height: 520 } });

	test("«Ir al final» tiene nombre cuando aparece", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		const answer = Array.from({ length: 120 }, (_, index) => `palabra${index} `).join("");
		await mockChatApi(page, ...[answer].map((text) => tokenFrame(text)));

		await openChatbox(page);
		await page.locator("#chatbox-question").fill("Cuéntame algo largo");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra119");

		// Precondición, no decoración: si la conversación no se desplaza, el botón no aparece
		// y el test pasaría sin haber comprobado nada.
		const scrollable = await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			return conversation !== null && conversation.scrollHeight > conversation.clientHeight;
		});
		expect(scrollable, "la conversación debería ser desplazable").toBe(true);

		await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			if (conversation) conversation.scrollTop = 0;
		});
		await expect(page.locator('[data-chatbox-control="scroll-to-end"]')).toBeVisible();

		await assertEveryControlIsNamed(page, "desplazado");
	});
});
