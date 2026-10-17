import "./Chatbox.css";
import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../chat/components/ExternalLink";
import { trimHistory } from "../chat/domain/conversation";
import { useChat } from "../chat/hooks/useChat";
import { useChatStream } from "../chat/hooks/useChatStream";
import { useFocusOnMount } from "../chat/hooks/useFocusOnMount";
import { loadFromSessionStorage, saveToSessionStorage } from "../chat/infrastructure/storage";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";
import { EmptyState } from "./EmptyState";
import { NewConversation } from "./NewConversation";

export type ChatboxProps = {
	apiUrl: string;
	suggestions?: string[];
	contactUrl?: string;
	title?: string;
};

const DEFAULT_TITLE = "Asistente de Jorge";
const DEFAULT_SUGGESTIONS = [
	"¿Qué experiencia tiene Jorge?",
	"¿Qué stack tecnológico usa Jorge?",
	"¿Cómo puedo contactar con Jorge?",
];
const MAX_QUESTION_LENGTH = 1000;
const SCOPE_NOTICE = "Responde solo con información del CV y GitHub de Jorge. Puede equivocarse.";
const NO_CONTEXT_NOTICE =
	"Eso no lo tengo en la información que manejo. Puedes escribirle a Jorge directamente.";

type TurnState = "idle" | "connecting" | "generating" | "streaming" | "error" | "aborted";

export function Chatbox({
	apiUrl,
	suggestions = DEFAULT_SUGGESTIONS,
	contactUrl,
	title = DEFAULT_TITLE,
}: ChatboxProps) {
	const chat = useChat(loadFromSessionStorage() ?? undefined);
	const [question, setQuestion] = useState("");
	const [localNotice, setLocalNotice] = useState("");
	const [announcement, setAnnouncement] = useState("");
	const [showScrollToEnd, setShowScrollToEnd] = useState(false);
	const [contextWasTrimmed, setContextWasTrimmed] = useState(false);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const conversationRef = useRef<HTMLElement>(null);
	const wasNearEnd = useRef(true);
	const sentContextLength = useRef(0);
	const previousTurnState = useRef<TurnState>("idle");
	const announcedMessages = useRef(0);

	const { sendQuestion, abort, isStreaming } = useChatStream({
		apiUrl,
		chat,
		onSources: (historyLength) => setContextWasTrimmed(historyLength < sentContextLength.current),
	});

	const isBusy =
		isStreaming ||
		chat.state.turnState === "connecting" ||
		chat.state.turnState === "generating" ||
		chat.state.turnState === "streaming";

	useFocusOnMount(textareaRef);

	// Announcements, notices, persistence + auto-scroll
	useEffect(() => {
		// Side effects
		if (!isBusy && previousTurnState.current !== "idle") {
			if (
				chat.state.turnState === "idle" &&
				chat.state.messages.length === announcedMessages.current
			) {
				setLocalNotice(NO_CONTEXT_NOTICE);
			}
			if (chat.state.error) setAnnouncement(chat.state.error.message);
		}
		if (chat.state.messages.length > announcedMessages.current) {
			const last = chat.state.messages[chat.state.messages.length - 1];
			if (last?.role === "assistant") setAnnouncement(last.content);
			announcedMessages.current = chat.state.messages.length;
		}
		previousTurnState.current = chat.state.turnState as TurnState;
		if (!isBusy) {
			saveToSessionStorage(chat.state.messages, chat.state.context);
		}

		// Auto-scroll
		const element = conversationRef.current;
		if (!element || !wasNearEnd.current) return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		element.scrollTo({
			top: element.scrollHeight,
			behavior: reduceMotion ? "auto" : "smooth",
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [chat.state.messages, chat.state.context, isBusy, localNotice]);

	const handleConversationScroll = (): void => {
		const element = conversationRef.current;
		if (!element) return;
		const distanceFromEnd = element.scrollHeight - element.scrollTop - element.clientHeight;
		wasNearEnd.current = distanceFromEnd < 80;
		setShowScrollToEnd(!wasNearEnd.current);
	};

	const scrollToEnd = (behavior: ScrollBehavior = "smooth"): void => {
		wasNearEnd.current = true;
		conversationRef.current?.scrollTo({
			top: conversationRef.current.scrollHeight,
			behavior,
		});
		setShowScrollToEnd(false);
	};

	const submit = (value: string): void => {
		const trimmed = value.trim();
		if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH || isBusy) return;
		setQuestion("");
		setContextWasTrimmed(false);
		sentContextLength.current = trimHistory(chat.state.context).length;
		setLocalNotice("");
		setAnnouncement("");
		void sendQuestion(trimmed);
		textareaRef.current?.focus();
	};

	const handleReset = (): void => {
		abort();
		chat.reset();
		saveToSessionStorage([], []);
		setLocalNotice("");
		setContextWasTrimmed(false);
		setAnnouncement("");
	};

	const showMessages = chat.state.messages.length > 0;

	return (
		<section class="chatbox" lang="es" aria-labelledby="chatbox-title">
			<ChatHeader title={title} notice={SCOPE_NOTICE} />

			<div class="chatbox__status" role="status" aria-live="polite" aria-atomic="true">
				{announcement ||
					(isBusy ? "El asistente está escribiendo" : (chat.state.error?.message ?? ""))}
			</div>

			<main
				class="chatbox__conversation"
				aria-label="Conversación"
				ref={conversationRef}
				onScroll={handleConversationScroll}
			>
				{contextWasTrimmed && (
					<p class="chatbox__notice">Los mensajes más antiguos ya no forman parte del contexto.</p>
				)}
				{localNotice && (
					<p class="chatbox__notice">
						{localNotice}{" "}
						{contactUrl && <ExternalLink href={contactUrl}>Contactar con Jorge</ExternalLink>}
					</p>
				)}
				{showScrollToEnd && (
					<button type="button" onClick={() => scrollToEnd()}>
						Ir al final
					</button>
				)}

				{showMessages ? (
					<ChatMessages
						messages={chat.state.messages}
						currentResponse={chat.state.currentResponse}
						isBusy={
							isBusy || chat.state.turnState === "error" || chat.state.turnState === "aborted"
						}
					/>
				) : (
					<EmptyState suggestions={suggestions} isBusy={isBusy} onSuggestion={submit} />
				)}
			</main>

			<footer class="chatbox__footer">
				<ChatInput
					value={question}
					onChange={setQuestion}
					onSubmit={() => submit(question)}
					onAbort={abort}
					isBusy={isBusy}
					contactUrl={contactUrl}
					maxLength={MAX_QUESTION_LENGTH}
				/>

				<NewConversation onReset={handleReset} />
			</footer>
		</section>
	);
}
