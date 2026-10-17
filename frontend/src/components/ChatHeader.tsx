import type { ComponentChildren } from "preact";

type ChatHeaderProps = {
	title: string;
	badge?: string;
	notice: string;
};

export function ChatHeader({ title, badge = "IA", notice }: ChatHeaderProps): ComponentChildren {
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
