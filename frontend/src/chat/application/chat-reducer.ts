import { type ConversationState, dropClosedTurn, mergeContext } from "../domain/conversation";
import type { ChatError, ChatMessage, ChatSource, TurnState, VisibleMessage } from "../types";

export type ChatState = ConversationState & {
	/**
	 * La pregunta del turno abierto, o la del último turno cerrado: es lo que repite el
	 * botón de reintentar. Se sobrescribe al empezar el siguiente turno (#145).
	 */
	currentQuestion: string | null;
	currentResponse: string;
	sources: ChatSource[];
	turnState: TurnState;
	error: ChatError | null;
};

export type ChatAction =
	| { type: "turn-started"; question: string }
	| { type: "turn-retried" }
	| { type: "sources-received"; sources: ChatSource[]; history: ChatMessage[] }
	| { type: "token-received"; token: string }
	| { type: "turn-completed" }
	| { type: "turn-failed"; error: ChatError; response?: string }
	| { type: "turn-aborted"; response?: string }
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

const OPEN_TURN_STATES: readonly TurnState[] = ["connecting", "generating", "streaming"];

/** ¿Hay un turno en marcha? Es la misma señal que usa el widget para el aviso de escritura. */
export const isTurnOpen = (turnState: TurnState): boolean => OPEN_TURN_STATES.includes(turnState);

type TurnOutcome = {
	turnState: TurnState;
	error: ChatError | null;
};

/**
 * Cierra un turno con una sola regla (#145): la pregunta entra **siempre** en el contexto y
 * la respuesta entra solo si tiene texto. Así lo que se guarda es lo que se ve, y un turno
 * vacío o interrumpido no rompe el hilo de la conversación.
 *
 * La pregunta no se limpia porque el reintento la necesita: el intento que se repite pasa
 * por `turn-retried`, que deshace lo que este cierre dejó escrito.
 */
const closeTurn = (state: ChatState, answer: string, outcome: TurnOutcome): ChatState => {
	const closed: ChatState = {
		...state,
		currentResponse: "",
		sources: [],
		turnState: outcome.turnState,
		error: outcome.error,
	};

	if (!isTurnOpen(state.turnState) || state.currentQuestion === null) {
		return closed;
	}

	const sources = state.sources.length > 0 ? state.sources : undefined;
	const answered = answer.length > 0;
	const question: ChatMessage = { role: "user", content: state.currentQuestion };
	const messages: VisibleMessage[] = answered
		? [...state.messages, { role: "assistant", content: answer, ...(sources ? { sources } : {}) }]
		: state.messages;
	// El contexto es lo que se envía al API: solo rol y contenido. Las fuentes se quedan en
	// la conversación, que es donde se ven.
	const context: ChatMessage[] = answered
		? [...state.context, question, { role: "assistant", content: answer }]
		: [...state.context, question];

	return { ...closed, messages, context };
};

/**
 * Al reintentar solo se retira la respuesta confirmada: la pregunta visible la puso
 * `turn-started` y se queda en el hilo mientras el nuevo intento avanza.
 */
const withoutCommittedAnswer = (messages: VisibleMessage[]): VisibleMessage[] =>
	messages.at(-1)?.role === "assistant" ? messages.slice(0, -1) : messages;

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

		case "turn-retried":
			return {
				...state,
				messages: withoutCommittedAnswer(state.messages),
				context: dropClosedTurn(state.context, state.currentQuestion),
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

		case "turn-completed":
			return closeTurn(state, state.currentResponse, { turnState: "idle", error: null });

		case "turn-failed":
			return closeTurn(state, action.response ?? state.currentResponse, {
				turnState: "error",
				error: action.error,
			});

		case "turn-aborted":
			return closeTurn(state, action.response ?? state.currentResponse, {
				turnState: "aborted",
				error: null,
			});

		case "state-restored":
			return createInitialChatState(action.state);

		case "conversation-reset":
			return createInitialChatState();
	}
};
