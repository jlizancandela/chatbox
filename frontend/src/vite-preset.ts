/**
 * La configuración de Vite que necesita un sitio para montar este widget.
 *
 * El paquete se distribuye **como fuente**: lleva el TypeScript y lo compila el bundler
 * del sitio. Eso impone dos cosas que el sitio no puede adivinar, y que sin ellas
 * compilan pero fallan en el navegador con `React is not defined`:
 *
 * 1. **Los alias de `react`.** El widget renderiza Markdown con `react-markdown`, que
 *    importa `react`. Sin alias, el bundle busca un `react` que el sitio no tiene.
 * 2. **El runtime JSX automático de Preact.** Los ficheros llegan como `.tsx` y un
 *    `tsconfig` dentro de `node_modules` **no se aplica** —comprobado: con el
 *    `tsconfig` en el tarball siguen saliendo 62 `React.createElement`—, así que sin
 *    esta opción esbuild compila el JSX con el runtime clásico.
 *
 * Se exporta en vez de documentarse porque la lista de requisitos puede cambiar, y un
 * sitio que importe esto lo hereda sin volver a leer nada.
 *
 * ```js
 * // astro.config.mjs
 * import { chatboxViteConfig } from "@jlizancandela/chatbox/vite";
 *
 * export default defineConfig({
 *   // …
 *   vite: { ...chatboxViteConfig },
 * });
 * ```
 */
export const chatboxViteConfig = {
	resolve: {
		alias: {
			react: "preact/compat",
			"react-dom": "preact/compat",
			"react/jsx-runtime": "preact/jsx-runtime",
			"react/jsx-dev-runtime": "preact/jsx-dev-runtime",
		},
	},
	esbuild: {
		jsx: "automatic" as const,
		jsxImportSource: "preact",
	},
};
