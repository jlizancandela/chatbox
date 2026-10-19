import type { ComponentChildren } from "preact";
import { strings } from "../strings.es";

type ChatHeaderProps = {
	title: string;
	badge?: string;
	notice: string;
};

export function ChatHeader({
	title,
	badge = strings.header.badge,
	notice,
}: ChatHeaderProps): ComponentChildren {
	return (
		<header class="chatbox__header">
			<div>
				<h1 id="chatbox-title">{title}</h1>
				<span class="chatbox__badge">{badge}</span>
			</div>
			<p>{notice}</p>
		</header>
	);
}
