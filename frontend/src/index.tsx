import { render } from "preact";
import { Chatbox } from "./components/Chatbox";
import "./style.css";

export function App() {
	return <Chatbox apiUrl="http://127.0.0.1:7000" />;
}

const container = document.getElementById("app");
if (container) render(<App />, container);
