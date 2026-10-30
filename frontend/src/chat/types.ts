export type ChatError = {
	code: string;
	message: string;
	/**
	 * Lo que el proveedor dijo que hay que esperar antes de reintentar. Se conserva para que
	 * la interfaz pueda decidir qué decir; no se usa para reintentar sola (#144).
	 */
	retryAfterSeconds?: number;
};

export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

export type ChatSource = {
	documentId: string;
	chunkIndex: number;
	title: string;
	content: string;
	distance: number;
};

/**
 * Mensaje visible en la conversación: un mensaje del API más las fuentes de la
 * respuesta. Las fuentes no se envían de vuelta al API —son la atribución de lo que
 * se ve, no parte del contexto— y por eso no viajan en el historial.
 */
export type VisibleMessage = ChatMessage & {
	sources?: ChatSource[];
};

export type SourcesEvent = {
	type: "sources";
	sources: ChatSource[];
	history: ChatMessage[];
};

export type TokenEvent = {
	type: "token";
	token: string;
};

export type DoneEvent = {
	type: "done";
};

/**
 * Por qué falló el stream, tal como lo clasifica el servidor. Son valores de contrato, no
 * texto: el mensaje que ve el visitante lo elige el cliente (RF-F14).
 */
export type StreamErrorCode = "GENERATION_FAILED" | "QUOTA_EXHAUSTED" | "SESSION_BUDGET_EXCEEDED";

export type ErrorEvent = {
	type: "error";
	code: StreamErrorCode;
	message: string;
	retryAfterSeconds?: number;
};

export type TurnState = "idle" | "connecting" | "generating" | "streaming" | "error" | "aborted";
