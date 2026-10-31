/**
 * RF-F65 — la variante cajón, resuelta en un navegador real (issue #162).
 *
 * Nivel de verificación: **resolución**. El nivel de mecanismo vive en
 * `test/component/chatbox-drawer.test.tsx`; este mide la geometría de verdad —dónde
 * queda el panel, cuánto mide y qué hace el lanzador cuando se abre— y comprueba que el
 * anclaje es el que dice la regla.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

/** El margen del anclaje, en px: el de la regla `max(1rem, env(safe-area-inset-*))`. */
const ANCHOR_PX = 16;

/** El lado del lanzador: 56×56. */
const LAUNCHER_PX = 56;

/** El ancho del panel: un tercio de una pantalla de escritorio, ni más ni menos. */
const PANEL_PX = 460;

async function openDrawer(page: Page): Promise<void> {
	await page.goto("/?widget=drawer");
	await expect(page.locator(".chatbox__launcher")).toBeVisible();
}

test.describe("RF-F65 — la variante cajón", () => {
	test("el panel se ancla al borde derecho y ocupa la altura completa", async ({ page }) => {
		await openDrawer(page);

		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const panel = await page.locator(".chatbox").boundingBox();
		const viewport = page.viewportSize();
		expect(panel).not.toBeNull();
		expect(viewport).not.toBeNull();

		// El borde derecho del panel es el borde derecho de la pantalla.
		expect(Math.round(panel!.x + panel!.width)).toBe(viewport!.width);
		// Y el panel llega de arriba abajo: no es una tarjeta, es un cajón.
		expect(Math.round(panel!.height)).toBe(viewport!.height);
		expect(Math.round(panel!.width)).toBe(PANEL_PX);
	});

	test("en una pantalla estrecha el panel no se sale", async ({ page }) => {
		// Con un viewport más estrecho que el ancho declarado, el panel se limita a la
		// pantalla: no se sale por la derecha ni desborda la caja.
		await page.setViewportSize({ width: 360, height: 640 });
		await openDrawer(page);

		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const panel = await page.locator(".chatbox").boundingBox();
		expect(panel).not.toBeNull();

		expect(Math.round(panel!.width)).toBe(360);
		expect(Math.round(panel!.x)).toBe(0);
	});

	test("el lanzador contraído está anclado abajo a la derecha y mide el círculo entero", async ({
		page,
	}) => {
		await openDrawer(page);

		const box = await page.locator(".chatbox__launcher").boundingBox();
		const viewport = page.viewportSize();
		expect(box).not.toBeNull();
		expect(viewport).not.toBeNull();

		expect(Math.round(viewport!.width - (box!.x + box!.width))).toBe(ANCHOR_PX);
		expect(Math.round(viewport!.height - (box!.y + box!.height))).toBe(ANCHOR_PX);
		expect(Math.round(box!.width)).toBe(LAUNCHER_PX);
		expect(Math.round(box!.height)).toBe(LAUNCHER_PX);
	});

	test("el botón de contraer y Esc cierran el panel", async ({ page }) => {
		await openDrawer(page);

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

	test("la comprobación del anclaje muerde: sin anclaje, el panel no está en el borde", async ({
		page,
	}) => {
		// La entrada que rechaza: la comprobación de arriba tiene que fallar si el anclaje
		// se rompe.
		await openDrawer(page);
		await page.getByRole("button", { name: strings.launcher.open.ariaLabel }).click();
		await expect(page.locator("#chatbox-question")).toBeVisible();

		await page.addStyleTag({
			content: '.chatbox[data-variant="drawer"] { position: static; }',
		});

		const panel = await page.locator(".chatbox").boundingBox();
		const viewport = page.viewportSize();
		expect(panel).not.toBeNull();

		expect(Math.round(panel!.x + panel!.width)).not.toBe(viewport!.width);
	});
});
