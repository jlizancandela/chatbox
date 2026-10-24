import "./Chatbox.css";
import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../chat/components/ExternalLink";
import { toAnnouncementText } from "../chat/domain/announcement";
import { trimHistory } from "../chat/domain/conversation";
import { REDUCED_MOTION_QUERY, type ScrollIntent, scrollBehavior } from "../chat/domain/motion";
import { isAwayFromEnd } from "../chat/domain/scroll";
import { sourceTitles } from "../chat/domain/sources";
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
const STATUS_ANNOUNCED_CLASS = "chatbox__status--announced";

/**
 * La clase de la región de estado.
 *
 * La región **anuncia siempre**, pero solo **pinta** lo que no está en la conversación: el
 * aviso "escribiendo" (RF-F47) y el desenlace de un turno completado (RF-F46) ya se ven en la
 * burbuja, y pintarlos también arriba lo mostraba dos veces. El error y el aviso de turno
 * detenido no están en ningún otro sitio: esos sí se pintan.
 */
const statusClass = (announcement: { isError: boolean }, inConversation: boolean): string => {
	const classes = [STATUS_CLASS];
	if (announcement.isError) classes.push(STATUS_ERROR_CLASS);
	if (inConversation) classes.push(STATUS_ANNOUNCED_CLASS);
	return classes.join(" ");
};

/** Lo que la región dice cuando no ha pasado nada: nada, y ningún error. */
const NO_ANNOUNCEMENT = { text: "", isError: false, inConversation: false };

/**
 * El comportamiento de scroll del widget, leído en el momento de usarlo (RF-F44).
 *
 * Una sola política para los dos caminos que desplazan la conversación —el seguimiento y el
 * salto al final—, con la diferencia de intención que la regla sabe. La preferencia se lee
 * aquí y no en un estado: se cambia en la configuración del sistema operativo, y el
 * siguiente scroll ya la respeta.
 */
const currentScrollBehavior = (intent: ScrollIntent): ScrollBehavior =>
	scrollBehavior(window.matchMedia(REDUCED_MOTION_QUERY).matches, intent);

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
		case "completed": {
			if (closedWithoutAnswer(event)) {
				return strings.notices.noContext;
			}

			const text = toAnnouncementText(event.text);
			const titles = sourceTitles(event.sources);

			// Lo que se ve en la burbuja también se oye: la línea de fuentes forma parte
			// del turno que se anuncia.
			return titles.length > 0 ? `${text}\n${strings.messages.sources(titles)}` : text;
		}
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
	const messagesListRef = useRef<HTMLOListElement | null>(null);
	/**
	 * Si la persona sigue el hilo. Fuera de un salto animado, la distancia al final decide:
	 * a más de 16 px se ha apartado; durante el salto las posiciones intermedias son del
	 * widget y no cuentan como interacción (RF-F48).
	 */
	const following = useRef(true);
	/** Un salto animado es del widget: sus posiciones intermedias no son un apartarse. */
	const jumping = useRef(false);
	const sentContextLength = useRef(0);

	const { sendQuestion, abort } = useChatStream({
		apiUrl,
		chat,
		onSources: (historyLength) => setContextWasTrimmed(historyLength < sentContextLength.current),
		onTurnEnd: (event) => {
			if (closedWithoutAnswer(event)) {
				setLocalNotice(strings.notices.noContext);
			}
			setAnnouncement({
				text: announcementFor(event),
				isError: event.kind === "failed",
				// El desenlace de un turno completado ya esta en la conversacion: la region lo
				// anuncia, pero no lo pinta dos veces.
				inConversation: event.kind === "completed",
			});
		},
	});

	const isBusy = ["connecting", "generating", "streaming"].includes(chat.state.turnState);
	// ¿Lo que la región dice ya está en la conversación? El desenlace de un turno
	// completado se ve en la burbuja (RF-F46) y el aviso de escritura se ve en el
	// bocadillo (RF-F47). Cuando es así, la región lo anuncia igual, pero no lo pinta
	// dos veces. El aviso solo cuenta cuando es lo que la región está diciendo: si
	// quedara un desenlace anterior, ese es el texto que se ve, y no el aviso.
	const statusIsInConversation = announcement.inConversation || (isBusy && !announcement.text);
	const showMessages = chat.state.messages.length > 0;

	useFocusOnMount(textareaRef);

	// Keep each effect responsible for one external concern.
	useEffect(() => {
		if (!isBusy) saveToSessionStorage(chat.state.messages, chat.state.context);
	}, [chat.state.messages, chat.state.context, isBusy]);

	useEffect(() => {
		const element = conversationRef.current;
		if (!element || !following.current) return;
		element.scrollTo({
			top: element.scrollHeight,
			behavior: currentScrollBehavior("seguimiento"),
		});
	}, [chat.state.messages, chat.state.currentResponse, localNotice]);

	const handleConversationScroll = (): void => {
		const element = conversationRef.current;
		if (!element) return;
		const distanceFromEnd = element.scrollHeight - element.scrollTop - element.clientHeight;
		// Un salto animado es del widget: sus posiciones intermedias no dicen nada de la
		// persona y no deben mostrar el botón. Al terminar, la distancia vuelve a cero.
		if (jumping.current) {
			if (!isAwayFromEnd(distanceFromEnd)) jumping.current = false;
			setShowScrollToEnd(false);
			return;
		}
		// Fuera de un salto del widget, la distancia es la señal estable: estar a más de
		// 16 px del final significa que la persona se apartó, sin depender de un scrollTop
		// anterior que puede quedar obsoleto mientras crece el stream.
		following.current = !isAwayFromEnd(distanceFromEnd);
		setShowScrollToEnd(!following.current);
	};

	// El contenido crece con cada token y crecer no dispara ningún evento `scroll`:
	// sin esta comprobación, quien se aleja durante la respuesta se queda sin el
	// botón «Ir al final» aunque la conversación ya sea larguísima.
	useEffect(() => {
		handleConversationScroll();
	}, [chat.state.messages, chat.state.currentResponse, localNotice]);

	// El contenido crece después del último cambio de estado: el markdown del asistente se
	// carga diferido (RF-F30) y la burbuja crece cuando llega. El desplazamiento sigue al
	// tamaño del hilo, no al estado: si no, quien seguía la respuesta se queda a mitad.
	useEffect(() => {
		const list = messagesListRef.current;
		if (!list || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			const element = conversationRef.current;
			if (!element) return;
			if (following.current) {
				element.scrollTo({
					top: element.scrollHeight,
					behavior: currentScrollBehavior("seguimiento"),
				});
				return;
			}
			handleConversationScroll();
		});
		observer.observe(list);
		return () => observer.disconnect();
	}, [showMessages]);

	const scrollToEnd = (behavior: ScrollBehavior): void => {
		jumping.current = behavior !== "auto";
		following.current = true;
		const element = conversationRef.current;
		if (element) element.scrollTo({ top: element.scrollHeight, behavior });
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

	return (
		<section class="chatbox" lang="es" aria-labelledby="chatbox-title">
			<ChatHeader title={title} notice={strings.header.scopeNotice} />

			<div
				class={statusClass(announcement, statusIsInConversation)}
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
						listRef={messagesListRef}
					/>
				) : (
					<EmptyState suggestions={suggestions} isBusy={isBusy} onSuggestion={submit} />
				)}

				{showScrollToEnd && (
					<button
						type="button"
						data-chatbox-control="scroll-to-end"
						onClick={() => scrollToEnd(currentScrollBehavior("salto"))}
					>
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
