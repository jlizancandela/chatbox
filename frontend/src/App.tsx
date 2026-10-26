import { Chatbox } from "./components/Chatbox";

/**
 * Página de desarrollo por defecto: el widget contra el API real.
 *
 * Es la página que usa también la suite de navegador.
 */
export function App() {
	return <Chatbox apiUrl="http://127.0.0.1:7000" />;
}
