/**
 * RF-F51 — el teclado virtual resuelto en un navegador real (issue #119).
 *
 * Nivel de verificación: **resolución**. Mide dónde queda el pie del widget —y con él el
 * campo de texto— cuando el teclado virtual tapa la parte de abajo de la pantalla, y que el
 * hilo no pierda su final al encogerse la zona visible. El nivel de mecanismo
 * (`test/unit/chatbox-keyboard.test.ts`) afirma las declaraciones; este afirma la geometría.
 *
 * Límite declarado: Chromium no emula un teclado virtual. El escenario sustituye el
 * `visualViewport` por uno cuya altura mengua como lo haría el teclado y dispara su
 * `resize`, que es justo lo que el navegador publica cuando el teclado abre. Lo que se
 * comprueba es la reacción del widget a ese aviso, con números de verdad.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

/** Lo que tapa el teclado simulado, en píxeles. */
const KEYBOARD_PX = 300;

/** El tamaño de la pantalla del escenario. */
const SCREEN = { width: 390, height: 800 };

/**
 * Sustituye el `visualViewport` por uno al que se le puede quitar altura, como hace el
 * teclado virtual.
 *
 * El teclado virtual encoge el viewport **visual** y deja el de layout como estaba: por eso
 * el sustituto solo altera `height`, y `window.innerHeight` sigue siendo el de antes. Al
 * cambiar la altura se dispara el `resize` del viewport visual, que es el aviso que el
 * widget escucha.
 */
async function withVirtualKeyboard(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const real = window.visualViewport;
		if (!real) return;

		let keyboard = 0;

		const fake = {
			get width() {
				return real.width;
			},
			get height() {
				return real.height - keyboard;
			},
			get offsetLeft() {
				return real.offsetLeft;
			},
			get offsetTop() {
				return real.offsetTop;
			},
			get pageLeft() {
				return real.pageLeft;
			},
			get pageTop() {
				return real.pageTop;
			},
			get scale() {
				return real.scale;
			},
			addEventListener: real.addEventListener.bind(real),
			removeEventListener: real.removeEventListener.bind(real),
			dispatchEvent: real.dispatchEvent.bind(real),
		};

		Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });

		(window as unknown as { __keyboard: (pixels: number) => void }).__keyboard = (pixels) => {
			keyboard = pixels;
			fake.dispatchEvent(new Event("resize"));
		};
	});
}

/** Abre (o cierra) el teclado simulado. */
const openKeyboard = (page: Page, pixels: number): Promise<void> =>
	page.evaluate((value) => {
		(window as unknown as { __keyboard: (pixels: number) => void }).__keyboard(value);
	}, pixels);

/** La geometría que decide el contrato, tal y como la resuelve el navegador. */
type Geometry = {
	/** El borde inferior del campo de texto. */
	fieldBottom: number;
	/** El borde inferior del pie del widget. */
	footerBottom: number;
	/** La franja que el widget reserva para el teclado. */
	reserved: number;
	/** El borde inferior del último mensaje. */
	lastMessageBottom: number;
	/** El borde inferior de la caja del hilo. */
	conversationBottom: number;
	/** Si el hilo está en su final. */
	atBottom: boolean;
};

const geometry = (page: Page): Promise<Geometry> =>
	page.evaluate(() => {
		const field = document.querySelector("#chatbox-question");
		const footer = document.querySelector(".chatbox__footer");
		const conversation = document.querySelector(".chatbox__conversation");
		const widget = document.querySelector(".chatbox");
		const messages = document.querySelectorAll(".chatbox__message");
		const last = messages[messages.length - 1];
		return {
			fieldBottom: field ? field.getBoundingClientRect().bottom : Number.NaN,
			footerBottom: footer ? footer.getBoundingClientRect().bottom : Number.NaN,
			reserved: widget ? Number.parseFloat(getComputedStyle(widget).paddingBottom) : Number.NaN,
			lastMessageBottom: last ? last.getBoundingClientRect().bottom : Number.NaN,
			conversationBottom: conversation ? conversation.getBoundingClientRect().bottom : Number.NaN,
			atBottom: conversation
				? conversation.scrollTop + conversation.clientHeight >= conversation.scrollHeight - 1
				: true,
		};
	});

/**
 * El borde superior del teclado, en coordenadas de la pantalla.
 *
 * Es donde termina la zona visible: el `visualViewport` encogido deja de ver a partir de
 * ahí.
 */
const keyboardTop = (page: Page): Promise<number> =>
	page.evaluate(() => {
		const viewport = window.visualViewport;
		if (!viewport) return 0;
		return viewport.offsetTop + viewport.height;
	});

/** Una respuesta larga, para que el hilo desborde y tenga final que perder. */
async function longAnswer(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const original = window.fetch.bind(window);
		window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			if (!String(input).includes("/api/chat")) return original(input, init);
			const encoder = new TextEncoder();
			const words = Array.from({ length: 200 }, (_, index) => `palabra${index}`).join(" ");
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(
						encoder.encode('event: sources\ndata: {"sources":[],"history":[]}\n\n')
					);
					controller.enqueue(encoder.encode(`event: token\ndata: {"token":" ${words}"}\n\n`));
					controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
					controller.close();
				},
			});
			return new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			});
		};
	});
}

test.describe("RF-F51 — el teclado virtual", () => {
	test.use({ viewport: SCREEN });

	test("el campo de texto queda por encima del teclado", async ({ page }) => {
		await withVirtualKeyboard(page);
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		await openKeyboard(page, KEYBOARD_PX);

		const top = await keyboardTop(page);
		const measured = await geometry(page);

		expect(
			measured.footerBottom,
			"el pie del widget no puede quedar bajo el teclado"
		).toBeLessThanOrEqual(top);
		expect(
			measured.fieldBottom,
			"el campo de texto no puede quedar bajo el teclado"
		).toBeLessThanOrEqual(top);
	});

	test("la comprobación del pie muerde: sin la franja reservada, el campo queda bajo el teclado", async ({
		page,
	}) => {
		// La entrada que rechaza: el mismo escenario con la franja reservada anulada. Sin
		// esta entrada, la comprobación de arriba no protegería nada.
		await withVirtualKeyboard(page);
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		await page.addStyleTag({ content: ".chatbox { padding-bottom: 0 !important; }" });
		await openKeyboard(page, KEYBOARD_PX);

		const top = await keyboardTop(page);
		const measured = await geometry(page);

		expect(measured.footerBottom).toBeGreaterThan(top);
	});

	test("el widget reserva exactamente la franja que hace falta", async ({ page }) => {
		await withVirtualKeyboard(page);
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		await openKeyboard(page, KEYBOARD_PX);

		const top = await keyboardTop(page);
		const measured = await geometry(page);

		// Ni un píxel de más ni de menos: el pie del widget queda justo en el borde de la
		// zona visible, que es donde empieza el teclado.
		expect(measured.footerBottom).toBeCloseTo(top, 0);
		// Y la franja reservada cubre, como mínimo, lo que tapa el teclado.
		expect(measured.reserved).toBeGreaterThanOrEqual(KEYBOARD_PX);
	});

	test("la comprobación de la franja muerde: reservar de más deja un hueco", async ({ page }) => {
		// La entrada que rechaza: el mismo escenario con una franja mayor que la del
		// teclado. El widget dejaría un hueco entre el pie y el teclado.
		await withVirtualKeyboard(page);
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		await page.addStyleTag({ content: ".chatbox { padding-bottom: 400px !important; }" });
		await openKeyboard(page, KEYBOARD_PX);

		const top = await keyboardTop(page);
		const measured = await geometry(page);

		expect(measured.footerBottom).toBeLessThan(top - 1);
	});

	test("un widget que no está anclado abajo no reserva franja", async ({ page }) => {
		// El widget embebido en una página no está anclado al borde inferior: el
		// navegador ya lo desplaza al enfocar el campo, y reservar franja de más solo
		// encogería el hilo. Las dos ramas de la regla se comprueban aquí: la de arriba
		// reserva, esta no.
		await withVirtualKeyboard(page);
		await page.goto("/");
		await expect(page.locator("#chatbox-question")).toBeVisible();

		// La caja del widget deja de llegar al borde inferior de la pantalla.
		await page.addStyleTag({ content: "#app { height: 400px; }" });
		await openKeyboard(page, KEYBOARD_PX);

		const measured = await geometry(page);

		expect(measured.reserved).toBe(0);
	});

	test("el hilo no pierde su final cuando el teclado abre", async ({ page }) => {
		await withVirtualKeyboard(page);
		await longAnswer(page);
		await page.goto("/");

		await page.locator("#chatbox-question").fill("Cuéntame algo largo");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra0");

		// El hilo llega al final antes de que abra el teclado.
		await expect.poll(async () => (await geometry(page)).atBottom).toBe(true);

		await openKeyboard(page, KEYBOARD_PX);

		// La zona visible se ha encogido: el hilo tiene que volver al final, porque el
		// último mensaje no puede quedar bajo el teclado.
		await expect
			.poll(async () => (await geometry(page)).atBottom, {
				message: "el hilo tiene que volver al final cuando el teclado abre",
			})
			.toBe(true);

		const top = await keyboardTop(page);
		const measured = await geometry(page);
		// El último mensaje se compara con el teclado, no con el hilo: si el hilo no se
		// encoge, el mensaje sigue dentro del hilo y por debajo del teclado.
		expect(
			measured.lastMessageBottom,
			"el último mensaje no puede quedar bajo el teclado"
		).toBeLessThanOrEqual(top);
	});

	test("el teclado no arrastra a quien se ha apartado del hilo", async ({ page }) => {
		// La entrada que rechaza: la regla del seguimiento también decide aquí. Quien se
		// aparta del hilo sigue leyendo por su cuenta, y el teclado no lo arrastra.
		await withVirtualKeyboard(page);
		await longAnswer(page);
		await page.goto("/");

		await page.locator("#chatbox-question").fill("Cuéntame algo largo");
		await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra0");
		await expect.poll(async () => (await geometry(page)).atBottom).toBe(true);

		const away = await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation") as HTMLElement;
			conversation.scrollTop = 0;
			conversation.dispatchEvent(new Event("scroll"));
			return conversation.scrollTop;
		});
		await expect(page.getByRole("button", { name: strings.actions.scrollToEnd })).toBeVisible();

		await openKeyboard(page, KEYBOARD_PX);

		const measured = await geometry(page);
		expect(measured.atBottom, "el hilo no tiene que volver solo al final").toBe(false);
		expect(away).toBe(0);
	});
});
