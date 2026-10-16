import { useEffect, useRef, useState } from "preact/hooks";
import { AssistantMarkdown } from "../chat/components/AssistantMarkdown";
import { SafeLink } from "../chat/components/SafeLink";
import { trimHistory } from "../chat/domain/conversation";
import { useChat } from "../chat/hooks/useChat";
import { useChatStream } from "../chat/hooks/useChatStream";
import { loadFromSessionStorage, saveToSessionStorage } from "../chat/infrastructure/storage";
import type { ChatMessage } from "../chat/types";

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

const messageLabel = (message: ChatMessage): string =>
	message.role === "user" ? "Tú" : "Asistente";

export function Chatbox({
	apiUrl,
	suggestions = DEFAULT_SUGGESTIONS,
	contactUrl,
	title = DEFAULT_TITLE,
}: ChatboxProps) {
	const chat = useChat(loadFromSessionStorage() ?? undefined);
	const [question, setQuestion] = useState("");
	const [confirmReset, setConfirmReset] = useState(false);
	const [showScrollToEnd, setShowScrollToEnd] = useState(false);
	const [localNotice, setLocalNotice] = useState("");
	const [announcement, setAnnouncement] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const conversationRef = useRef<HTMLElement>(null);
	const previousTurnState = useRef(chat.state.turnState);
	const announcedMessages = useRef(0);
	const wasNearEnd = useRef(true);
	const sentContextLength = useRef(0);
	const [contextWasTrimmed, setContextWasTrimmed] = useState(false);
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

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	useEffect(() => {
		if (!isBusy && previousTurnState.current !== "idle") {
			if (
				chat.state.turnState === "idle" &&
				chat.state.messages.length === announcedMessages.current
			) {
				setLocalNotice(
					"Eso no lo tengo en la información que manejo. Puedes escribirle a Jorge directamente."
				);
			}
			if (chat.state.error) setAnnouncement(chat.state.error.message);
		}
		if (chat.state.messages.length > announcedMessages.current) {
			const last = chat.state.messages[chat.state.messages.length - 1];
			if (last?.role === "assistant") setAnnouncement(last.content);
			announcedMessages.current = chat.state.messages.length;
		}
		previousTurnState.current = chat.state.turnState;
		if (!isBusy) {
			saveToSessionStorage(chat.state.messages, chat.state.context);
		}
	}, [chat.state.messages, chat.state.context, isBusy]);

	useEffect(() => {
		const element = conversationRef.current;
		if (!element || !wasNearEnd.current) return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		element.scrollTo({
			top: element.scrollHeight,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}, [chat.state.messages, chat.state.currentResponse, localNotice]);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
		textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 5)}px`;
		textarea.style.overflowY = textarea.scrollHeight > lineHeight * 5 ? "auto" : "hidden";
	}, [question]);

	const canSubmit = question.trim().length > 0 && question.length <= MAX_QUESTION_LENGTH;
	const visibleMessages = [...chat.state.messages];
	if (isBusy || chat.state.turnState === "error" || chat.state.turnState === "aborted") {
		visibleMessages.push({ role: "assistant", content: chat.state.currentResponse });
	}

	const scrollToEnd = (behavior: ScrollBehavior = "smooth"): void => {
		wasNearEnd.current = true;
		conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior });
		setShowScrollToEnd(false);
	};

	const handleConversationScroll = (): void => {
		const element = conversationRef.current;
		if (!element) return;
		const distanceFromEnd = element.scrollHeight - element.scrollTop - element.clientHeight;
		wasNearEnd.current = distanceFromEnd < 80;
		setShowScrollToEnd(!wasNearEnd.current);
	};

	const submit = (value = question): void => {
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

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && isBusy) {
			event.preventDefault();
			abort();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			submit();
		}
	};

	const handleSubmit = (event: SubmitEvent): void => {
		event.preventDefault();
		if (isBusy) {
			abort();
			return;
		}
		submit();
	};

	return (
		<section class="chatbox" lang="es" aria-labelledby="chatbox-title">
			<header class="chatbox__header">
				<div>
					<h1 id="chatbox-title">{title}</h1>
					<span class="chatbox__badge">IA</span>
				</div>
				<p>Responde solo con información del CV y GitHub de Jorge. Puede equivocarse.</p>
			</header>

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
						{localNotice} {contactUrl && <SafeLink href={contactUrl}>Contactar con Jorge</SafeLink>}
					</p>
				)}
				{showScrollToEnd && (
					<button type="button" onClick={() => scrollToEnd()}>
						Ir al final
					</button>
				)}
				{visibleMessages.length === 0 ? (
					<div class="chatbox__empty">
						<p>¿En qué te gustaría saber más sobre Jorge?</p>
						<nav aria-label="Preguntas sugeridas">
							<ul>
								{suggestions.map((suggestion) => (
									<li key={suggestion}>
										<button type="button" onClick={() => submit(suggestion)} disabled={isBusy}>
											{suggestion}
										</button>
									</li>
								))}
							</ul>
						</nav>
					</div>
				) : (
					<ol class="chatbox__messages" aria-label="Mensajes">
						{visibleMessages.map((message, index) => (
							<li
								class={`chatbox__message chatbox__message--${message.role}`}
								key={`${message.role}-${index}`}
							>
								<span class="chatbox__message-author">{messageLabel(message)}</span>
								{message.role === "assistant" ? (
									message.content ? (
										<AssistantMarkdown content={message.content} />
									) : (
										<span>El asistente está escribiendo</span>
									)
								) : (
									<p>{message.content}</p>
								)}
							</li>
						))}
					</ol>
				)}
			</main>

			<footer class="chatbox__footer">
				<form onSubmit={handleSubmit}>
					<label for="chatbox-question">Escribe tu pregunta</label>
					<textarea
						id="chatbox-question"
						ref={textareaRef}
						value={question}
						maxLength={MAX_QUESTION_LENGTH}
						onInput={(event) => setQuestion(event.currentTarget.value)}
						onKeyDown={handleKeyDown}
						placeholder="Pregunta sobre la experiencia de Jorge"
						rows={1}
					/>
					<button
						type="submit"
						disabled={!isBusy && !canSubmit}
						aria-label={isBusy ? "Detener respuesta" : "Enviar pregunta"}
					>
						{isBusy ? "Detener" : "Enviar"}
					</button>
				</form>
				{question.length > MAX_QUESTION_LENGTH * 0.8 && (
					<small aria-live="polite">
						{question.length}/{MAX_QUESTION_LENGTH}
					</small>
				)}
				{contactUrl && <SafeLink href={contactUrl}>Contactar con Jorge</SafeLink>}
				<div class="chatbox__conversation-actions">
					{confirmReset ? (
						<>
							<span>¿Borrar la conversación?</span>
							<button
								type="button"
								onClick={() => {
									abort();
									chat.reset();
									saveToSessionStorage([], []);
									setLocalNotice("");
									setContextWasTrimmed(false);
									setAnnouncement("");
									setConfirmReset(false);
								}}
							>
								Sí, borrar
							</button>
							<button type="button" onClick={() => setConfirmReset(false)}>
								Cancelar
							</button>
						</>
					) : (
						<button type="button" onClick={() => setConfirmReset(true)}>
							Nueva conversación
						</button>
					)}
				</div>
			</footer>
		</section>
	);
}
