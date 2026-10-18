import type { ChatError } from "../types";

const error = (code: string, message: string): ChatError => ({ code, message });

export const chatErrors = {
	http(status: number): ChatError {
		switch (status) {
			case 400:
				return error("HTTP_400", "No se pudo enviar esa pregunta.");
			case 413:
				return error("HTTP_413", "La conversación es demasiado larga. Empieza una nueva.");
			case 429:
				return error("HTTP_429", "Has alcanzado el límite de preguntas. Inténtalo más tarde.");
			default:
				return error("HTTP_SERVER", "Algo ha fallado. Inténtalo de nuevo.");
		}
	},
	network: (): ChatError => error("NETWORK_ERROR", "No se pudo conectar. Comprueba tu conexión."),
	stream: (): ChatError => error("STREAM_ERROR", "No he podido completar la respuesta."),
	incomplete: (): ChatError => error("INCOMPLETE_STREAM", "La respuesta se interrumpió."),
	timeout: (): ChatError => error("TIMEOUT", "No se pudo conectar. Comprueba tu conexión."),
	invalidQuestion: (): ChatError => error("QUESTION_INVALID", "No se pudo enviar esa pregunta."),
};

export const isAbortError = (value: unknown): boolean =>
	typeof DOMException !== "undefined" &&
	value instanceof DOMException &&
	value.name === "AbortError";
