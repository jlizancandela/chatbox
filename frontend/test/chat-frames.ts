/**
 * Frames SSE y ayudante de intercepción que comparten la verificación de la región de estado
 * (RF-F41) y la del contraste (RF-F42).
 *
 * Sin imports de runtime: este módulo lo usan tanto la suite de componente (jsdom) como la
 * de navegador (Playwright), y cada una trae su propio mecanismo de intercepción.
 */

import type { Page } from "@playwright/test";

export const sourcesFrame = (history: unknown[] = [], sources: unknown[] = []): string =>
	`event: sources\ndata: ${JSON.stringify({ sources, history })}\n\n`;

export const tokenFrame = (token: string): string =>
	`event: token\ndata: ${JSON.stringify({ token })}\n\n`;

export const doneFrame = "event: done\ndata: {}\n\n";

/**
 * Enruta `POST /api/chat` a un stream SSE: las fuentes al principio y el cierre al final,
 * con los frames que se le pasen en medio.
 */
export async function mockChatApi(page: Page, ...frames: string[]): Promise<void> {
	await page.route("**/api/chat", (route) =>
		route.fulfill({
			status: 200,
			contentType: "text/event-stream",
			body: sourcesFrame() + frames.join("") + doneFrame,
		})
	);
}

/**
 * Deja la respuesta del API en el aire detrás de una puerta: el turno queda en curso sin
 * depender del reloj. Devuelve la llave para abrirla.
 *
 * Un retardo fijo deja las aserciones dentro de una ventana que el test no controla: en un
 * runner lento la respuesta llega antes de que el test mire (R3-001). La puerta no depende
 * del reloj.
 */
export async function holdChatAnswer(page: Page, ...frames: string[]): Promise<() => void> {
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});

	await page.route("**/api/chat", async (route) => {
		await gate;
		await route.fulfill({
			status: 200,
			contentType: "text/event-stream",
			body: sourcesFrame() + frames.join("") + doneFrame,
		});
	});

	return release;
}
