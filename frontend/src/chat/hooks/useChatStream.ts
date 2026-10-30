import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { buildChatRequest } from "../domain/conversation";
import { chatErrors, isAbortError } from "../infrastructure/chat-errors";
import type { ChatEvent } from "../infrastructure/sse";
import { readChatEvents, requestChatStream } from "../infrastructure/stream-transport";
import { createTokenBuffer, type TokenBuffer } from "../infrastructure/token-buffer";
import type { ChatError, ChatSource } from "../types";
import type { ChatController } from "./useChat";

export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fin de turno tal como lo ve quien usa el widget: el texto que se anuncia vive aquí y no
 * en el estado, porque `turn-completed` ya lo ha limpiado cuando el evento se emite (RF-F41).
 * `completed` con `text` vacío significa que el asistente no tenía nada que decir.
 * Las fuentes viajan con el desenlace porque también se anuncian: lo que se ve, se oye.
 */
export type TurnEnd =
	| { kind: "completed"; text: string; sources: ChatSource[] }
	| { kind: "failed"; error: ChatError }
	| { kind: "aborted" };

export type UseChatStreamOptions = {
	apiUrl: string;
	chat: ChatController;
	timeoutMs?: number;
	onSources?: (historyLength: number) => void;
	onActivityChange?: (active: boolean) => void;
	onTurnEnd?: (event: TurnEnd) => void;
};

export type UseChatStreamResult = {
	sendQuestion: (text: string) => Promise<void>;
	retryQuestion: (text: string) => Promise<void>;
	abort: () => void;
	isStreaming: boolean;
};

type TimerId = ReturnType<typeof setTimeout>;
type FrameId = number;

type RunnerOptions = UseChatStreamOptions & {
	fetchImpl?: typeof fetch;
	requestFrame?: (callback: FrameRequestCallback) => FrameId;
	cancelFrame?: (frame: FrameId) => void;
};

type ActiveTurn = {
	controller: AbortController;
	timeoutId: TimerId | null;
	completed: boolean;
	failed: boolean;
	ended: boolean;
	assistantText: string;
	sources: ChatSource[];
	termination: "active" | "aborted" | "timeout";
};

const mapHttpError = chatErrors.http;

const defaultRequestFrame = (callback: FrameRequestCallback): FrameId => {
	if (typeof requestAnimationFrame === "function") {
		return requestAnimationFrame(callback);
	}

	return setTimeout(callback, 0) as unknown as FrameId;
};

const defaultCancelFrame = (frame: FrameId): void => {
	if (typeof cancelAnimationFrame === "function") {
		cancelAnimationFrame(frame);
		return;
	}

	clearTimeout(frame);
};

export type ChatStreamRunner = {
	update: (options: UseChatStreamOptions) => void;
	run: (text: string) => Promise<void>;
	retry: (text: string) => Promise<void>;
	abort: () => void;
	isActive: () => boolean;
};

export const createChatStreamRunner = (initialOptions: RunnerOptions): ChatStreamRunner => {
	let options = initialOptions;
	let active: ActiveTurn | null = null;
	let tokenBuffer: TokenBuffer | null = null;

	const clearTimer = (): void => {
		if (active?.timeoutId !== null && active?.timeoutId !== undefined) {
			clearTimeout(active.timeoutId);
			active.timeoutId = null;
		}
	};

	const clearFrame = (): void => {
		tokenBuffer?.cancel();
	};

	const flushTokens = (): void => {
		tokenBuffer?.flush();
	};

	const enqueueToken = (token: string): void => {
		// El texto anunciado se acumula aquí, antes de cualquier `requestFrame`: leerlo del
		// estado en `done` ya no es posible porque el dispatch aún no ha re-renderizado.
		if (active) active.assistantText += token;
		tokenBuffer?.enqueue(token);
	};

	const endTurn = (event: TurnEnd): void => {
		if (active?.ended === true) return;
		if (active) active.ended = true;
		options.onTurnEnd?.(event);
	};

	// Fallar o abortar son siempre la misma pareja: cambiar el estado del turno y emitir su
	// desenlace. Que vivan juntos es lo que hace cumplible el invariante de una salida, un evento.
	const failWith = (error: ChatError): void => {
		options.chat.failTurn(error, active?.assistantText);
		endTurn({ kind: "failed", error });
	};

	const abortWith = (): void => {
		options.chat.abortTurn();
		endTurn({ kind: "aborted" });
	};

	const armTimeout = (): void => {
		clearTimer();
		if (!active) {
			return;
		}

		active.timeoutId = setTimeout(() => {
			if (!active) {
				return;
			}

			active.termination = "timeout";
			active.controller.abort();
		}, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	};

	const cleanup = (): void => {
		clearTimer();
		clearFrame();
		tokenBuffer = null;
		active = null;
		options.onActivityChange?.(false);
	};

	const handleEvent = (event: ChatEvent): void => {
		switch (event.type) {
			case "sources":
				options.onSources?.(event.history.length);
				if (active) {
					active.sources = event.sources;
				}
				options.chat.receiveSources(event.sources, event.history);
				break;
			case "token":
				enqueueToken(event.token);
				break;
			case "done":
				flushTokens();
				if (active) {
					active.completed = true;
				}
				options.chat.completeTurn();
				endTurn({
					kind: "completed",
					text: active?.assistantText ?? "",
					sources: active?.sources ?? [],
				});
				break;
			case "error": {
				flushTokens();
				if (active) {
					active.failed = true;
				}
				// El código viaja desde el servidor: la cuota no es un fallo genérico y el
				// visitante merece saber que volver más tarde sirve (#144).
				failWith(chatErrors.streamEvent(event));
				break;
			}
		}
	};

	const abort = (): void => {
		if (!active) {
			return;
		}

		active.termination = "aborted";
		active.controller.abort();
		clearTimer();
		clearFrame();
		abortWith();
	};

	const run = async (text: string, retry = false): Promise<void> => {
		if (active) {
			return;
		}

		let request: ReturnType<typeof buildChatRequest>;
		try {
			request = buildChatRequest(text, options.chat.state.context);
		} catch {
			failWith(chatErrors.invalidQuestion());
			return;
		}

		const turn: ActiveTurn = {
			controller: new AbortController(),
			timeoutId: null,
			completed: false,
			failed: false,
			ended: false,
			assistantText: "",
			sources: [],
			termination: "active",
		};
		active = turn;
		tokenBuffer = createTokenBuffer({
			onFlush: (tokens) => options.chat.receiveToken(tokens),
			requestFrame: (callback) => (options.requestFrame ?? defaultRequestFrame)(() => callback(0)),
			cancelFrame: options.cancelFrame ?? defaultCancelFrame,
		});
		options.onActivityChange?.(true);
		if (retry) options.chat.retryTurn();
		else options.chat.startTurn(request.question);
		armTimeout();

		try {
			const response = await requestChatStream({
				apiUrl: options.apiUrl,
				body: request,
				signal: turn.controller.signal,
				fetchImpl: options.fetchImpl,
			});

			if (!response.ok) {
				failWith(mapHttpError(response.status));
				return;
			}

			if (!response.body) {
				failWith(chatErrors.network());
				return;
			}

			for await (const event of readChatEvents(response)) {
				armTimeout();
				handleEvent(event);
				if (turn.failed) break;
			}

			if (turn.termination === "active" && !turn.completed && !turn.failed) {
				flushTokens();
				failWith(chatErrors.incomplete());
			}
		} catch (caught) {
			if (turn.termination === "timeout") {
				failWith(chatErrors.timeout());
			} else if (turn.termination === "aborted" || isAbortError(caught)) {
				if (turn.termination !== "aborted") {
					abortWith();
				}
			} else if (caught instanceof TypeError) {
				failWith(chatErrors.network());
			} else {
				failWith(chatErrors.stream());
			}
		} finally {
			cleanup();
		}
	};

	return {
		update: (nextOptions) => {
			options = { ...options, ...nextOptions };
		},
		run,
		retry: (text) => run(text, true),
		abort,
		isActive: () => active !== null,
	};
};

export const useChatStream = (options: UseChatStreamOptions): UseChatStreamResult => {
	const [isStreaming, setIsStreaming] = useState(false);
	const runnerRef = useRef<ChatStreamRunner | null>(null);
	const runnerOptions = { ...options, onActivityChange: setIsStreaming };

	if (runnerRef.current === null) {
		runnerRef.current = createChatStreamRunner(runnerOptions);
	}

	runnerRef.current.update(runnerOptions);

	const sendQuestion = useCallback(
		(text: string) => runnerRef.current?.run(text) ?? Promise.resolve(),
		[]
	);
	const retryQuestion = useCallback(
		(text: string) => runnerRef.current?.retry(text) ?? Promise.resolve(),
		[]
	);
	const abort = useCallback(() => runnerRef.current?.abort(), []);

	useEffect(() => () => runnerRef.current?.abort(), []);

	return {
		sendQuestion,
		retryQuestion,
		abort,
		isStreaming,
	};
};
