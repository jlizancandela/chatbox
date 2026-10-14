import { useReducer } from "preact/hooks";
import {
	type ChatError,
	type ChatState,
	chatReducer,
	createInitialChatState,
} from "../application/chat-reducer";
import type { ConversationState } from "../domain/conversation";
import type { ChatMessage, ChatSource } from "../types";

export type ChatController = {
	state: ChatState;
	startTurn: (question: string) => void;
	receiveSources: (sources: ChatSource[], history: ChatMessage[]) => void;
	receiveToken: (token: string) => void;
	completeTurn: () => void;
	failTurn: (error: ChatError) => void;
	abortTurn: () => void;
	restore: (state: ConversationState) => void;
	reset: () => void;
};

export const useChat = (initial: Partial<ConversationState> = {}): ChatController => {
	const [state, dispatch] = useReducer(chatReducer, createInitialChatState(initial));

	return {
		state,
		startTurn: (question) => dispatch({ type: "turn-started", question }),
		receiveSources: (sources, history) => dispatch({ type: "sources-received", sources, history }),
		receiveToken: (token) => dispatch({ type: "token-received", token }),
		completeTurn: () => dispatch({ type: "turn-completed" }),
		failTurn: (error) => dispatch({ type: "turn-failed", error }),
		abortTurn: () => dispatch({ type: "turn-aborted" }),
		restore: (conversation) => dispatch({ type: "state-restored", state: conversation }),
		reset: () => dispatch({ type: "conversation-reset" }),
	};
};
