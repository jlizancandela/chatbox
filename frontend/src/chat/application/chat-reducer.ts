import { type ConversationState, mergeContext } from "../domain/conversation";
import type { ChatError, ChatMessage, ChatSource, TurnState } from "../types";

export type ChatState = ConversationState & {
	currentQuestion: string | null;
	currentResponse: string;
	sources: ChatSource[];
	turnState: TurnState;
	error: ChatError | null;
};

export type ChatAction =
	| { type: "turn-started"; question: string }
	| { type: "sources-received"; sources: ChatSource[]; history: ChatMessage[] }
	| { type: "token-received"; token: string }
	| { type: "turn-completed" }
	| { type: "turn-failed"; error: ChatError }
	| { type: "turn-aborted" }
	| { type: "state-restored"; state: ConversationState }
	| { type: "conversation-reset" };

export const createInitialChatState = (initial: Partial<ConversationState> = {}): ChatState => ({
	messages: [...(initial.messages ?? [])],
	context: [...(initial.context ?? [])],
	currentQuestion: null,
	currentResponse: "",
	sources: [],
	turnState: "idle",
	error: null,
});

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
	switch (action.type) {
		case "turn-started":
			return {
				...state,
				messages: [...state.messages, { role: "user", content: action.question }],
				currentQuestion: action.question,
				currentResponse: "",
				sources: [],
				turnState: "connecting",
				error: null,
			};

		case "sources-received":
			return {
				...state,
				context: mergeContext(action.history),
				sources: action.sources.map((source) => ({ ...source })),
				turnState: "generating",
			};

		case "token-received":
			return {
				...state,
				currentResponse: state.currentResponse + action.token,
				turnState: "streaming",
			};

		case "turn-completed": {
			const hasCompletedResponse =
				state.currentQuestion !== null && state.currentResponse.length > 0;
			const sources = state.sources.length > 0 ? state.sources : undefined;
			const assistantMessage = hasCompletedResponse
				? {
						role: "assistant" as const,
						content: state.currentResponse,
						...(sources ? { sources } : {}),
					}
				: null;

			return {
				...state,
				messages: assistantMessage ? [...state.messages, assistantMessage] : state.messages,
				// El contexto es lo que se envía al API: solo rol y contenido. Las fuentes
				// se quedan en la conversación, que es donde se ven.
				context:
					assistantMessage && state.currentQuestion
						? [
								...state.context,
								{ role: "user", content: state.currentQuestion },
								{ role: "assistant", content: state.currentResponse },
							]
						: state.context,
				currentQuestion: null,
				currentResponse: "",
				turnState: "idle",
				error: null,
			};
		}

		case "turn-failed":
			return { ...state, turnState: "error", error: action.error };

		case "turn-aborted":
			return { ...state, turnState: "aborted" };

		case "state-restored":
			return createInitialChatState(action.state);

		case "conversation-reset":
			return createInitialChatState();
	}
};
