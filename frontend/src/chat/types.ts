export type ChatError = {
	code: string;
	message: string;
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

export type ErrorEvent = {
	type: "error";
	message: string;
};

export type TurnState = "idle" | "connecting" | "generating" | "streaming" | "error" | "aborted";
