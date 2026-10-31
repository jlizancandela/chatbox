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
import { followThreshold } from "../../src/chat/domain/scroll";
import { strings } from "../../src/strings.es";

const ANSWER_WORDS = 20;
const TOKENS = 60;

/** Cuánto se aparta la persona del final en un gesto pequeño (RF-F48). */
const APARTE_UN_POCO_PX = 30;

/**
 * Sustituye el `fetch` del API por un stream SSE que emite tokens con retardo.
 *
 * El body de una respuesta HTTP llega entero, así que el mock de `test/chat-frames.ts`
 * entrega los tokens de golpe: con esa señal el hilo nunca llega a crecer mientras se
 * transmite, y el seguimiento no se puede observar.
 *
 * El stream se puede **pausar desde el test** (`pauseStream`/`resumeStream`). Sin la pausa,
 * «apartarse» y «llegar un token» compiten: el widget conoce el movimiento por el evento
 * `scroll`, que el navegador entrega en el siguiente frame, y un token que llegue antes
 * puede devolver el hilo al final aunque la persona se haya apartado. Esa carrera no se
 * puede reproducir de forma determinista desde un test, y no es lo que estas pruebas
 * miden: lo que miden es que, una vez el widget sabe que la persona se apartó, deja de
 * seguirla mientras sigue llegando texto.
 */
async function slowStream(
	page: Page,
	tokens: number,
	delayMs = 40,
	words = ANSWER_WORDS
): Promise<void> {
	await page.addInitScript(
		({ count, delay, words }) => {
			type Gate = { paused: boolean; waiters: Array<() => void> };
			const gate: Gate = { paused: false, waiters: [] };
			const host = window as unknown as {
				__chatboxStream: { pause: () => void; resume: () => void };
			};
			host.__chatboxStream = {
				pause: () => {
					gate.paused = true;
				},
				resume: () => {
					gate.paused = false;
					for (const waiter of gate.waiters.splice(0)) waiter();
				},
			};
			const waitIfPaused = () =>
				gate.paused ? new Promise<void>((resolve) => gate.waiters.push(resolve)) : undefined;

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
							await waitIfPaused();
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

const streamControl = (page: Page) => {
	const call = (action: "pause" | "resume") =>
		page.evaluate((name) => {
			const host = window as unknown as { __chatboxStream: Record<string, () => void> };
			host.__chatboxStream[name]();
		}, action);
	return { pause: () => call("pause"), resume: () => call("resume") };
};

/**
 * Aparta a la persona con el stream en pausa y espera a que el widget lo sepa (el botón
 * «Ir al final» solo aparece cuando ha procesado el movimiento). Devuelve la posición y el
 * control para reanudar: así el movimiento no compite con un token y la comprobación de que
 * el hilo no vuelve solo se hace con el stream ya en marcha.
 */
async function moveAway(
	page: Page,
	mode: { toStart: true } | { awayBy: number }
): Promise<{ scrollTop: number; resume: () => Promise<void> }> {
	const stream = streamControl(page);
	await stream.pause();
	// Un token puede estar ya en el pipe: se le da su intervalo para que aterrice antes de
	// mover nada, y así ningún token compite con el evento `scroll` del movimiento.
	await page.waitForTimeout(120);

	const scrollTop = await page.evaluate((away) => {
		const conversation = document.querySelector(".chatbox__conversation") as HTMLElement;
		conversation.scrollTop =
			"toStart" in away ? 0 : conversation.scrollHeight - conversation.clientHeight - away.awayBy;
		return conversation.scrollTop;
	}, mode);

	await expect(page.getByRole("button", { name: strings.actions.scrollToEnd })).toBeVisible();
	return { scrollTop, resume: stream.resume };
}

/** Lee la posición del hilo durante un tramo del stream: un solo salto ya es un fallo. */
async function positionsWhileStreaming(page: Page, samples = 8): Promise<number[]> {
	const positions: number[] = [];
	for (let index = 0; index < samples; index++) {
		const state = await threadState(page);
		positions.push(state.scrollTop);
		await page.waitForTimeout(60);
	}
	return positions;
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
		await page.goto("/?widget=embedded");
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
		await page.goto("/?widget=embedded");
		await ask(page);

		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra0");
		await expect
			.poll(async () => (await threadState(page)).atBottom, {
				message: "el hilo tiene que volver al final cuando crece la burbuja",
			})
			.toBe(true);
	});

	test("apartarse un poco tampoco es «seguir»", async ({ page }) => {
		await slowStream(page, TOKENS);
		await page.goto("/?widget=embedded");
		await ask(page);

		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra2");
		await expect.poll(async () => (await threadState(page)).atBottom).toBe(true);

		// Precondición: el hilo tiene que desbordar lo suficiente para que apartarse sea
		// un gesto de verdad. Si todavía no desborda, el desplazamiento se queda en el
		// tope del hilo, la distancia al final es cero y parece que la persona no se ha
		// apartado: el botón no aparecería y la comprobación no probaría nada.
		await expect
			.poll(async () => {
				const state = await threadState(page);
				return state.scrollHeight - state.clientHeight;
			})
			.toBeGreaterThan(APARTE_UN_POCO_PX);

		// 30 px del final: más que el umbral (16 px) y menos que lo que el widget toleraba
		// antes (80 px). Un gesto pequeño de verdad es un apartarse de verdad.
		const away = await moveAway(page, { awayBy: APARTE_UN_POCO_PX });

		// Y el hilo se queda donde lo dejó mientras sigue llegando texto.
		await away.resume();
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra10");
		const positions = await positionsWhileStreaming(page);
		expect(positions, "el hilo no tiene que volver solo al final").toEqual(
			positions.map(() => away.scrollTop)
		);
	});

	test("no arrastra a quien se aparta del hilo", async ({ page }) => {
		await slowStream(page, TOKENS);
		await page.goto("/?widget=embedded");
		await ask(page);

		// La respuesta tiene que haber llegado: el hilo que se aparta es el que ya tiene
		// contenido, no un bocadillo vacío.
		await expect(page.locator(".chatbox__message--assistant")).toContainText("palabra2");
		// Precondición: tiene que haber hilo que apartar. La regla es la del widget
		// (RF-F48): subir el hilo deja a la persona a una distancia del final igual al
		// desborde, así que el desborde tiene que superar el umbral.
		await expect
			.poll(async () => {
				const state = await threadState(page);
				return state.scrollHeight - state.clientHeight - followThreshold;
			})
			.toBeGreaterThan(0);
		await expect.poll(async () => (await threadState(page)).atBottom).toBe(true);

		// Quien se aparta lee por su cuenta: el hilo se queda donde lo dejó y aparece el
		// botón para volver.
		const away = await moveAway(page, { toStart: true });
		expect(away.scrollTop).toBe(0);

		// Y sigue ahí mientras el resto de la respuesta llega: un solo salto ya es el
		// fallo que este test existe para cazar.
		await away.resume();
		const positions = await positionsWhileStreaming(page);
		expect(positions, "el hilo no tiene que volver solo al final").toEqual(positions.map(() => 0));
	});
});
