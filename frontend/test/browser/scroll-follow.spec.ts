/**
 * RF-F06 — el seguimiento del hilo (issue #102).
 *
 * Nivel de verificación: **resolución**. El widget tiene que mantener el hilo al final
 * mientras llega la respuesta, seguirlo cuando el contenido crece después (el markdown del
 * asistente se carga diferido, RF-F30) y no arrastrar a quien se aparta.
 *
 * El guion usa un stream SSE con retardos reales: el mock que sirve la respuesta entera de
 * golpe no genera los casos en los que el seguimiento importa, porque la respuesta llega
 * antes de que haya nada que seguir.
 *
 * Ver `frontend/.specs/RF-F06-seguimiento-del-hilo.md`.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";

const ANSWER_WORDS = 20;
const TOKENS = 60;

/**
 * Desborde mínimo del hilo para que subirlo sea apartarse de verdad.
 *
 * El widget trata como "seguir" lo que queda a menos de ~80 px del final (RF-F06), así
 * que la respuesta tiene que desbordar la conversación con holgura: 300 px es esa
 * holgura, para que el test no dependa del borde ni de la longitud del guion.
 */
const DESBORDE_MINIMO_PX = 300;

/**
 * Sustituye el `fetch` del API por un stream SSE que emite tokens con retardo.
 *
 * El body de una respuesta HTTP llega entero, así que el mock de `test/chat-frames.ts`
 * entrega los tokens de golpe: con esa señal el hilo nunca llega a crecer mientras se
 * transmite, y el seguimiento no se puede observar.
 */
async function slowStream(
	page: Page,
	tokens: number,
	delayMs = 40,
	words = ANSWER_WORDS
): Promise<void> {
	await page.addInitScript(
		({ count, delay, words }) => {
			const original = window.fetch.bind(window);
			window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
				if (!String(input).includes("/api/chat")) return original(input, init);
				const encoder = new TextEncoder();
				const stream = new ReadableStream<Uint8Array>({
					async start(controller) {
						controller.enqueue(
							encoder.encode('event: sources\ndata: {"sources":[],"history":[]}\n\n')
						);
						for (let index = 0; index < count; index++) {
							await new Promise((resolve) => setTimeout(resolve, delay));
							const text = Array.from(
								{ length: words },
								(_, word) => `palabra${index}_${word}`
							).join(" ");
							controller.enqueue(
								encoder.encode(`event: token\ndata: ${JSON.stringify({ token: ` ${text}` })}\n\n`)
							);
						}
						controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
						controller.close();
					},
				});
				return new Response(stream, {
					status: 200,
					headers: { "Content-Type": "text/event-stream" },
				});
			};
		},
		{ count: tokens, delay: delayMs, words }
	);
}

type ThreadState = {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
	atBottom: boolean;
};

const threadState = (page: Page): Promise<ThreadState> =>
	page.evaluate(() => {
		const conversation = document.querySelector(".chatbox__conversation");
		if (!conversation) {
			return { scrollTop: 0, scrollHeight: 0, clientHeight: 0, atBottom: true };
		}
		return {
			scrollTop: conversation.scrollTop,
			scrollHeight: conversation.scrollHeight,
			clientHeight: conversation.clientHeight,
			atBottom: conversation.scrollTop + conversation.clientHeight >= conversation.scrollHeight - 1,
		};
	});

const ask = async (page: Page): Promise<void> => {
	await page.locator("#chatbox-question").fill("Cuéntame algo largo");
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
};

test.describe("RF-F06 — el hilo sigue a la respuesta", () => {
	test.use({ viewport: { width: 420, height: 900 } });

	test("llega al final mientras se transmite", async ({ page }) => {
		await slowStream(page, TOKENS);
		await page.goto("/");
		await ask(page);

		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra0");
		await expect
			.poll(async () => (await threadState(page)).atBottom, {
				message: "el hilo tiene que llegar al final mientras llega la respuesta",
			})
			.toBe(true);
	});

	test("sigue al final cuando el markdown crece después", async ({ page }) => {
		// El markdown se carga diferido: la burbuja crece cuando llega, después del último
		// cambio de estado. Sin observarlo, el hilo se queda donde estaba.
		await page.route("**/react-markdown*", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 400));
			await route.continue();
		});
		// Una sola respuesta, pero larga: el hilo tiene que desbordar para que el crecimiento
		// del markdown tenga a dónde empujar.
		await slowStream(page, 1, 40, 800);
		await page.goto("/");
		await ask(page);

		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra0");
		console.log("MEDIDA VIEJO:", JSON.stringify(await threadState(page)));
		await expect
			.poll(async () => (await threadState(page)).atBottom, {
				message: "el hilo tiene que volver al final cuando crece la burbuja",
			})
			.toBe(true);
	});

	test("no arrastra a quien se aparta del hilo", async ({ page }) => {
		await slowStream(page, TOKENS);
		await page.goto("/");
		await ask(page);

		// La respuesta tiene que haber llegado: el hilo que se aparta es el que ya tiene
		// contenido, no un bocadillo vacío.
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra2");
		// Precondición: tiene que haber hilo que apartar. El widget trata como "seguir" lo
		// que queda a menos de ~80 px del final (RF-F06), así que la respuesta tiene que
		// desbordar la conversación con holgura antes de subir el hilo.
		await expect
			.poll(async () => {
				const state = await threadState(page);
				return state.scrollHeight - state.clientHeight;
			})
			.toBeGreaterThan(DESBORDE_MINIMO_PX);
		await expect.poll(async () => (await threadState(page)).atBottom).toBe(true);

		// Quien se aparta lee por su cuenta: el hilo se queda donde lo dejó y aparece el
		// botón para volver.
		await page.evaluate(() => {
			const conversation = document.querySelector(".chatbox__conversation");
			if (conversation) conversation.scrollTop = 0;
		});
		await expect(page.getByRole("button", { name: strings.actions.scrollToEnd })).toBeVisible();

		const away = await threadState(page);
		expect(away.scrollTop, "el hilo no tiene que volver solo al final").toBe(0);
	});
});
