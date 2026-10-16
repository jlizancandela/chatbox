import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [preact()],
	resolve: {
		alias: {
			react: "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
			"react/jsx-dev-runtime": "preact/jsx-runtime",
			"react-dom": "preact/compat",
			"react-dom/test-utils": "preact/test-utils",
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["test/setup.ts"],
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
	},
});
