import { Chatbox } from "./components/Chatbox";

/**
 * Página de desarrollo por defecto: el widget contra la API real.
 *
 * El fixture de verificación manual de RF-F41 vive en `dev/manual-announcements.tsx` y solo
 * se carga con `?manual=<escenario>`; el browser suite usa esta misma página.
 */
export function App() {
	return <Chatbox apiUrl="http://127.0.0.1:7000" />;
}
