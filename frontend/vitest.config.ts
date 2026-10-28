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
		css: true,
		/**
		 * Los paquetes que renderizan con React tienen que pasar por Vite: si se externalizan,
		 * sus imports de `react` y `react/jsx-runtime` esquivan el alias de arriba y llegan al
		 * React real, cuyos elementos vienen congelados y Preact no puede diffearlos. En el
		 * navegador no pasa: allí los empaqueta el mismo Vite, con el alias aplicado.
		 */
		server: {
			deps: {
				inline: ["react-markdown", "hast-util-to-jsx-runtime"],
			},
		},
	},
});

