import type { ComponentChildren } from "preact";
import { AssistantMarkdown } from "../chat/components/AssistantMarkdown";
import type { ChatMessage } from "../chat/types";

type ChatMessagesProps = {
	messages: ChatMessage[];
	currentResponse: string;
	isBusy: boolean;
};

const messageLabel = (message: ChatMessage): string =>
	message.role === "user" ? "Tú" : "Asistente";

export function ChatMessages({
	messages,
	currentResponse,
	isBusy,
}: ChatMessagesProps): ComponentChildren {
	const visibleMessages = [...messages];
	if (isBusy) {
		visibleMessages.push({ role: "assistant", content: currentResponse });
	}

	if (visibleMessages.length === 0) return null;

	return (
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
	);
}
