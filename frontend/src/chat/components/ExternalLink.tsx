import type { ComponentProps } from "preact";

export type ExternalLinkProps = ComponentProps<"a">;

export function ExternalLink({ children, href, ...props }: ExternalLinkProps) {
	// Preact 11 types IntrinsicElements['a'] as a two-branch union keyed on
	// `href`; spreading props whose `href` is optional satisfies neither branch.
	// The component always renders an anchor, so narrow at this boundary.
	const anchorProps = { href, ...props } as ComponentProps<"a">;

	return (
		<a {...anchorProps} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	);
}
