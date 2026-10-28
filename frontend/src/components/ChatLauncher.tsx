import { strings } from "../strings.es";

type ChatLauncherProps = {
	/** Abre el widget: el lanzador solo existe en el estado contraído (RF-F64). */
	onOpen: () => void;
	/**
	 * El foco vuelve al lanzador cuando se monta.
	 *
	 * El lanzador se desmonta al expandirse el panel, así que sin devolverle el foco, este
	 * se perdería en el `body`. El foco se mueve con una referencia, no con un efecto: un
	 * efecto pendiente podría robarlo tras un clic rápido (RF-F64, D17).
	 */
	launcherRef: (element: HTMLButtonElement | null) => void;
};

/**
 * El lanzador: el control circular que abre el widget (RF-F64).
 *
 * El ícono es un SVG en línea y no una tipografía de iconos: el widget no puede meter una
 * webfont en una página que no controla, y el SVG hereda el color del texto con
 * `currentColor`, así que no introduce tokens nuevos.
 */
export function ChatLauncher({ onOpen, launcherRef }: ChatLauncherProps) {
	return (
		<button
			type="button"
			class="chatbox__launcher"
			data-chatbox-control="launcher"
			aria-label={strings.launcher.open.ariaLabel}
			ref={launcherRef}
			onClick={onOpen}
		>
			<svg class="chatbox__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
			</svg>
		</button>
	);
}
