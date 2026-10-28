/**
 * RF-F41 — la región de estado en un navegador real (issue #91).
 *
 * Nivel de verificación: **resolución**, no sonido. Estos tests comprueban que la región
 * lleva el texto del contrato en Chromium. Que un lector de pantalla lo hable no lo
 * comprueba ninguna máquina: el cierre de la RF es la pasada automática con axe
 * (`test/browser/accessibility.spec.ts`). Ver
 * `docs/decisions/005-live-region-verification.md`.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { doneFrame, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";

const STORAGE_KEY = "chatbox:v1";
const REGION_SEEN = "__rfF41RegionSeen";

/**
 * Ancho de la región cuando está "visualmente oculta" (RF-F46): una caja de 1×1 px con
 * el texto recortado. El patrón deja la región dentro del árbol de accesibilidad, que
 * es lo que hace que el anuncio se siga oyendo.
 */
const ANCHO_REGION_OCULTA_PX = 1;

async function openChatbox(page: Page) {
	await page.goto("/?widget=embedded");
	await expect(page.locator(".chatbox")).toBeVisible();
	await expect(page.locator("#chatbox-question")).toBeFocused();
}

/** Graba cada texto distinto que pasa por la región desde este momento. */
async function watchRegion(page: Page) {
	await page.evaluate((key) => {
		const region = document.querySelector(".chatbox__status") as HTMLElement;
		const store = window as unknown as Record<string, string[]>;
		store[key] = [region.textContent ?? ""];
		const observer = new MutationObserver(() => {
			const next = region.textContent ?? "";
			const seen = store[key];
			if (next !== seen[seen.length - 1]) seen.push(next);
		});
		observer.observe(region, { childList: true, characterData: true, subtree: true });
	}, REGION_SEEN);
}

const regionSeen = (page: Page): Promise<string[]> =>
	page.evaluate((key) => (window as unknown as Record<string, string[]>)[key], REGION_SEEN);

async function sendQuestion(page: Page, question: string) {
	await page.locator("#chatbox-question").fill(question);
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
}

test.describe("RF-F41 región de estado", () => {
	test("lleva la secuencia del turno: vacío, escribiendo y respuesta proyectada", async ({
		page,
	}) => {
		await mockChatApi(page, tokenFrame("Usa **Preact** y `Fastify`."));
		await openChatbox(page);
		await watchRegion(page);

		await sendQuestion(page, "¿Qué usa Jorge?");
		await expect(page.locator(".chatbox__status")).toHaveText("Usa Preact y Fastify.");

		expect(await regionSeen(page)).toEqual(["", strings.messages.writing, "Usa Preact y Fastify."]);
	});

	test("deja el aviso de respuesta vacía en la región y en la conversación", async ({ page }) => {
		await mockChatApi(page);
		await openChatbox(page);

		await sendQuestion(page, "¿Dónde vive el gato de Jorge?");

		await expect(page.locator(".chatbox__status")).toHaveText(strings.notices.noContext);
		await expect(page.locator(".chatbox__notice")).toHaveText(strings.notices.noContext);
	});

	test("no anuncia nada al recargar con una conversación restaurada", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta nueva."));
		await page.addInitScript(([key, value]) => window.sessionStorage.setItem(key, value), [
			STORAGE_KEY,
			JSON.stringify({
				messages: [{ role: "assistant", content: "Respuesta de la sesión anterior" }],
				context: [],
			}),
		] as const);
		await openChatbox(page);
		await watchRegion(page);

		await expect(page.locator(".chatbox__messages")).toBeVisible();
		await expect(page.locator(".chatbox__status")).toHaveText("");
		expect(await regionSeen(page)).toEqual([""]);
	});

	test("el contador de caracteres no crea una segunda región viva", async ({ page }) => {
		await mockChatApi(page, tokenFrame("Respuesta."));
		await openChatbox(page);
		await sendQuestion(page, "¿Qué usa Jorge?");
		await expect(page.locator(".chatbox__status")).toHaveText("Respuesta.");

		// El contador aparece a partir del 80% del límite: es texto visible, no una segunda
		// región que pueda interrumpir el anuncio.
		await page.locator("#chatbox-question").fill("x".repeat(900));
		await expect(page.locator("form small")).toBeVisible();

		const politeRegions = await page.locator('[aria-live="polite"]').count();
		expect(politeRegions).toBe(1);
	});

	test("el aviso de escritura se ve en el bocadillo, y la región solo lo anuncia", async ({
		page,
	}) => {
		// La respuesta se retiene con una puerta que abre el test, no con un reloj: un
		// retardo fijo dejaba las aserciones dentro de una ventana que el test no
		// controlaba, y en un runner lento llegaban después de la respuesta (R3-001).
		let abrir: () => void = () => {};
		const puerta = new Promise<void>((resolve) => {
			abrir = resolve;
		});
		await page.route("**/api/chat", async (route) => {
			await puerta;
			await route.fulfill({
				status: 200,
				contentType: "text/event-stream",
				body: sourcesFrame() + tokenFrame("Usa Preact y Fastify.") + doneFrame,
			});
		});
		await openChatbox(page);
		await sendQuestion(page, "¿Qué usa Jorge?");

		// El aviso se ve dentro del bocadillo, junto a los tres puntos.
		const bubble = page.locator(".chatbox__message--assistant");
		const notice = bubble.locator(".chatbox__writing");
		await expect(notice).toBeVisible();
		await expect(notice).toHaveText(strings.messages.writing);

		// La región lo dice, pero no lo pinta: su caja es de 1×1 px (el patrón de
		// "visualmente oculto" de RF-F46).
		const region = page.locator(".chatbox__status");
		await expect(region).toHaveText(strings.messages.writing);
		const box = await region.boundingBox();
		expect(box?.width).toBeLessThanOrEqual(ANCHO_REGION_OCULTA_PX);

		// Y lo que se ve no se oye dos veces: la copia del bocadillo es decorativa, y el
		// texto que se anuncia sigue en el árbol de accesibilidad de la región.
		expect(await bubble.ariaSnapshot()).not.toContain(strings.messages.writing);
		expect(await region.ariaSnapshot()).toContain(strings.messages.writing);

		// Al llegar la respuesta, el aviso desaparece: la respuesta se ve en la burbuja y
		// no queda texto duplicado dentro de ella (D4 de RF-F47).
		abrir();
		await expect(bubble).toContainText("Usa Preact y Fastify.");
		await expect(bubble.locator(".chatbox__writing")).toHaveCount(0);
	});

	test("el texto de la respuesta se ve una sola vez", async ({ page }) => {
		// La región de estado anuncia el desenlace del turno y el mensaje vive en la
		// conversación: si la región lo pintara también, la respuesta se vería dos veces.
		await mockChatApi(page, tokenFrame("Usa Preact y Fastify."));
		await openChatbox(page);
		await sendQuestion(page, "¿Qué usa Jorge?");
		await expect(page.locator(".chatbox__message--assistant")).toContainText(
			"Usa Preact y Fastify."
		);

		const visibleCopies = await page.evaluate((needle) => {
			const copies: string[] = [];
			for (const element of Array.from(document.querySelectorAll<HTMLElement>(".chatbox *"))) {
				if ((element.textContent ?? "").trim() !== needle) continue;
				const style = window.getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				// "Visualmente oculto" no es `display: none`: el patrón del clip deja el
				// elemento en el árbol de accesibilidad, y por eso hay que mirar la caja.
				const hidden =
					style.display === "none" ||
					style.visibility === "hidden" ||
					(rect.width <= 1 && rect.height <= 1);
				if (hidden) continue;
				const inBubble = element.closest(".chatbox__message--assistant");
				copies.push(inBubble ? "chatbox__message--assistant" : element.className);
			}
			return copies;
		}, "Usa Preact y Fastify.");

		expect(visibleCopies).toEqual(["chatbox__message--assistant"]);
	});

	test("mientras carga el markdown, la burbuja no queda en blanco", async ({ page }) => {
		// El renderizador se carga diferido: sin el indicador, la copia que se acaba de ocultar
		// en la región dejaría la respuesta sin ver durante la carga.
		await page.route("**/react-markdown*", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1200));
			await route.continue();
		});
		await mockChatApi(page, tokenFrame("Usa Preact y Fastify."));
		await openChatbox(page);
		await sendQuestion(page, "¿Qué usa Jorge?");

		const bubble = page.locator(".chatbox__message--assistant");
		await expect(bubble.locator(".chatbox__typing")).toBeVisible();
		await expect(bubble).toContainText("Usa Preact y Fastify.");
	});

	test("el error se sigue viendo en la región", async ({ page }) => {
		// El error no está en ninguna otra parte: si la región lo ocultara, nadie lo vería.
		await page.route("**/api/chat", (route) => route.fulfill({ status: 500, body: "boom" }));
		await openChatbox(page);
		await sendQuestion(page, "¿Qué usa Jorge?");

		const region = page.locator(".chatbox__status");
		await expect(region).toBeVisible();
		await expect(region).toHaveText(strings.errors.HTTP_SERVER);
	});
});
