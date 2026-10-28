import { Chatbox } from "./components/Chatbox";

/**
 * Página de desarrollo por defecto: el widget contra el API real.
 *
 * Es la página que usa también la suite de navegador. Monta el widget como lo montaría
 * el sitio: en su variante flotante, que nace contraído (RF-F64). Con `?widget=embedded`
 * se monta la embebida, que es la que usa la suite de navegador —el widget llenando la
 * página, como un sitio que le da una sección—.
 */
export function App() {
	const embedded = new URLSearchParams(window.location.search).get("widget") === "embedded";

	return <Chatbox apiUrl="http://127.0.0.1:7000" variant={embedded ? "embedded" : "floating"} />;
}
