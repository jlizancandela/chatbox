/**
 * Frames SSE y ayudante de intercepción que comparten la verificación de la región de estado
 * (RF-F41) y la del contraste (RF-F42).
 *
 * Sin imports de runtime: este módulo lo usan tanto la suite de componente (jsdom) como la
 * de navegador (Playwright), y cada una trae su propio mecanismo de intercepción.
 */

import type { Page } from "@playwright/test";

export const sourcesFrame = (history: unknown[] = []): string =>
	`event: sources\ndata: ${JSON.stringify({ sources: [], history })}\n\n`;

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
