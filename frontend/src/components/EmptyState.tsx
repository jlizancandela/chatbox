import type { ComponentChildren } from "preact";
import { strings } from "../strings.es";

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
			<p>{strings.emptyState.prompt}</p>
			<nav aria-label={strings.a11y.emptyStateNavLabel}>
				<ul>
					{suggestions.map((suggestion) => (
						<li key={suggestion}>
							<button
								type="button"
								data-chatbox-control="suggestion"
								onClick={() => onSuggestion(suggestion)}
								disabled={isBusy}
							>
								{suggestion}
							</button>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}
