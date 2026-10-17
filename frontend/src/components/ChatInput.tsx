import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ExternalLink } from "../chat/components/ExternalLink";

type ChatInputProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onAbort: () => void;
	isBusy: boolean;
	contactUrl?: string;
	maxLength?: number;
};

const DEFAULT_MAX_LENGTH = 1000;

export function ChatInput({
	value,
	onChange,
	onSubmit,
	onAbort,
	isBusy,
	contactUrl,
	maxLength = DEFAULT_MAX_LENGTH,
}: ChatInputProps): ComponentChildren {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [isComposing, setIsComposing] = useState(false);

	// Autogrow
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
		textarea.style.height = `${Math.min(textarea.scrollHeight, lineHeight * 5)}px`;
		textarea.style.overflowY = textarea.scrollHeight > lineHeight * 5 ? "auto" : "hidden";
	}, [value]);

	const canSubmit = value.trim().length > 0 && value.length <= maxLength;

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && isBusy) {
			event.preventDefault();
			onAbort();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey && !isComposing) {
			event.preventDefault();
			if (isBusy) {
				onAbort();
			} else {
				onSubmit();
			}
		}
	};

	const handleSubmit = (event: SubmitEvent): void => {
		event.preventDefault();
		if (isBusy) {
			onAbort();
			return;
		}
		onSubmit();
	};

	return (
		<form onSubmit={handleSubmit}>
			<label for="chatbox-question">Escribe tu pregunta</label>
			<textarea
				id="chatbox-question"
				ref={textareaRef}
				value={value}
				maxLength={maxLength}
				onInput={(e) => onChange(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				onCompositionStart={() => setIsComposing(true)}
				onCompositionEnd={() => setIsComposing(false)}
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
			{value.length > maxLength * 0.8 && (
				<small aria-live="polite">
					{value.length}/{maxLength}
				</small>
			)}
			{contactUrl && <ExternalLink href={contactUrl}>Contactar con Jorge</ExternalLink>}
		</form>
	);
}
