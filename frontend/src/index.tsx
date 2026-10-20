import { render } from "preact";
import { App } from "./App";
import "./style.css";

const container = document.getElementById("app");

if (!container) {
	throw new Error("Falta el contenedor #app en index.html");
}

// Fixture de verificación manual de RF-F41 (ver `dev/manual-announcements.tsx`). Solo en
// desarrollo y solo con `?manual=<escenario>`: la página por defecto y la suite de navegador
// no cambian de comportamiento.
const manualScenario = new URLSearchParams(window.location.search).get("manual");

if (import.meta.env.DEV && manualScenario !== null) {
	void import("./dev/manual-announcements").then(({ mountManualScenario }) => {
		if (!mountManualScenario(manualScenario, container)) {
			render(<App />, container);
		}
	});
} else {
	render(<App />, container);
}
