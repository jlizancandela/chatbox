import { render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-markdown", () => ({
	default: ({
		children,
		allowedElements,
		urlTransform,
	}: {
		children: string;
		allowedElements: string[];
		urlTransform: (url: string) => string;
	}) => (
		<article
			data-allowed={allowedElements.join(",")}
			data-safe-url={urlTransform("https://example.com")}
			data-unsafe-url={urlTransform("javascript:alert(1)")}
			data-relative-url={urlTransform("/contacto")}
		>
			{children}
		</article>
	),
}));

import { AssistantMarkdown } from "../../src/chat/components/AssistantMarkdown";

describe("AssistantMarkdown", () => {
	it("loads the renderer lazily with the allowed Markdown policy", async () => {
		render(<AssistantMarkdown content="**negrita** y `código`" />);

		const renderer = await waitFor(() => screen.getByRole("article"));
		expect(renderer).toHaveAttribute("data-allowed", "p,strong,em,code,a,ul,ol,li");
		expect(renderer).toHaveAttribute("data-safe-url", "https://example.com");
		expect(renderer).toHaveAttribute("data-unsafe-url", "");
		expect(renderer).toHaveTextContent("**negrita** y `código`");
	});

	it("rejects relative URLs through the renderer policy", async () => {
		render(<AssistantMarkdown content="enlace" />);

		const renderer = await waitFor(() => screen.getByRole("article"));
		expect(renderer).toHaveAttribute("data-unsafe-url", "");
		expect(renderer).toHaveAttribute("data-relative-url", "");
	});
});
