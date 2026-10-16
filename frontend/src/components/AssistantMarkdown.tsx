import type { ComponentChildren, ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";

const ALLOWED_ELEMENTS = ["p", "strong", "em", "code", "a", "ul", "ol", "li"];
const SAFE_URL = /^(?:https?:|mailto:)/i;

type MarkdownProps = {
	children?: ComponentChildren;
};

type MarkdownRenderer = ComponentType<
	MarkdownProps & { allowedElements?: string[]; urlTransform?: (url: string) => string }
>;

let rendererPromise: Promise<MarkdownRenderer> | null = null;

const loadRenderer = (): Promise<MarkdownRenderer> => {
	rendererPromise ??= import("react-markdown").then(
		(module) => module.default as unknown as MarkdownRenderer
	);
	return rendererPromise;
};

export type AssistantMarkdownProps = {
	content: string;
};

export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
	const [Renderer, setRenderer] = useState<MarkdownRenderer | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void loadRenderer()
			.then((loadedRenderer) => {
				if (!cancelled) setRenderer(() => loadedRenderer);
			})
			.catch(() => {
				if (!cancelled) setLoadFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (loadFailed) return <p>{content}</p>;
	if (!Renderer) return <span>El asistente está escribiendo</span>;

	return (
		<Renderer
			allowedElements={ALLOWED_ELEMENTS}
			urlTransform={(url) => (SAFE_URL.test(url) ? url : "")}
		>
			{content}
		</Renderer>
	);
}
