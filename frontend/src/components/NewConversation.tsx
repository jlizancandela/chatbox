import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { strings } from "../strings.es";

type NewConversationProps = {
	onReset: () => void;
};

/**
 * Button that resets the conversation.
 * Always rendered when in the footer.
 * Clicking always shows inline confirmation (accept / cancel, see strings.actions.confirm).
 */
export function NewConversation({ onReset }: NewConversationProps): ComponentChildren {
	const [confirming, setConfirming] = useState(false);

	const handleClick = (): void => {
		setConfirming(true);
	};

	const handleConfirm = (): void => {
		onReset();
		setConfirming(false);
	};

	const handleCancel = (): void => {
		setConfirming(false);
	};

	if (confirming) {
		return (
			<div class="chatbox__conversation-actions">
				<span>{strings.actions.confirm.question}</span>
				<button type="button" onClick={handleConfirm}>
					{strings.actions.confirm.accept}
				</button>
				<button type="button" onClick={handleCancel}>
					{strings.actions.confirm.cancel}
				</button>
			</div>
		);
	}

	return (
		<button type="button" onClick={handleClick}>
			{strings.actions.newConversation}
		</button>
	);
}
