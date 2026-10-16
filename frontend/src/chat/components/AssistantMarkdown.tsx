import type { ComponentChildren, ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { SafeLink } from "./SafeLink";

const ALLOWED_ELEMENTS = ["p", "strong", "em", "code", "a", "ul", "ol", "li"];
export const isSafeUrl = (url: string): boolean => {
	if (/^mailto:[^\s]+@[^\s]+$/i.test(url)) return true;

	try {
		if (!/^https?:\/\//i.test(url)) return false;
		const parsed = new URL(url);
		return (
			(parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0
		);
	} catch {
		return false;
	}
};

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
	if (!Renderer) return null;

	return (
		<Renderer
			allowedElements={ALLOWED_ELEMENTS}
			components={{ a: SafeLink }}
			urlTransform={(url) => (isSafeUrl(url) ? url : "")}
		>
			{content}
		</Renderer>
	);
}
