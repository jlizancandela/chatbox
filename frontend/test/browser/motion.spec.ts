/**
 * RF-F44 — el movimiento reducido en un navegador real (issue #100).
 *
 * Nivel de verificación: **resolución**. El nivel de mecanismo
 * (`test/unit/chatbox-motion.test.ts`) afirma que la hoja respeta el contrato y que el
 * literal del scroll suave no aparece por el código; este afirma lo que el navegador hace
 * con esa hoja: que la animación no existe con movimiento reducido, que sí existe cuando la
 * persona lo permite, y que el scroll no se pide suave.
 * Ver `docs/decisions/008-movimiento-reducido.md`.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { doneFrame, mockChatApi, tokenFrame } from "../chat-frames";
import { SCROLL_BOX_SELECTOR, TYPING_SELECTOR } from "../motion";

const SCROLL_BEHAVIORS = "__rfF44ScrollBehaviors";

/**
 * Registra el `behavior` de cada llamada a `scrollTo`.
 *
 * Sin esto, "el scroll no es suave" no se puede comprobar: un scroll suave y uno
 * instantáneo llegan al mismo sitio, y solo la petición distingue uno del otro.
 */
async function recordScrollBehaviors(page: Page): Promise<void> {
	await page.addInitScript((key) => {
		const store = window as unknown as Record<string, string[]>;
		store[key] = [];
		const prototype = Element.prototype as unknown as {
			scrollTo: (...args: unknown[]) => void;
		};
		const original = prototype.scrollTo;
		prototype.scrollTo = function patched(this: Element, ...args: unknown[]): void {
			const options = args[0];
			if (options && typeof options === "object") {
				const behavior = (options as { behavior?: string }).behavior;
				store[key].push(behavior ?? "sin behavior");
			}
			original.apply(this, args);
		};
	}, SCROLL_BEHAVIORS);
}

const scrollBehaviors = (page: Page): Promise<string[]> =>
	page.evaluate((key) => (window as unknown as Record<string, string[]>)[key], SCROLL_BEHAVIORS);

/** Deja la petición en el aire: el turno queda en curso sin depender del stream. */
async function holdTheTurn(page: Page): Promise<() => void> {
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/chat", async (route) => {
		await held;
		await route.fulfill({
			status: 200,
			contentType: "text/event-stream",
			body: "event: done\ndata: {}\n\n",
		});
	});
	return release;
}

async function askSomething(page: Page): Promise<void> {
	await page.locator("#chatbox-question").fill("¿Qué usa Jorge?");
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
}

const animationNameOf = (page: Page): Promise<string> =>
	page
		.locator(TYPING_SELECTOR)
		.first()
		.evaluate((element) => window.getComputedStyle(element).animationName);

/**
 * Espera a que la conversación deje de crecer.
 *
 * El markdown del asistente se carga diferido (RF-F30): la burbuja crece cuando el módulo
 * llega, después del scroll. Sin esta espera, el botón calcularía su destino con una altura
 * que aún va a cambiar.
 */
async function waitForConversationToSettle(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const conversation = document.querySelector(".chatbox__conversation");
		if (!conversation) return false;
		const store = window as unknown as { __rfF44Height?: number };
		const previous = store.__rfF44Height;
		store.__rfF44Height = conversation.scrollHeight;
		return previous !== undefined && previous === conversation.scrollHeight;
	});
}

test.describe("RF-F44 — el indicador de escritura", () => {
	test("no se anima con movimiento reducido", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		const release = await holdTheTurn(page);

		await page.goto("/");
		await askSomething(page);
		await expect(page.locator(TYPING_SELECTOR).first()).toBeVisible();

		expect(await animationNameOf(page)).toBe("none");
		release();
	});

	test("se anima cuando la persona permite el movimiento", async ({ page }) => {
		// El caso positivo: sin él, el test anterior pasaría con un widget sin animación, y
		// un detector que nunca falla no protege nada.
		await page.emulateMedia({ reducedMotion: "no-preference" });
		const release = await holdTheTurn(page);

		await page.goto("/");
		await askSomething(page);
		await expect(page.locator(TYPING_SELECTOR).first()).toBeVisible();

		expect(await animationNameOf(page)).not.toBe("none");
		release();
	});
});

test.describe("RF-F44 — el scroll de la conversación", () => {
	test.use({ viewport: { width: 420, height: 520 } });

	const longAnswer = Array.from({ length: 120 }, (_, index) => `palabra${index} `).join("");
	const LONG_ANSWER_MARK = "palabra0";

	/** Una conversación larga, desplazada arriba, con el botón «Ir al final» a la vista. */
	async function longConversationWithScrollToEnd(page: Page): Promise<void> {
		await page.goto("/");
		await askSomething(page);
		// El markdown del asistente se carga diferido (RF-F30) y, hasta que llega, la
		// burbuja está vacía: hay que esperarlo o el scroll se calcula sobre una altura que
		// aún va a cambiar.
		await expect(page.locator(".chatbox__message--assistant")).toContainText(LONG_ANSWER_MARK);
		await waitForConversationToSettle(page);

		// Precondición, no decoración: si la conversación no se desplaza, el botón no
		// aparece y el test pasaría sin haber pedido ningún scroll.
		const scrollable = await page.evaluate((selector) => {
			const conversation = document.querySelector(selector);
			return conversation !== null && conversation.scrollHeight > conversation.clientHeight;
		}, SCROLL_BOX_SELECTOR);
		expect(scrollable, "la conversación debería ser desplazable").toBe(true);

		await page.evaluate((selector) => {
			const conversation = document.querySelector(selector);
			if (conversation) conversation.scrollTop = 0;
		}, SCROLL_BOX_SELECTOR);
		await expect(page.getByRole("button", { name: strings.actions.scrollToEnd })).toBeVisible();
	}

	/** Si el hilo quedó al final. */
	const isAtTheEnd = (page: Page): Promise<boolean> =>
		page.evaluate((selector) => {
			const conversation = document.querySelector(selector);
			if (!conversation) return false;
			return conversation.scrollTop + conversation.clientHeight >= conversation.scrollHeight - 1;
		}, SCROLL_BOX_SELECTOR);

	test("no se pide suave con movimiento reducido", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await recordScrollBehaviors(page);
		await mockChatApi(page, tokenFrame(longAnswer), doneFrame);

		await longConversationWithScrollToEnd(page);
		await page.getByRole("button", { name: strings.actions.scrollToEnd }).click();

		const behaviors = await scrollBehaviors(page);
		expect(behaviors.length, "el widget tiene que pedir algún scroll").toBeGreaterThan(0);
		expect(behaviors).not.toContain("smooth");
		// Sondeo, no aserción: el desplazamiento se aplica en el frame de render, así que
		// leer `scrollTop` justo después del clic sería una carrera.
		await expect
			.poll(() => isAtTheEnd(page), { message: "el hilo tiene que quedar al final" })
			.toBe(true);
	});

	test("se pide suave cuando la persona permite el movimiento", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await recordScrollBehaviors(page);
		await mockChatApi(page, tokenFrame(longAnswer), doneFrame);

		await longConversationWithScrollToEnd(page);
		await page.getByRole("button", { name: strings.actions.scrollToEnd }).click();

		// Los dos caminos —el autoscroll y el botón— piden lo mismo: sin movimiento
		// reducido los dos piden scroll suave.
		const behaviors = await scrollBehaviors(page);
		expect(behaviors.length, "el widget tiene que pedir algún scroll").toBeGreaterThan(0);
		expect(behaviors).toContain("smooth");
		await expect
			.poll(() => isAtTheEnd(page), { message: "el hilo tiene que quedar al final" })
			.toBe(true);
	});
});
