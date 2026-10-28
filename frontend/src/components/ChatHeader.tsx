import type { ComponentChildren } from "preact";
import { strings } from "../strings.es";
import { Icon } from "./Icon";

type ChatHeaderProps = {
	title: string;
	badge?: string;
	notice: string;
	/**
	 * Cuando está, la cabecera pinta el botón de contraer el chat (RF-F64).
	 *
	 * Solo la variante flotante lo tiene: la embebida vive en el flujo del sitio host y no
	 * tiene dónde recogerse.
	 */
	onCollapse?: () => void;
};

export function ChatHeader({
	title,
	badge = strings.header.badge,
	notice,
	onCollapse,
}: ChatHeaderProps): ComponentChildren {
	return (
		<header class="chatbox__header">
			<div>
				<h1 id="chatbox-title">{title}</h1>
				<span class="chatbox__badge">{badge}</span>
			</div>
			{onCollapse && (
				<button
					type="button"
					class="chatbox__collapse"
					data-chatbox-control="collapse"
					aria-label={strings.actions.collapse.ariaLabel}
					onClick={onCollapse}
				>
					<Icon path="M6 19h12v-2H6v2z" />
				</button>
			)}
			<p>{notice}</p>
		</header>
	);
}
