/**
 * Fixture de verificación manual de la región de estado (RF-F41).
 *
 * La ADR 005 deja el cierre de la issue en el nivel 3: comprobar con NVDA y VoiceOver que
 * lo que hay en la región **suena**. Ese nivel necesita el widget funcionando, y el widget
 * habla con una API que exige PostgreSQL y claves de entorno. Este fixture quita ese
 * requisito: monta el `Chatbox` real con un `fetch` sustituido por un guion, para que el
 * recorrido se pueda hacer con `npm run dev` y nada más.
 *
 * Solo se carga en desarrollo y solo con `?manual=<escenario>` en la URL. La página de
 * desarrollo por defecto y los browser tests no se tocan.
 *
 * No hay copy de interfaz aquí a propósito: el escenario vive en la URL y la lista está en
 * el spec. La respuesta del asistente es contenido que en producción llega del modelo, no
 * redacción del widget, así que no pertenece a `strings.es.ts`.
 */

import { render } from "preact";
import { STORAGE_KEY } from "../chat/infrastructure/storage";
import { Chatbox } from "../components/Chatbox";

const API_URL = "http://127.0.0.1:7000";

/** Escenarios, en el orden del checklist manual de la issue #91. */
export const SCENARIOS = ["normal", "identical", "error", "abort", "empty", "restore"] as const;

export type Scenario = (typeof SCENARIOS)[number];

const ANSWER =
	"Jorge trabaja con **Preact** y `Fastify`. Tienes su [GitHub](https://github.com/jlizancandela).";

const PREVIOUS_ANSWER = "Esta respuesta viene de la sesión anterior y no debe anunciarse.";

const frame = (event: string, data: unknown): string =>
	`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const streamed = (answer: string | null): Response => {
	const body =
		frame("sources", { sources: [], history: [] }) +
		(answer === null ? "" : frame("token", { token: answer })) +
		frame("done", {});

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(body));
			controller.close();
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
};

const hung = (): Promise<Response> => new Promise<Response>(() => {});

const respondFor = (scenario: Scenario): (() => Promise<Response>) => {
	switch (scenario) {
		case "normal":
			return () => Promise.resolve(streamed(ANSWER));
		case "identical":
			// Misma respuesta en cada turno: comprueba que el aviso de "escribiendo" hace que
			// el lector vuelva a anunciarla aunque el texto sea idéntico al anterior.
			return () => Promise.resolve(streamed(ANSWER));
		case "error":
			return () => Promise.resolve(new Response(null, { status: 500 }));
		case "abort":
			return hung;
		case "empty":
			return () => Promise.resolve(streamed(null));
		case "restore":
			return () => Promise.resolve(streamed(ANSWER));
	}
};

const isScenario = (value: string): value is Scenario =>
	(SCENARIOS as readonly string[]).includes(value);

/**
 * Siembra una conversación antes de montar: el widget la restaura y, por D4, la región de
 * estado no debe decir nada. Hay que recargar la URL para volver a comprobarlo.
 */
const seedRestoredConversation = (): void => {
	window.sessionStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({
			messages: [{ role: "assistant", content: PREVIOUS_ANSWER }],
			context: [],
		})
	);
};

export function mountManualScenario(scenario: string, container: HTMLElement): boolean {
	if (!isScenario(scenario)) return false;

	if (scenario === "restore") {
		window.sessionStorage.removeItem(STORAGE_KEY);
		seedRestoredConversation();
	} else {
		window.sessionStorage.removeItem(STORAGE_KEY);
	}

	const respond = respondFor(scenario);
	const originalFetch = window.fetch;
	window.fetch = (() => Promise.resolve(respond())) as typeof window.fetch;

	const stop = (): void => {
		window.fetch = originalFetch;
	};
	window.addEventListener("pagehide", stop, { once: true });

	render(<Chatbox apiUrl={API_URL} />, container);
	return true;
}
