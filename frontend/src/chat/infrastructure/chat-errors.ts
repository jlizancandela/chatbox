import { strings } from "../../strings.es";
import type { ChatError } from "../types";

type ErrorCode = keyof typeof strings.errors;

// Cada error nace de su clave en el módulo de textos: aquí no vive ninguna redacción (RF-F62).
const error = (code: ErrorCode): ChatError => ({ code, message: strings.errors[code] });

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
	incomplete: (): ChatError => error("INCOMPLETE_STREAM"),
	timeout: (): ChatError => error("TIMEOUT"),
	invalidQuestion: (): ChatError => error("QUESTION_INVALID"),
};

export const isAbortError = (value: unknown): boolean =>
	typeof DOMException !== "undefined" &&
	value instanceof DOMException &&
	value.name === "AbortError";
