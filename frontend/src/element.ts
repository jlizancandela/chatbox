/**
 * El custom element del widget: `<chatbox-widget>`.
 *
 * Es la puerta de entrada para quien no integra Preact: un sitio que solo quiere poner
 * el chat en una página escribe el elemento y sus atributos, sin bundler que configurar
 * y sin saber qué framework usa por debajo.
 *
 * El elemento **no** es una copia del widget: monta el mismo `Chatbox` de siempre, con
 * las mismas props. Cada atributo es una prop, y el atributo que falta toma el valor por
 * defecto del widget.
 *
 * Por qué no `preact/custom-element`: ese módulo existió en Preact 10 y **no** existe en
 * Preact 11, que es la versión que usa el widget. El elemento se declara a mano sobre
 * `render()` para que el paquete sirva igual con las dos versiones del peer
 * (`preact: ^10.6.5 || ^11.0.0`).
 */

import { h, render } from "preact";
import { Chatbox, type ChatboxProps } from "./components/Chatbox";

/** El nombre con el que se registra el custom element. */
export const CHATBOX_ELEMENT_TAG = "chatbox-widget";

/**
 * Los atributos que el elemento observa.
 *
 * Cada uno corresponde a una prop del widget. `initially-expanded` es la excepción a la
 * regla "mismo nombre que la prop": en HTML un atributo booleano está presente o no
 * está, y `initially-collapsed="false"` seguiría siendo `true`. Por eso el atributo
 * declara el estado afirmativo —"nace expandido"—, y su ausencia deja que el widget
 * decida (la variante flotante nace contraída).
 */
export const CHATBOX_ELEMENT_ATTRIBUTES = [
	"api-url",
	"suggestions",
	"contact-url",
	"title",
	"variant",
	"initially-expanded",
] as const;

/** Los valores admitidos por el atributo `variant`. */
const VARIANTS = ["embedded", "floating"] as const;

/**
 * La clase base del elemento.
 *
 * En un entorno sin DOM —una compilación SSR, o un test de Node— `HTMLElement` no existe
 * y una clase que lo extiende revienta al importar el módulo. La clase se declara igual:
 * lo que necesita el DOM no se usa hasta que hay DOM.
 */
const ElementBase: typeof HTMLElement =
	typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/**
 * Las props que el elemento deduce de sus atributos.
 *
 * Un atributo que no está no se pasa: el widget conserva su valor por defecto. Un
 * atributo que está pero viene vacío tampoco: un `title=""` no es un título, es la
 * ausencia de título.
 */
const readProps = (element: HTMLElement): Partial<ChatboxProps> => {
	const props: Partial<ChatboxProps> = {};

	const suggestions = element.getAttribute("suggestions");
	if (suggestions !== null) {
		// Las sugerencias son una lista: en HTML travels como una sola cadena separada por
		// comas. Los huecos sobrantes no son sugerencias.
		const parsed = suggestions
			.split(",")
			.map((suggestion) => suggestion.trim())
			.filter((suggestion) => suggestion.length > 0);
		if (parsed.length > 0) props.suggestions = parsed;
	}

	const contactUrl = element.getAttribute("contact-url")?.trim();
	if (contactUrl) props.contactUrl = contactUrl;

	const title = element.getAttribute("title")?.trim();
	if (title) props.title = title;

	const variant = element.getAttribute("variant")?.trim();
	if (variant && (VARIANTS as readonly string[]).includes(variant)) {
		props.variant = variant as ChatboxProps["variant"];
	}

	// Presente significa «nace expandido»: el widget decide lo contrario cuando el
	// atributo no está.
	if (element.hasAttribute("initially-expanded")) props.initiallyCollapsed = false;

	return props;
};

export class ChatboxElement extends ElementBase {
	static get observedAttributes(): string[] {
		return [...CHATBOX_ELEMENT_ATTRIBUTES];
	}

	connectedCallback(): void {
		this.mount();
	}

	attributeChangedCallback(): void {
		// El callback también salta antes de que el elemento esté en el documento: solo
		// monta cuando está conectado.
		if (this.isConnected) this.mount();
	}

	disconnectedCallback(): void {
		render(null, this);
	}

	/**
	 * Monta el widget dentro del elemento.
	 *
	 * Sin `api-url` no hay widget: el chat necesita saber a quién preguntar, y un
	 * widget contra una URL vacía fallaría en cada turno. El elemento no monta a medias y
	 * dice por qué en la consola.
	 */
	private mount(): void {
		const apiUrl = this.getAttribute("api-url")?.trim();

		if (!apiUrl) {
			render(null, this);
			console.error(
				`<${CHATBOX_ELEMENT_TAG}> necesita el atributo "api-url" con la URL del API del chatbox.`
			);
			return;
		}

		render(h(Chatbox, { apiUrl, ...readProps(this) }), this);
	}
}

/**
 * Registra el custom element.
 *
 * Importar el módulo ya lo registra: quien lo importa desde un `<script type="module">`
 * solo tiene que escribir `<chatbox-widget>` en el HTML. Registrarlo dos veces es un
 * error en la plataforma, así que el registro se comprueba antes.
 */
export function defineChatboxElement(tagName: string = CHATBOX_ELEMENT_TAG): void {
	if (typeof customElements === "undefined") return;
	if (customElements.get(tagName)) return;
	customElements.define(tagName, ChatboxElement);
}

defineChatboxElement();
