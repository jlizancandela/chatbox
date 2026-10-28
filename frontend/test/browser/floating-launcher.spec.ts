/**
 * RF-F64 — la variante flotante contraída, resuelta en un navegador real (issue #127).
 *
 * Nivel de verificación: **resolución**. El nivel de mecanismo vive en
 * `test/component/chatbox-collapsed.test.tsx`; este mide la geometría de verdad —dónde
 * queda el lanzador, cuánto mide y qué hace el panel cuando se abre— y comprueba que el
 * anclaje es el que dice la regla.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

/** El margen del anclaje, en px: el de la regla `max(1rem, env(safe-area-inset-*))`. */
const ANCHOR_PX = 16;

/** El lado del lanzador: 56×56. */
const LAUNCHER_PX = 56;

/** El ancho máximo del panel flotante: en el escritorio es una tarjeta, no la página. */
const PANEL_MAX_PX = 380;

async function openFloating(page: Page): Promise<void> {
	await page.goto("/?widget=floating");
	await expect(page.locator(".chatbox__launcher")).toBeVisible();
}

test.describe("RF-F64 — la variante flotante contraída", () => {
	test("el lanzador está anclado abajo a la derecha y mide el círculo entero", async ({ page }) => {
		await openFloating(page);

		const box = await page.locator(".chatbox__launcher").boundingBox();
		const viewport = page.viewportSize();
		expect(box).not.toBeNull();
		expect(viewport).not.toBeNull();

		expect(Math.round(viewport!.width - (box!.x + box!.width))).toBe(ANCHOR_PX);
		expect(Math.round(viewport!.height - (box!.y + box!.height))).toBe(ANCHOR_PX);
		expect(Math.round(box!.width)).toBe(LAUNCHER_PX);
		expect(Math.round(box!.height)).toBe(LAUNCHER_PX);
	});

	test("el panel se abre anclado abajo a la derecha y no tapa la página entera", async ({
		page,
	}) => {
		await openFloating(page);

		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const panel = await page.locator(".chatbox").boundingBox();
		const viewport = page.viewportSize();
		expect(panel).not.toBeNull();

		expect(Math.round(panel!.width)).toBeLessThanOrEqual(PANEL_MAX_PX);
		expect(Math.round(viewport!.width - (panel!.x + panel!.width))).toBe(ANCHOR_PX);
		expect(Math.round(viewport!.height - (panel!.y + panel!.height))).toBe(ANCHOR_PX);
	});

	test("el botón de contraer y Esc cierran el panel", async ({ page }) => {
		await openFloating(page);

		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();
		await page.getByRole("button", { name: strings.actions.collapse.ariaLabel }).click();
		await expect(page.locator(".chatbox__launcher")).toBeVisible();

		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();
		await page.locator("#chatbox-question").focus();
		await page.keyboard.press("Escape");
		await expect(page.locator(".chatbox__launcher")).toBeVisible();
	});

	test("la comprobación del anclaje muerde: sin anclaje, el lanzador no está en la esquina", async ({
		page,
	}) => {
		// La entrada que rechaza: la comprobación de arriba tiene que fallar si el anclaje
		// se rompe.
		await openFloating(page);
		await page.addStyleTag({
			content: '.chatbox[data-variant="floating"] { position: static; }',
		});

		const box = await page.locator(".chatbox__launcher").boundingBox();
		const viewport = page.viewportSize();
		expect(box).not.toBeNull();

		expect(Math.round(viewport!.width - (box!.x + box!.width))).not.toBe(ANCHOR_PX);
	});
});
