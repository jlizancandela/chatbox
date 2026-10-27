/**
 * RF-F50 — el viewport móvil resuelto en un navegador real.
 *
 * Nivel de verificación: **resolución**. Mide lo que el navegador le da al widget y al campo
 * de texto. El nivel de mecanismo (`test/unit/chatbox-viewport.test.ts`) afirma las unidades
 * y las declaraciones; este afirma el tamaño de verdad.
 *
 * Límite declarado: Chromium no emula safe areas ni una barra de navegador que se recoge,
 * así que la rama del inset y la diferencia entre `vh` y `dvh` solo se verifican en el nivel
 * de mecanismo. Lo que sí resuelve el navegador —el tope de altura, el tamaño del campo y
 * el padding que sobrevive al `max()`— se verifica aquí.
 */

import { expect, test } from "@playwright/test";
import { FONT_SIZE_FLOOR_PX, LINE_HEIGHT_RATIO, SAFE_AREAS } from "../viewport";

/** La raíz del host con una tipografía más pequeña que la del sitio de prueba. */
const HOST_ROOT_FONT_SIZE = 14;

test("el widget no crece más allá del viewport dinámico", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();

	// Un contenedor mucho más alto que la pantalla: el widget se topa con el viewport.
	await page.addStyleTag({ content: "#app { height: 300vh; }" });

	const measured = await page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		return {
			widget: widget ? widget.getBoundingClientRect().height : 0,
			viewport: window.innerHeight,
		};
	});

	expect(measured.widget).toBeLessThanOrEqual(measured.viewport);
	expect(measured.widget).toBeGreaterThan(0);
});

test("la comprobación del tope muerde: sin `max-height`, el widget crece", async ({ page }) => {
	// La entrada que rechaza: el mismo escenario con el tope anulado. Sin esta entrada, la
	// comprobación de arriba no protegería nada.
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
	await page.addStyleTag({ content: "#app { height: 300vh; } .chatbox { max-height: none; }" });

	const measured = await page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		return {
			widget: widget ? widget.getBoundingClientRect().height : 0,
			viewport: window.innerHeight,
		};
	});

	expect(measured.widget).toBeGreaterThan(measured.viewport);
});

test("el widget llena el contenedor que le da el sitio host", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();

	const measured = await page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		const host = document.querySelector("#app");
		return {
			widget: widget ? widget.getBoundingClientRect().height : 0,
			host: host ? host.getBoundingClientRect().height : 0,
		};
	});

	expect(measured.widget).toBeCloseTo(measured.host, 0);
});

test("la comprobación del llenado muerde: sin `height`, el widget no llena el host", async ({
	page,
}) => {
	// La entrada que rechaza: el mismo escenario con la altura del widget anulada.
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
	await page.addStyleTag({ content: ".chatbox { height: auto; }" });

	const measured = await page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		const host = document.querySelector("#app");
		return {
			widget: widget ? widget.getBoundingClientRect().height : 0,
			host: host ? host.getBoundingClientRect().height : 0,
		};
	});

	expect(Math.abs(measured.widget - measured.host)).toBeGreaterThan(1);
});

test("el campo de texto mide al menos 16 px con la raíz del host a 14 px", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("#chatbox-question")).toBeVisible();

	// El sitio de prueba tiene la raíz a 16 px, y ahí `1rem` ya vale 16 px: el navegador
	// de test no distingue un suelo real de un `1rem` sin más. Con una raíz de 14 px —el
	// tamaño más común en un sitio host— sí.
	await page.addStyleTag({ content: `html { font-size: ${HOST_ROOT_FONT_SIZE}px; }` });

	const fontSize = await page
		.locator("#chatbox-question")
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

	expect(fontSize).toBeGreaterThanOrEqual(FONT_SIZE_FLOOR_PX);
});

test("la comprobación del suelo muerde: con `1rem`, el campo baja del suelo", async ({ page }) => {
	// La entrada que rechaza: el mismo escenario con la declaración que el contrato
	// rechaza. Con la raíz del host a 14 px, `1rem` deja el campo en 14 px.
	await page.goto("/");
	await expect(page.locator("#chatbox-question")).toBeVisible();
	await page.addStyleTag({
		content: `html { font-size: ${HOST_ROOT_FONT_SIZE}px; } .chatbox textarea { font-size: 1rem; }`,
	});

	const fontSize = await page
		.locator("#chatbox-question")
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

	expect(fontSize).toBeLessThan(FONT_SIZE_FLOOR_PX);
});

test("el interlineado del campo acompaña a su tamaño de fuente", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("#chatbox-question")).toBeVisible();

	// El interlineado es un múltiplo del tamaño de fuente, no un valor en px: con el
	// tamaño que la persona eligió en su navegador, el campo crece con ella.
	const measured = await page.locator("#chatbox-question").evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			fontSize: Number.parseFloat(style.fontSize),
			lineHeight: Number.parseFloat(style.lineHeight),
		};
	});

	expect(measured.lineHeight).toBeCloseTo(measured.fontSize * LINE_HEIGHT_RATIO, 1);
});

test("la comprobación del interlineado muerde: en px absolutos deja de acompañar", async ({
	page,
}) => {
	// La entrada que rechaza: el mismo campo con el interlineado del widget —20 px, que
	// no es múltiplo del tamaño del campo.
	await page.goto("/");
	await expect(page.locator("#chatbox-question")).toBeVisible();
	await page.addStyleTag({ content: ".chatbox textarea { line-height: 20px; }" });

	const measured = await page.locator("#chatbox-question").evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			fontSize: Number.parseFloat(style.fontSize),
			lineHeight: Number.parseFloat(style.lineHeight),
		};
	});

	expect(measured.lineHeight).not.toBeCloseTo(measured.fontSize * LINE_HEIGHT_RATIO, 1);
});

test("cada borde conserva su padding base", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();

	const measured = await page.evaluate((areas) => {
		const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
		return areas.map((area) => {
			const element = document.querySelector(area.region);
			const style = element ? getComputedStyle(element) : null;
			return {
				region: area.region,
				edge: area.edge,
				base: Number.parseFloat(area.base) * rootFontSize,
				resolved: style
					? Number.parseFloat(style.getPropertyValue(`padding-${area.edge}`))
					: Number.NaN,
			};
		});
	}, SAFE_AREAS);

	for (const area of measured) {
		expect(area.resolved, `${area.region} · ${area.edge}`).toBeGreaterThanOrEqual(area.base);
	}
});

test("la comprobación del padding muerde: sin padding base, el borde queda a cero", async ({
	page,
}) => {
	// La entrada que rechaza: el mismo borde con el padding base anulado.
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
	await page.addStyleTag({ content: ".chatbox__footer { padding-bottom: 0; }" });

	const resolved = await page
		.locator(".chatbox__footer")
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));

	expect(resolved).toBe(0);
});

/** La geometría de las regiones del widget, tal y como la resuelve el navegador. */
const geometry = (page: import("@playwright/test").Page) =>
	page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		const header = document.querySelector(".chatbox__header");
		const footer = document.querySelector(".chatbox__footer");
		const field = document.querySelector("#chatbox-question");
		if (!widget || !header || !footer || !field) return null;
		return {
			widgetContent: widget.scrollHeight,
			widgetBox: widget.clientHeight,
			headerBox: header.getBoundingClientRect().height,
			headerContent: header.scrollHeight,
			footerBox: footer.getBoundingClientRect().height,
			footerContent: footer.scrollHeight,
			fieldBottom: field.getBoundingClientRect().bottom,
			footerBottom: footer.getBoundingClientRect().bottom,
		};
	});

test.describe("en un viewport con sitio de sobra", () => {
	test.use({ viewport: { width: 390, height: 400 } });

	test("el widget no desborda su propia caja", async ({ page }) => {
		// Con altura de sobra, el hilo crece hasta llenar el widget y nada se sale.
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await geometry(page);

		expect(measured).not.toBeNull();
		expect(measured?.widgetContent).toBeLessThanOrEqual(measured?.widgetBox as number);
	});

	test("la comprobación del desborde muerde: si el contenido no cabe, desborda", async ({
		page,
	}) => {
		// La entrada que rechaza: el mismo widget con un contenido que no cabe en su caja.
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();
		await page.addStyleTag({ content: ".chatbox__header { padding-bottom: 300px; }" });

		const measured = await geometry(page);

		expect(measured).not.toBeNull();
		expect(measured?.widgetContent).toBeGreaterThan(measured?.widgetBox as number);
	});
});

test.describe("en un viewport estrecho", () => {
	test.use({ viewport: { width: 360, height: 640 } });

	test("el widget no se desborda horizontalmente", async ({ page }) => {
		// El diseño es fluido: el widget se adapta al ancho que le da el contenedor.
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await page.evaluate(() => {
			const widget = document.querySelector(".chatbox");
			return widget
				? { width: widget.getBoundingClientRect().width, viewport: window.innerWidth }
				: null;
		});

		expect(measured).not.toBeNull();
		expect(measured?.width).toBeLessThanOrEqual(measured?.viewport as number);
	});

	test("la comprobación del ancho muerde: con un ancho fijo, el widget se desborda", async ({
		page,
	}) => {
		// La entrada que rechaza: el mismo widget con un ancho que no cabe en la pantalla.
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();
		await page.addStyleTag({ content: ".chatbox { width: 500px; }" });

		const measured = await page.evaluate(() => {
			const widget = document.querySelector(".chatbox");
			return widget
				? { width: widget.getBoundingClientRect().width, viewport: window.innerWidth }
				: null;
		});

		expect(measured?.width).toBeGreaterThan(measured?.viewport as number);
	});
});

test.describe("en un viewport más bajo que el mínimo del widget", () => {
	test.use({ viewport: { width: 390, height: 300 } });

	test("la cabecera y el pie no se encogen: el hilo es lo que cede", async ({ page }) => {
		// Por debajo de su altura mínima el widget no cabe entero y el sitio host puede
		// recortarlo. Lo que no puede pasar es que la cabecera o el pie se encogieran: el
		// aviso de alcance no puede quedar cortado a media frase, y el campo de texto —lo
		// que la persona tiene que poder usar— no puede salirse de su región.
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await geometry(page);

		expect(measured).not.toBeNull();
		// La cabecera conserva su altura: su texto queda entero.
		expect(measured?.headerBox).toBeGreaterThanOrEqual(measured?.headerContent as number);
		// El pie también, y el campo de texto no se sale de él.
		expect(measured?.footerBox).toBeGreaterThanOrEqual(measured?.footerContent as number);
		expect(measured?.fieldBottom).toBeLessThanOrEqual(measured?.footerBottom as number);
	});

	test("la comprobación muerde: con la cabecera y el pie encogibles, sí se encogen", async ({
		page,
	}) => {
		// La entrada que rechaza: el mismo escenario con el CSS roto. Con `min-height: 0`
		// la cabecera y el pie pueden encogerse, y entonces el hilo deja de ser lo único
		// que cede. Sin esta entrada, la comprobación de arriba no protegería nada.
		await page.goto("/");
		await page.addStyleTag({
			content: ".chatbox__header, .chatbox__footer { min-height: 0; }",
		});
		await expect(page.locator("#chatbox-question")).toBeVisible();

		const measured = await geometry(page);

		expect(measured).not.toBeNull();
		expect(measured?.headerBox).toBeLessThan(measured?.headerContent as number);
		expect(measured?.footerBox).toBeLessThan(measured?.footerContent as number);
	});
});
