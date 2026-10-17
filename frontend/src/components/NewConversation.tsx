import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

type NewConversationProps = {
	onReset: () => void;
};

/**
 * "Nueva conversación" button.
 * Always rendered when in the footer.
 * Clicking always shows inline confirmation (Sí, borrar / Cancelar).
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
				<span>¿Borrar la conversación?</span>
				<button type="button" onClick={handleConfirm}>
					Sí, borrar
				</button>
				<button type="button" onClick={handleCancel}>
					Cancelar
				</button>
			</div>
		);
	}

	return (
		<button type="button" onClick={handleClick}>
			Nueva conversación
		</button>
	);
}
