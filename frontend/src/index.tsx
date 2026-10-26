import { render } from "preact";
import { App } from "./App";
import "./style.css";

const container = document.getElementById("app");

if (!container) {
	throw new Error("Falta el contenedor #app en index.html");
}

render(<App />, container);
