import type { ComponentChildren, Ref } from "preact";
import { AssistantMarkdown } from "../chat/components/AssistantMarkdown";
import { TypingIndicator } from "../chat/components/TypingIndicator";
import { sourceTitles } from "../chat/domain/sources";
import type { ChatMessage, ChatSource, VisibleMessage } from "../chat/types";
import { strings } from "../strings.es";

type ChatMessagesProps = {
	messages: VisibleMessage[];
	currentResponse: string;
	isBusy: boolean;
	/**
	 * El `<ol>` de los mensajes, para que quien controla el desplazamiento pueda observar
	 * su tamaño: el contenido crece después del último cambio de estado (el markdown del
	 * asistente se carga diferido).
	 */
	listRef?: Ref<HTMLOListElement>;
};

/**
 * Los documentos de los que viene la respuesta (issue #110). Sin fuentes no hay línea:
 * la atribución solo existe cuando hay algo que atribuir.
 */
function SourceTitles({ sources }: { sources?: ChatSource[] }) {
	const titles = sourceTitles(sources ?? []);

	if (titles.length === 0) return null;

	return <p class="chatbox__sources">{strings.messages.sources(titles)}</p>;
}

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
			{visibleMessages.map((message, index) => {
				// ¿Es esta la burbuja en curso? La última, del asistente, y solo mientras
				// el turno está en marcha. El aviso de escritura vive en ella; que
				// todavía no tenga texto lo decide la rama del render.
				const isPending =
					isBusy && index === visibleMessages.length - 1 && message.role === "assistant";
				return (
					<li
						class={`chatbox__message chatbox__message--${message.role}`}
						key={`${message.role}-${index}`}
					>
						<span class="chatbox__message-author">{strings.messages.author[message.role]}</span>
						{message.role === "assistant" ? (
							message.content ? (
								<>
									<AssistantMarkdown content={message.content} />
									<SourceTitles sources={message.sources} />
								</>
							) : (
								<>
									{isPending && (
										/*
										 * El aviso de escritura (RF-F47): se ve dentro del bocadillo, en
										 * el sitio donde aparecerá la respuesta. Es decorativo, como
										 * los puntos: la región de estado es la que lo anuncia
										 * (RF-F41), así que no se duplica texto visible y audible.
										 */
										<span class="chatbox__writing" aria-hidden="true">
											{strings.messages.writing}
										</span>
									)}
									{/*
									 * El indicador de escritura (RF-F44): tres puntos decorativos. El
									 * aviso "El asistente está escribiendo" lo anuncia la región de
									 * estado, que ya no lo pinta: aquí solo queda el ancla visual
									 * de dónde va a aparecer la respuesta.
									 */}
									<TypingIndicator />
								</>
							)
						) : (
							<p>{message.content}</p>
						)}
					</li>
				);
			})}
		</ol>
	);
}
