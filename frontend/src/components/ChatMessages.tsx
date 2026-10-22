import type { ComponentChildren, Ref } from "preact";
import { AssistantMarkdown } from "../chat/components/AssistantMarkdown";
import type { ChatMessage } from "../chat/types";
import { strings } from "../strings.es";

type ChatMessagesProps = {
	messages: ChatMessage[];
	currentResponse: string;
	isBusy: boolean;
	/**
	 * El `<ol>` de los mensajes, para que quien controla el desplazamiento pueda observar
	 * su tamaño: el contenido crece después del último cambio de estado (el markdown del
	 * asistente se carga diferido).
	 */
	listRef?: Ref<HTMLOListElement>;
};

export function ChatMessages({
	messages,
	currentResponse,
	isBusy,
	listRef,
}: ChatMessagesProps): ComponentChildren {
	const visibleMessages = [...messages];
	if (isBusy) {
		visibleMessages.push({ role: "assistant", content: currentResponse });
	}

	if (visibleMessages.length === 0) return null;

	return (
		<ol class="chatbox__messages" aria-label={strings.messages.listLabel} ref={listRef}>
			{visibleMessages.map((message, index) => (
				<li
					class={`chatbox__message chatbox__message--${message.role}`}
					key={`${message.role}-${index}`}
				>
					<span class="chatbox__message-author">{strings.messages.author[message.role]}</span>
					{message.role === "assistant" ? (
						message.content ? (
							<AssistantMarkdown content={message.content} />
						) : (
							/*
							 * El indicador de escritura (RF-F44): tres puntos decorativos. El
							 * aviso "El asistente está escribiendo" vive en la región de estado,
							 * que lo muestra y lo anuncia; aquí solo está el ancla visual de
							 * dónde va a aparecer la respuesta.
							 */
							<span class="chatbox__typing" aria-hidden="true">
								<span class="chatbox__typing-dot" />
								<span class="chatbox__typing-dot" />
								<span class="chatbox__typing-dot" />
							</span>
						)
					) : (
						<p>{message.content}</p>
					)}
				</li>
			))}
		</ol>
	);
}
