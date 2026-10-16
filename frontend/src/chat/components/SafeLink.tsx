import type { JSX } from "preact";

export type SafeLinkProps = JSX.HTMLAttributes<HTMLAnchorElement>;

export function SafeLink({ children, href, ...props }: SafeLinkProps) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" {...props}>
			{children}
		</a>
	);
}
