import type { ComponentChildren } from "preact";

type EmptyStateProps = {
	suggestions: string[];
	isBusy: boolean;
	onSuggestion: (suggestion: string) => void;
};

export function EmptyState({
	suggestions,
	isBusy,
	onSuggestion,
}: EmptyStateProps): ComponentChildren {
	return (
		<div class="chatbox__empty">
			<p>¿En qué te gustaría saber más sobre Jorge?</p>
			<nav aria-label="Preguntas sugeridas">
				<ul>
					{suggestions.map((suggestion) => (
						<li key={suggestion}>
							<button type="button" onClick={() => onSuggestion(suggestion)} disabled={isBusy}>
								{suggestion}
							</button>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}
