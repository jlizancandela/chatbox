import { strings } from "../../strings.es";
import type { ChatError, ErrorEvent } from "../types";

type ErrorCode = keyof typeof strings.errors;

// Cada error nace de su clave en el módulo de textos: aquí no vive ninguna redacción (RF-F62).
const error = (code: ErrorCode): ChatError => ({ code, message: strings.errors[code] });

/**
 * Cuota agotada. El servidor solo manda el código; el texto lo decide el widget, y el aviso
 * de reintento viaja con el error para que no se pierda por el camino (#144).
 */
const quota = (retryAfterSeconds?: number): ChatError => ({
	...error("QUOTA_EXHAUSTED"),
	...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

export const chatErrors = {
	http(status: number): ChatError {
		switch (status) {
			case 400:
				return error("HTTP_400");
			case 413:
				return error("HTTP_413");
			case 429:
				return error("HTTP_429");
			default:
				return error("HTTP_SERVER");
		}
	},
	network: (): ChatError => error("NETWORK_ERROR"),
	stream: (): ChatError => error("STREAM_ERROR"),
	/**
	 * El evento `error` del stream, traducido por su código: cuota, presupuesto de la
	 * conversación o fallo genérico. El corte por presupuesto es un tope, no una avería,
	 * y su texto ofrece la salida (#148).
	 */
	streamEvent: (event: ErrorEvent): ChatError => {
		if (event.code === "QUOTA_EXHAUSTED") {
			return quota(event.retryAfterSeconds);
		}

		if (event.code === "SESSION_BUDGET_EXCEEDED") {
			return error("SESSION_BUDGET_EXCEEDED");
		}

		return error("STREAM_ERROR");
	},
	incomplete: (): ChatError => error("INCOMPLETE_STREAM"),
	timeout: (): ChatError => error("TIMEOUT"),
	invalidQuestion: (): ChatError => error("QUESTION_INVALID"),
};

export const isAbortError = (value: unknown): boolean =>
	typeof DOMException !== "undefined" &&
	value instanceof DOMException &&
	value.name === "AbortError";
