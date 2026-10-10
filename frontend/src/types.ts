export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

export type ChatSource = {
	documentId: string;
	chunkIndex: number;
	content: string;
	distance: number;
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
