/**
 * RF-F41 — la pasada automática con axe sobre el widget (issue #113).
 *
 * Nivel de verificación: **resolución**. Cada test escanea el widget en un estado distinto,
 * en los dos esquemas de color, y exige cero violaciones del nivel auditado.
 *
 * Lo que esto **no** comprueba: que un lector de pantalla anuncie nada. Ninguna máquina
 * comprueba eso. Lo que sí comprueba es que lo que el widget anuncia existe en el árbol de
 * accesibilidad y que nada del widget viola el nivel auditado. Ver
 * `docs/decisions/005-live-region-verification.md`.
 *
 * El widget tiene estados que no se ven si solo se mira el estado inicial: con un turno en
 * marcha, con un error, con una conversación restaurada o con la confirmación abierta, el
 * DOM es otro. La pasada los recorre todos, porque un escaneo del estado inicial no audita
 * el widget: audita una de sus formas.
 */

import { expect, type Page, test } from "@playwright/test";
import { strings } from "../../src/strings.es";
import { axeViolations } from "../axe";
import { doneFrame, mockChatApi, sourcesFrame, tokenFrame } from "../chat-frames";

const STORAGE_KEY = "chatbox:v1";

/** Una fuente real, para que la línea de atribución exista en el DOM que se escanea. */
const SOURCE = {
	documentId: "doc-1",
	chunkIndex: 0,
	title: "Currículum — Jorge.pdf",
	content: "Jorge trabaja con Preact y Fastify.",
	distance: 0.12,
};

const RESPUESTA = "Usa **Preact** y `Fastify`.";

async function openChatbox(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.locator(".chatbox")).toBeVisible();
}

async function sendQuestion(page: Page, question = "¿Qué usa Jorge?"): Promise<void> {
	await page.locator("#chatbox-question").fill(question);
	await page.getByRole("button", { name: strings.input.send.ariaLabel }).click();
}

/**
 * Retiene la respuesta del API detrás de una puerta que abre el test.
 *
 * Un retardo fijo dejaría las aserciones dentro de una ventana que el test no controlaba:
 * en un runner lento la respuesta llegaba antes de que el test mirara (R3-001). La puerta
 * no depende del reloj.
 */
async function holdAnswer(page: Page): Promise<() => void> {
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});

	await page.route("**/api/chat", async (route) => {
		await gate;
		await route.fulfill({
			status: 200,
			contentType: "text/event-stream",
			body: sourcesFrame() + tokenFrame(RESPUESTA) + doneFrame,
		});
	});

	return release;
}

/** Un estado del widget que se puede escanear. */
type Estado = {
	/** El nombre del estado, en la nomenclatura del glosario. */
	nombre: string;
	/** Monta el widget en ese estado y espera a que esté en él. */
	montar: (page: Page) => Promise<void>;
};

const ESTADOS: Estado[] = [
	{
		nombre: "estado vacío",
		montar: async (page) => {
			await openChatbox(page);
			await expect(page.locator(".chatbox__empty")).toBeVisible();
		},
	},
	{
		nombre: "turno en marcha",
		montar: async (page) => {
			await holdAnswer(page);
			await openChatbox(page);
			await sendQuestion(page);
			// El aviso de escritura vive en el bocadillo y es decorativo: lo anuncia la
			// región de estado, que es lo que se escanea.
			await expect(page.locator(".chatbox__writing")).toBeVisible();
			await expect(page.locator(".chatbox__status")).toHaveText(strings.messages.writing);
		},
	},
	{
		nombre: "respuesta anunciada",
		montar: async (page) => {
			await mockChatApi(page, sourcesFrame([], [SOURCE]), tokenFrame(RESPUESTA));
			await openChatbox(page);
			await sendQuestion(page);
			await expect(page.locator(".chatbox__message--assistant")).toContainText(
				"Usa Preact y Fastify."
			);
			await expect(page.locator(".chatbox__sources")).toBeVisible();
			await expect(page.locator(".chatbox__status")).toHaveText(/Usa Preact y Fastify\./);
		},
	},
	{
		nombre: "turno sin respuesta",
		montar: async (page) => {
			await mockChatApi(page);
			await openChatbox(page);
			await sendQuestion(page);
			await expect(page.locator(".chatbox__status")).toHaveText(strings.notices.noContext);
		},
	},
	{
		nombre: "turno fallido",
		montar: async (page) => {
			await page.route("**/api/chat", (route) => route.fulfill({ status: 500, body: "boom" }));
			await openChatbox(page);
			await sendQuestion(page);
			await expect(page.locator(".chatbox__status")).toHaveText(strings.errors.HTTP_SERVER);
		},
	},
	{
		nombre: "turno detenido",
		montar: async (page) => {
			await holdAnswer(page);
			await openChatbox(page);
			await sendQuestion(page);
			await page.getByRole("button", { name: strings.input.stop.ariaLabel }).click();
			await expect(page.locator(".chatbox__status")).toHaveText(strings.messages.stopped);
		},
	},
	{
		nombre: "conversación restaurada",
		montar: async (page) => {
			await page.addInitScript(([key, value]) => window.sessionStorage.setItem(key, value), [
				STORAGE_KEY,
				JSON.stringify({
					messages: [{ role: "assistant", content: "Respuesta de la sesión anterior" }],
					context: [],
				}),
			] as const);
			await openChatbox(page);
			await expect(page.locator(".chatbox__messages")).toBeVisible();
		},
	},
	{
		nombre: "confirmación abierta",
		montar: async (page) => {
			await mockChatApi(page, sourcesFrame([], [SOURCE]), tokenFrame(RESPUESTA));
			await openChatbox(page);
			await sendQuestion(page);
			await expect(page.locator(".chatbox__message--assistant")).toContainText(
				"Usa Preact y Fastify."
			);
			await page.getByRole("button", { name: strings.actions.newConversation }).click();
			await expect(
				page.getByRole("button", { name: strings.actions.confirm.accept })
			).toBeVisible();
		},
	},
];

for (const esquema of ["light", "dark"] as const) {
	for (const estado of ESTADOS) {
		test(`RF-F41 — axe: ${estado.nombre} (${esquema})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: esquema });
			await estado.montar(page);

			expect(await axeViolations(page)).toEqual([]);
		});
	}
}

/**
 * La entrada que rechaza: la pasada tiene que **detectar** una violación real.
 *
 * Sin este test, un escaneo que no mira, o que mira un sitio donde no puede haber nada,
 * pasa en verde y no protege nada: es un detector cuyo test nunca falla. Aquí se inyecta
 * una imagen sin texto alternativo dentro del widget —una violación de WCAG 1.1.1 que cae
 * de lleno en el nivel auditado— y se exige que la pasada la reporte.
 */
test("RF-F41 — la pasada detecta una violación real", async ({ page }) => {
	await openChatbox(page);

	await page.evaluate(() => {
		const widget = document.querySelector(".chatbox");
		const image = document.createElement("img");
		image.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
		image.width = 20;
		image.height = 20;
		widget?.append(image);
	});

	const violations = await axeViolations(page);

	expect(violations.map((violation) => violation.id)).toContain("image-alt");
});
