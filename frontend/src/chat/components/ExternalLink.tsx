import type { JSX } from "preact";

export type ExternalLinkProps = JSX.HTMLAttributes<HTMLAnchorElement>;

export function ExternalLink({ children, href, ...props }: ExternalLinkProps) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" {...props}>
			{children}
		</a>
	);
}
