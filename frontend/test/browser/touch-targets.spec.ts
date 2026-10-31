/**
 * RF-F43 — los objetivos táctiles resueltos en un navegador real (issue #98).
 *
 * Nivel de verificación: **resolución**. Mide la caja que el navegador le da a cada control
 * del inventario, en cada estado en que aparece. El nivel de mecanismo
 * (`test/unit/chatbox-touch-targets.test.ts`) afirma el suelo declarado y que el inventario
 * está completo; este afirma el tamaño de verdad.
 * Ver `docs/decisions/007-objetivos-tactiles.md`.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { doneFrame, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";
import {
	CONTROL_ATTRIBUTE,
	CONTROL_IDS,
	CONTROLS,
	EXEMPT,
	TOUCH_TARGET_PX,
	type WidgetState,
} from "../touch-targets";

type Measured = { id: string; width: number; height: number; disabled: boolean };

/** La caja de cada elemento del widget que declara una identidad de control. */
async function measureControls(page: Page): Promise<Measured[]> {
	return page.evaluate((attribute) => {
		const round = (value: number): number => Math.round(value * 100) / 100;
		return Array.from(document.querySelectorAll(`[${attribute}]`)).map((element) => {
			const box = element.getBoundingClientRect();
			return {
				id: element.getAttribute(attribute) ?? "",
				width: round(box.width),
				height: round(box.height),
				disabled: (element as HTMLButtonElement).disabled === true,
			};
		});
	}, CONTROL_ATTRIBUTE);
}

/**
 * Los controles que el contrato mide.
 *
 * Un elemento que lleva identidad y no está en el inventario tiene que estar exento con su
 * motivo: si no, alguien ha añadido un control al markup y ha decidido por su cuenta que no
 * se mide.
 */
function contractControls(measured: Measured[]): Measured[] {
	for (const { id } of measured) {
		if (!CONTROL_IDS.has(id)) {
			expect(EXEMPT[id], `«${id}» lleva identidad y no está exento con su motivo`).toBeTruthy();
		}
	}
	return measured.filter((control) => CONTROL_IDS.has(control.id));
}

/** Un control deshabilitado está exento: WCAG 2.5.8 no le exige objetivo táctil. */
function activeControls(controls: Measured[]): Measured[] {
	return controls.filter((control) => !control.disabled);
}

function assertFloor(measured: Measured[], state: WidgetState): void {
	const active = activeControls(contractControls(measured));
	expect(active.length, `sin controles del contrato en el estado: ${state}`).toBeGreaterThan(0);
	for (const control of active) {
		const declared = CONTROLS.find((candidate) => candidate.id === control.id);
		// El inventario dice en qué estados se mide cada control. Si aquí aparece uno que no
		// declara su estado, se está midiendo en un escenario que el contrato no cubre: o
		// el inventario se queda corto, o el escenario AssertFloor se ha equivocado de estado.
		expect(
			declared?.states,
			`${control.id} está activo en el estado «${state}» y el inventario no lo declara`
		).toContain(state);
		expect(
			control.width,
			`${declared?.name ?? control.id} (${state}): ${control.width}px de ancho, el suelo es ${TOUCH_TARGET_PX}px`
		).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
		expect(
			control.height,
			`${declared?.name ?? control.id} (${state}): ${control.height}px de alto, el suelo es ${TOUCH_TARGET_PX}px`
		).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
	}
}

test("los controles del estado vacío alcanzan el suelo", async ({ page }) => {
	await page.goto("/?widget=embedded");
	await expect(page.locator(".chatbox")).toBeVisible();

	const measured = await measureControls(page);
	assertFloor(measured, "vacío");

	// Las sugerencias y el botón de nueva conversación son controles del contrato y están
	// activos: si desaparecieran del estado vacío, el aserto de arriba seguiría conforme
	// con el botón de enviar solo.
	const ids = activeControls(contractControls(measured)).map((control) => control.id);
	expect(ids).toContain("suggestion");
	expect(ids).toContain("new-conversation");
});

test("un control deshabilitado queda fuera de la medición", async ({ page }) => {
	await page.goto("/?widget=embedded");
	const measured = contractControls(await measureControls(page));
	const send = measured.find((control) => control.id === "send");

	expect(send, "el botón de enviar está en el DOM").toBeDefined();
	expect(send?.disabled, "con el campo vacío el envío está deshabilitado").toBe(true);
	expect(activeControls(measured).map((control) => control.id)).not.toContain("send");
	// La exención no puede vaciar el contrato: algo queda midiéndose.
	expect(activeControls(measured).length).toBeGreaterThan(0);
});

test("el botón de enviar mide el suelo con el campo lleno y durante el turno", async ({ page }) => {
	// La petición se queda en el aire mientras se mide: el turno queda en curso sin depender
	// de cuánto tarda el stream en terminar.
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/chat", async (route) => {
		await held;
		await route.fulfill({
			status: 200,
			contentType: "text/event-stream",
			body: sourcesFrame() + tokenFrame("Usa Preact.") + doneFrame,
		});
	});

	await page.goto("/?widget=embedded");
	await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");

	// Con texto en el campo el envío está activo y ya es medible.
	assertFloor(await measureControls(page), "campo lleno");

	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
	await expect(page.locator(".chatbox__status")).toContainText(strings.messages.writing);

	assertFloor(await measureControls(page), "turno en curso");

	release();
	await expect(page.locator(".chatbox__message--assistant")).toBeVisible();
});

test("el botón de reintentar mide el suelo tras un fallo", async ({ page }) => {
	await page.route("**/api/chat", async (route) => {
		await route.fulfill({ status: 500 });
	});

	await page.goto("/?widget=embedded");
	await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
	await expect(page.locator(".chatbox__status")).toContainText(strings.errors.HTTP_SERVER);

	const measured = contractControls(await measureControls(page));
	const ids = activeControls(measured).map((control) => control.id);
	expect(ids).toContain("retry");
	assertFloor(measured, "turno fallido");
});

test("la confirmación de nueva conversación mide el suelo", async ({ page }) => {
	await page.goto("/?widget=embedded");
	await page.getByRole("button", { name: strings.actions.newConversation }).click();
	await expect(page.locator(".chatbox__conversation-actions")).toBeVisible();

	const measured = await measureControls(page);
	const ids = activeControls(contractControls(measured)).map((control) => control.id);
	expect(ids).toContain("confirm-accept");
	expect(ids).toContain("confirm-cancel");
	// El botón que abrió la confirmación se desmonta al cambiarla de modo: medir solo lo
	// que queda en pantalla no mide un control que ya no existe.
	expect(ids).not.toContain("new-conversation");

	assertFloor(measured, "confirmación abierta");
});

test.describe("en un viewport estrecho", () => {
	test.use({ viewport: { width: 360, height: 640 } });

	test("los controles del footer alcanzan el suelo con el ancho mínimo", async ({ page }) => {
		// El `min-width` del suelo se come ancho en el footer, que es donde conviven el campo,
		// el envío y nueva conversación. En un contenedor estrecho es donde se rompería.
		await page.goto("/?widget=embedded");
		await expect(page.locator(".chatbox")).toBeVisible();

		const measured = await measureControls(page);
		const ids = activeControls(contractControls(measured)).map((control) => control.id);
		expect(ids).toContain("new-conversation");

		assertFloor(measured, "viewport estrecho");
	});
});

test.describe("con una conversación larga", () => {
	test.use({ viewport: { width: 420, height: 520 } });

	test("«Ir al final» mide el suelo cuando aparece", async ({ page }) => {
		// Con movimiento reducido el autoscroll es instantáneo, así que el hilo no compite
		// con el desplazamiento que hace aparecer el botón.
		await page.emulateMedia({ reducedMotion: "reduce" });
		const answer = Array.from({ length: 120 }, (_, index) => `palabra${index} `).join("");
		await mockChatApi(page, ...[answer].map((text) => tokenFrame(text)), doneFrame);

		await page.goto("/?widget=embedded");
		await page.locator("#chatbox-question").fill("Cuéntame algo largo");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		// La respuesta completa antes de subir el hilo: si no, la subida cae a menos de 16 px
		// del final y el widget la trata como seguimiento (RF-F06).
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra119");

		// Precondición, no decoración: si la conversación no se desplaza, el botón no
		// aparece y el test pasaría sin haber medido nada.
		const scrollable = await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			return conversation !== null && conversation.scrollHeight > conversation.clientHeight;
		});
		expect(scrollable, "la conversación debería ser desplazable").toBe(true);

		await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			if (conversation) conversation.scrollTop = 0;
		});
		await expect(page.locator(`[${CONTROL_ATTRIBUTE}="scroll-to-end"]`)).toBeVisible();

		assertFloor(await measureControls(page), "desplazado");
	});
});

test.describe("con el widget contraído", () => {
	test("el lanzador alcanza el suelo", async ({ page }) => {
		// La variante flotante nace contraída (RF-F64): el lanzador es el único control
		// que hay, y es un botón de 56×56.
		await page.goto("/?widget=floating");
		await expect(page.locator(".chatbox__launcher")).toBeVisible();

		const measured = await measureControls(page);
		assertFloor(measured, "contraído");

		const ids = activeControls(contractControls(measured)).map((control) => control.id);
		expect(ids).toContain("launcher");
	});

	test("el botón de contraer alcanza el suelo con el panel abierto", async ({ page }) => {
		// El botón de contraer solo existe en la variante flotante: sin este escenario, el
		// inventario declararía un control que ningún escenario mide.
		await page.goto("/?widget=floating");
		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await measureControls(page);
		assertFloor(measured, "vacío");

		const ids = activeControls(contractControls(measured)).map((control) => control.id);
		expect(ids).toContain("collapse");
	});

	test("el botón de contraer alcanza el suelo en el cajón", async ({ page }) => {
		// El cajón (RF-F65) es la otra variante superpuesta: su botón de contraer se mide
		// en el mismo estado de widget —vacío— que el de la flotante.
		await page.goto("/?widget=drawer");
		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await measureControls(page);
		assertFloor(measured, "vacío");

		const ids = activeControls(contractControls(measured)).map((control) => control.id);
		expect(ids).toContain("collapse");
	});
});
