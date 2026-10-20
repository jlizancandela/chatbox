import type { ComponentChildren } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
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
	const returnFocusToTrigger = useRef(false);

	// Los botones se desmontan al cambiar de modo. El foco se mueve al montar el botón
	// destino, no en un efecto: un efecto pendiente podría robar el foco tras un clic rápido.
	const focusOnMount = useCallback((element: HTMLButtonElement | null) => {
		element?.focus();
	}, []);
	const focusTriggerAfterCancel = useCallback((element: HTMLButtonElement | null) => {
		if (element && returnFocusToTrigger.current) {
			returnFocusToTrigger.current = false;
			element.focus();
		}
	}, []);

	const handleClick = (): void => {
		setConfirming(true);
	};

	const handleConfirm = (): void => {
		onReset();
		setConfirming(false);
	};

	const handleCancel = (): void => {
		returnFocusToTrigger.current = true;
		setConfirming(false);
	};

	if (confirming) {
		return (
			<div class="chatbox__conversation-actions">
				<span>{strings.actions.confirm.question}</span>
				<button type="button" onClick={handleConfirm}>
					{strings.actions.confirm.accept}
				</button>
				<button type="button" ref={focusOnMount} onClick={handleCancel}>
					{strings.actions.confirm.cancel}
				</button>
			</div>
		);
	}

	return (
		<button type="button" ref={focusTriggerAfterCancel} onClick={handleClick}>
			{strings.actions.newConversation}
		</button>
	);
}
