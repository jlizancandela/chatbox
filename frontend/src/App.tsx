import { Chatbox } from "./components/Chatbox";

/**
 * Página de desarrollo por defecto: el widget contra el API real.
 *
 * Es la página que usa también la suite de navegador. Con `?widget=floating` monta la
 * variante flotante del widget (RF-F64), que es la que nace contraída: el lanzador es lo
 * único que hay hasta que se abre.
 */
export function App() {
	const floating = new URLSearchParams(window.location.search).get("widget") === "floating";

	return <Chatbox apiUrl="http://127.0.0.1:7000" variant={floating ? "floating" : "embedded"} />;
}
