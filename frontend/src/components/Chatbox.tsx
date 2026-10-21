import "./Chatbox.css";
import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../chat/components/ExternalLink";
import { toAnnouncementText } from "../chat/domain/announcement";
import { trimHistory } from "../chat/domain/conversation";
import { useChat } from "../chat/hooks/useChat";
import { type TurnEnd, useChatStream } from "../chat/hooks/useChatStream";
import { useFocusOnMount } from "../chat/hooks/useFocusOnMount";
import { loadFromSessionStorage, saveToSessionStorage } from "../chat/infrastructure/storage";
import { strings } from "../strings.es";
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

// El módulo de textos es `as const`: la copia de las sugerencias por defecto se copia a
// un array mutable una vez, al cargar el módulo, para no recrearla en cada render.
const DEFAULT_SUGGESTIONS: string[] = [...strings.emptyState.suggestions];
const MAX_QUESTION_LENGTH = 1000;

/**
 * Clase de la región de estado y su variante de error (RF-F42). La variante solo cambia el
 * color: el texto que la región anuncia no se toca.
 */
const STATUS_CLASS = "chatbox__status";
const STATUS_ERROR_CLASS = "chatbox__status--error";

/** Lo que la región dice cuando no ha pasado nada: nada, y ningún error. */
const NO_ANNOUNCEMENT = { text: "", isError: false };

/**
 * Un turno cerrado sin respuesta es un desenlace, no un silencio: se anuncia **y** se pinta en
 * la conversación. La regla vive aquí para que región y aviso no se separen en el futuro.
 */
const closedWithoutAnswer = (event: TurnEnd): boolean =>
	event.kind === "completed" && event.text.length === 0;

/**
 * Traduce el fin de turno al texto de la región de estado (RF-F41). La región no se deduce
 * del estado: recibir un evento es lo único que puede anunciarse, así que restaurar una
 * conversación —o cualquier otro camino que no pase por el runner— no dice nada.
 */
const announcementFor = (event: TurnEnd): string => {
	switch (event.kind) {
		case "completed":
			return closedWithoutAnswer(event)
				? strings.notices.noContext
				: toAnnouncementText(event.text);
		case "failed":
			return event.error.message;
		case "aborted":
			return strings.messages.stopped;
	}
};

export function Chatbox({
	apiUrl,
	suggestions = DEFAULT_SUGGESTIONS,
	contactUrl,
	title = strings.header.defaultTitle,
}: ChatboxProps) {
	const chat = useChat(loadFromSessionStorage() ?? undefined);
	const [question, setQuestion] = useState("");
	const [localNotice, setLocalNotice] = useState("");
	const [announcement, setAnnouncement] = useState(NO_ANNOUNCEMENT);
	const [showScrollToEnd, setShowScrollToEnd] = useState(false);
	const [contextWasTrimmed, setContextWasTrimmed] = useState(false);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const conversationRef = useRef<HTMLElement>(null);
	const wasNearEnd = useRef(true);
	const sentContextLength = useRef(0);

	const { sendQuestion, abort } = useChatStream({
		apiUrl,
		chat,
		onSources: (historyLength) => setContextWasTrimmed(historyLength < sentContextLength.current),
		onTurnEnd: (event) => {
			if (closedWithoutAnswer(event)) {
				setLocalNotice(strings.notices.noContext);
			}
			setAnnouncement({ text: announcementFor(event), isError: event.kind === "failed" });
		},
	});

	const isBusy = ["connecting", "generating", "streaming"].includes(chat.state.turnState);

	useFocusOnMount(textareaRef);

	// Keep each effect responsible for one external concern.
	useEffect(() => {
		if (!isBusy) saveToSessionStorage(chat.state.messages, chat.state.context);
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

	const handleConversationScroll = (): void => {
		const element = conversationRef.current;
		if (!element) return;
		const distanceFromEnd = element.scrollHeight - element.scrollTop - element.clientHeight;
		// El umbral tiene que caber en el contenedor: si la conversación es más baja
		// que él, ninguna posición estaba lejos del final y el botón no podía
		// aparecer nunca (widget corto, viewport pequeño o teclado abierto en móvil).
		const threshold = Math.min(80, Math.max(16, element.clientHeight / 2));
		wasNearEnd.current = distanceFromEnd < threshold;
		setShowScrollToEnd(!wasNearEnd.current);
	};

	// El contenido crece con cada token y crecer no dispara ningún evento `scroll`:
	// sin esta comprobación, quien se aleja durante la respuesta se queda sin el
	// botón «Ir al final» aunque la conversación ya sea larguísima.
	useEffect(() => {
		handleConversationScroll();
	}, [chat.state.messages, chat.state.currentResponse, localNotice]);

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
		setAnnouncement(NO_ANNOUNCEMENT);
		void sendQuestion(trimmed);
		textareaRef.current?.focus();
	};

	const handleReset = (): void => {
		abort();
		chat.reset();
		saveToSessionStorage([], []);
		setLocalNotice("");
		setContextWasTrimmed(false);
		setAnnouncement(NO_ANNOUNCEMENT);
		textareaRef.current?.focus();
	};

	const showMessages = chat.state.messages.length > 0;

	return (
		<section class="chatbox" lang="es" aria-labelledby="chatbox-title">
			<ChatHeader title={title} notice={strings.header.scopeNotice} />

			<div
				class={announcement.isError ? `${STATUS_CLASS} ${STATUS_ERROR_CLASS}` : STATUS_CLASS}
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				{announcement.text || (isBusy ? strings.messages.writing : "")}
			</div>

			<main
				class="chatbox__conversation"
				aria-label={strings.a11y.conversationLabel}
				ref={conversationRef}
				onScroll={handleConversationScroll}
			>
				{contextWasTrimmed && <p class="chatbox__notice">{strings.notices.contextTrimmed}</p>}
				{localNotice && (
					<p class="chatbox__notice">
						{localNotice}{" "}
						{contactUrl && (
							<ExternalLink href={contactUrl}>{strings.input.contactLink}</ExternalLink>
						)}
					</p>
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

				{showScrollToEnd && (
					<button type="button" onClick={() => scrollToEnd()}>
						{strings.actions.scrollToEnd}
					</button>
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
					textareaRef={textareaRef}
				/>

				<NewConversation onReset={handleReset} />
			</footer>
		</section>
	);
}
