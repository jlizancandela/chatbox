import { useCallback, useEffect, useRef } from "preact/hooks";
import type { ChatError } from "../application/chat-reducer";
import { buildChatRequest } from "../domain/conversation";
import { type ChatEvent, createSSEParser } from "../infrastructure/sse";
import type { ChatController } from "./useChat";

export const DEFAULT_TIMEOUT_MS = 30_000;

export type UseChatStreamOptions = {
	apiUrl: string;
	chat: ChatController;
	timeoutMs?: number;
	onSources?: (historyLength: number) => void;
};

export type UseChatStreamResult = {
	sendQuestion: (text: string) => Promise<void>;
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
	reader: ReadableStreamDefaultReader<Uint8Array> | null;
	timeoutId: TimerId | null;
	frameId: FrameId | null;
	pendingTokens: string;
	completed: boolean;
	failed: boolean;
	termination: "active" | "aborted" | "timeout";
};

const error = (code: string, message: string): ChatError => ({ code, message });

const mapHttpError = (status: number): ChatError => {
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
};

const networkError = (): ChatError =>
	error("NETWORK_ERROR", "No se pudo conectar. Comprueba tu conexión.");

const streamError = (): ChatError => error("STREAM_ERROR", "No he podido completar la respuesta.");

const incompleteStreamError = (): ChatError =>
	error("INCOMPLETE_STREAM", "La respuesta se interrumpió.");

const timeoutError = (): ChatError =>
	error("TIMEOUT", "No se pudo conectar. Comprueba tu conexión.");

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

const isAbortError = (value: unknown): boolean =>
	typeof DOMException !== "undefined" &&
	value instanceof DOMException &&
	value.name === "AbortError";

export type ChatStreamRunner = {
	update: (options: UseChatStreamOptions) => void;
	run: (text: string) => Promise<void>;
	abort: () => void;
	isActive: () => boolean;
};

export const createChatStreamRunner = (initialOptions: RunnerOptions): ChatStreamRunner => {
	let options = initialOptions;
	let active: ActiveTurn | null = null;

	const clearTimer = (): void => {
		if (active?.timeoutId !== null && active?.timeoutId !== undefined) {
			clearTimeout(active.timeoutId);
			active.timeoutId = null;
		}
	};

	const clearFrame = (): void => {
		if (active?.frameId !== null && active?.frameId !== undefined) {
			(options.cancelFrame ?? defaultCancelFrame)(active.frameId);
			active.frameId = null;
		}
	};

	const flushTokens = (): void => {
		if (!active || active.pendingTokens.length === 0) {
			return;
		}

		const tokens = active.pendingTokens;
		active.pendingTokens = "";
		options.chat.receiveToken(tokens);
	};

	const enqueueToken = (token: string): void => {
		if (!active) {
			return;
		}

		active.pendingTokens += token;
		if (active.frameId !== null) {
			return;
		}

		active.frameId = (options.requestFrame ?? defaultRequestFrame)(() => {
			if (!active) {
				return;
			}

			flushTokens();
			active.frameId = null;
		});
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
		active?.reader?.releaseLock();
		active = null;
	};

	const handleEvent = (event: ChatEvent): void => {
		switch (event.type) {
			case "sources":
				options.onSources?.(event.history.length);
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
				break;
			case "error":
				flushTokens();
				if (active) {
					active.failed = true;
				}
				options.chat.failTurn(streamError());
				break;
		}
	};

	const abort = (): void => {
		if (!active) {
			return;
		}

		active.termination = "aborted";
		active.controller.abort();
		active.reader?.cancel().catch(() => undefined);
		clearTimer();
		clearFrame();
		options.chat.abortTurn();
	};

	const run = async (text: string): Promise<void> => {
		if (active) {
			return;
		}

		let request: ReturnType<typeof buildChatRequest>;
		try {
			request = buildChatRequest(text, options.chat.state.context);
		} catch {
			options.chat.failTurn(error("QUESTION_INVALID", "No se pudo enviar esa pregunta."));
			return;
		}

		const turn: ActiveTurn = {
			controller: new AbortController(),
			reader: null,
			timeoutId: null,
			frameId: null,
			pendingTokens: "",
			completed: false,
			failed: false,
			termination: "active",
		};
		active = turn;
		options.chat.startTurn(request.question);
		armTimeout();

		try {
			const response = await (options.fetchImpl ?? fetch)(`${options.apiUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request),
				signal: turn.controller.signal,
			});

			if (!response.ok) {
				options.chat.failTurn(mapHttpError(response.status));
				return;
			}

			if (!response.body) {
				options.chat.failTurn(networkError());
				return;
			}

			const reader = response.body.getReader();
			turn.reader = reader;
			const decoder = new TextDecoder();
			const parser = createSSEParser();

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				armTimeout();
				const chunk = decoder.decode(value, { stream: true });
				for (const event of parser.feed(chunk)) {
					handleEvent(event);
					if (turn.failed) {
						break;
					}
				}
				if (turn.failed) {
					break;
				}
			}

			if (turn.termination === "active" && !turn.completed && !turn.failed) {
				flushTokens();
				options.chat.failTurn(incompleteStreamError());
			}
		} catch (caught) {
			if (turn.termination === "timeout") {
				options.chat.failTurn(timeoutError());
			} else if (turn.termination === "aborted" || isAbortError(caught)) {
				if (turn.termination !== "aborted") {
					options.chat.abortTurn();
				}
			} else if (caught instanceof TypeError) {
				options.chat.failTurn(networkError());
			} else {
				options.chat.failTurn(streamError());
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
		abort,
		isActive: () => active !== null,
	};
};

export const useChatStream = (options: UseChatStreamOptions): UseChatStreamResult => {
	const runnerRef = useRef<ChatStreamRunner | null>(null);

	if (runnerRef.current === null) {
		runnerRef.current = createChatStreamRunner(options);
	}

	runnerRef.current.update(options);

	const sendQuestion = useCallback(
		(text: string) => runnerRef.current?.run(text) ?? Promise.resolve(),
		[]
	);
	const abort = useCallback(() => runnerRef.current?.abort(), []);

	useEffect(() => () => runnerRef.current?.abort(), []);

	return {
		sendQuestion,
		abort,
		isStreaming: runnerRef.current.isActive(),
	};
};
