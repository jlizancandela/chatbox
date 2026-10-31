/**
 * El custom element del widget (issue #133).
 *
 * Ejercita la costura que ve quien consume el paquete sin integrar Preact: escribe el
 * elemento en el HTML, le da sus atributos y espera ver el widget. Lo que se comprueba es
 * lo que se ve —el lanzador, la cabecera, las sugerencias, el panel— y no los detalles
 * internos del montaje.
 */

import { cleanup, screen, within } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHATBOX_ELEMENT_TAG } from "../../src/element";
import { strings } from "../../src/strings.es";

/** Monta el custom element con los atributos dados. */
const mountElement = (attributes: Record<string, string>): HTMLElement => {
	const element = document.createElement(CHATBOX_ELEMENT_TAG);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	document.body.append(element);
	return element;
};

/** El lanzador: el único control que existe en el estado contraído. */
const launcher = (): HTMLElement =>
	screen.getByRole("button", { name: strings.launcher.open.ariaLabel });

describe("el custom element del widget", () => {
	afterEach(() => {
		cleanup();
		document.body.innerHTML = "";
	});
	beforeEach(() => sessionStorage.clear());

	it("monta el widget: aparece el lanzador", () => {
		mountElement({ "api-url": "http://localhost:7000" });

		expect(launcher()).toBeInTheDocument();
	});

	it("sin api-url no monta el widget y lo dice", () => {
		// El widget necesita saber a quién preguntar: sin URL no hay chat, y un chat
		// montado a medias fallaría en cada turno. El elemento avisa en vez de fallar en
		// silencio.
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});

		mountElement({});

		expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
		expect(errors).toHaveBeenCalled();
		errors.mockRestore();
	});

	it("el atributo title llega a la cabecera", () => {
		mountElement({
			"api-url": "http://localhost:7000",
			variant: "embedded",
			title: "Pregúntame lo que quieras",
		});

		expect(screen.getByRole("heading", { name: "Pregúntame lo que quieras" })).toBeInTheDocument();
	});

	it("las sugerencias llegan como lista y los huecos sobrantes no cuentan", () => {
		mountElement({
			"api-url": "http://localhost:7000",
			variant: "embedded",
			suggestions: "Uno, Dos , ",
		});

		const suggestions = within(
			screen.getByRole("navigation", { name: strings.a11y.emptyStateNavLabel })
		);
		const buttons = suggestions.getAllByRole("button");

		expect(buttons.map((button) => button.textContent)).toEqual(["Uno", "Dos"]);
	});

	it("initially-expanded abre el panel", () => {
		// Sin el atributo, la variante flotante nace contraída: es lo que decide el widget.
		// Con él, el panel está abierto desde el principio.
		mountElement({ "api-url": "http://localhost:7000", "initially-expanded": "" });

		expect(screen.getByLabelText(strings.input.label)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
	});

	it("el atributo variant monta la variante que dice", () => {
		// La lista de valores admitidos es cerrada y un valor que no está en ella se
		// descarta en silencio: si «drawer» no llegara a la lista, el atributo se perdería y
		// el widget montaría flotante sin avisar de nada.
		const element = mountElement({ "api-url": "http://localhost:7000", variant: "drawer" });

		expect(element.querySelector(".chatbox")).toHaveAttribute("data-variant", "drawer");
	});

	it("un valor de variant que no existe se ignora y manda el defecto", () => {
		// La entrada que rechaza: un valor inventado no monta una variante inventada.
		const element = mountElement({ "api-url": "http://localhost:7000", variant: "cajon" });

		expect(element.querySelector(".chatbox")).toHaveAttribute("data-variant", "floating");
	});

	it("cambiar un atributo vuelve a montar el widget", () => {
		const element = mountElement({
			"api-url": "http://localhost:7000",
			variant: "embedded",
			title: "Título de antes",
		});

		element.setAttribute("title", "Título de después");

		expect(screen.getByRole("heading", { name: "Título de después" })).toBeInTheDocument();
	});

	it("al quitarlo de la página, el widget se desmonta", () => {
		const element = mountElement({ "api-url": "http://localhost:7000" });

		element.remove();

		expect(screen.queryByRole("button", { name: strings.launcher.open.ariaLabel })).toBeNull();
	});
});
