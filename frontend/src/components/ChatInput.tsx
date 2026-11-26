import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { strings } from "../strings.es";
import { Icon } from "./Icon";

type ChatInputProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onAbort: () => void;
	isBusy: boolean;
	maxLength?: number;
	textareaRef?: { current: HTMLTextAreaElement | null };
};

const DEFAULT_MAX_LENGTH = 1000;
const SEND_ICON_PATH = "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z";
const STOP_ICON_PATH = "M6 8c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V8z";

export function ChatInput({
	value,
	onChange,
	onSubmit,
	onAbort,
	isBusy,
	maxLength = DEFAULT_MAX_LENGTH,
	textareaRef: externalTextareaRef,
}: ChatInputProps): ComponentChildren {
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalTextareaRef ?? internalTextareaRef;
	const [isComposing, setIsComposing] = useState(false);

	// Autogrow
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		const { scrollHeight } = textarea;
		if (scrollHeight === 0) {
			textarea.style.overflowY = "hidden";
			return;
		}
		const style = getComputedStyle(textarea);
		const lineHeight = Number.parseFloat(style.lineHeight) || 24;
		const verticalPadding =
			(Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
		const verticalBorder =
			(Number.parseFloat(style.borderTopWidth) || 0) +
			(Number.parseFloat(style.borderBottomWidth) || 0);
		const contentHeight = scrollHeight + verticalBorder;
		const maxHeight = lineHeight * 5 + verticalPadding + verticalBorder;
		textarea.style.height = `${Math.min(contentHeight, maxHeight)}px`;
		textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
	}, [value]);

	// Enviar y detener son un conjunto cerrado: se elige el registro de textos, no el texto (RF-F62).
	const submitCopy = isBusy ? strings.input.stop : strings.input.send;
	const canSubmit = value.trim().length > 0 && value.length <= maxLength;

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === "Escape" && isBusy) {
			event.preventDefault();
			onAbort();
			return;
		}
		if (event.key === "Enter" && !event.shiftKey && !isComposing) {
			event.preventDefault();
			if (!isBusy) onSubmit();
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
			<label for="chatbox-question">{strings.input.label}</label>
			<div class="chatbox__composer">
				<textarea
					id="chatbox-question"
					data-chatbox-control="question-field"
					ref={textareaRef}
					value={value}
					maxLength={maxLength}
					onInput={(e) => onChange(e.currentTarget.value)}
					onKeyDown={handleKeyDown}
					onCompositionStart={() => setIsComposing(true)}
					onCompositionEnd={() => setIsComposing(false)}
					placeholder={strings.input.placeholder}
					rows={1}
				/>
				<button
					type="submit"
					data-chatbox-control="send"
					disabled={!isBusy && !canSubmit}
					aria-label={submitCopy.ariaLabel}
				>
					<Icon path={isBusy ? STOP_ICON_PATH : SEND_ICON_PATH} />
				</button>
			</div>
			{value.length > maxLength * 0.8 && (
				<small aria-live="off">{strings.input.chars(value.length, maxLength)}</small>
			)}
		</form>
	);
}
