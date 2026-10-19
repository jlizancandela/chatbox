import type { ComponentChildren } from "preact";
import { AssistantMarkdown } from "../chat/components/AssistantMarkdown";
import type { ChatMessage } from "../chat/types";
import { strings } from "../strings.es";

type ChatMessagesProps = {
	messages: ChatMessage[];
	currentResponse: string;
	isBusy: boolean;
};

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
		<ol class="chatbox__messages" aria-label={strings.messages.listLabel}>
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
							<span>{strings.messages.writing}</span>
						)
					) : (
						<p>{message.content}</p>
					)}
				</li>
			))}
		</ol>
	);
}
