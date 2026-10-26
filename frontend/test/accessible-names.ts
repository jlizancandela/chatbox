/**
 * Contrato de nombres accesibles del widget (RF-F45).
 *
 * Fuente única de las reglas de RF-F45 —etiqueta asociada, nombre accesible, botón solo-icono
 * e idioma del widget— y del idioma que el widget declara. La comparten los dos niveles de
 * verificación: el **mecanismo** (jsdom, sobre el código) y la **resolución** (Chromium, sobre
 * el árbol de accesibilidad). No es código de producción: vive con los tests.
 */

/** El idioma que declara el widget en su elemento raíz. */
export const WIDGET_LANGUAGE = "es";

/** El atributo con el que se declara el idioma. */
export const LANGUAGE_ATTRIBUTE = "lang";

/**
 * La clase del elemento raíz del widget.
 *
 * Es la identidad que ancla el widget en el DOM: el contrato comprueba que el elemento que la
 * lleva declara el idioma, y no que cualquier elemento declare `lang="es"`. Un `lang` en una
 * esquina del widget no dice el idioma de sus textos.
 */
export const ROOT_CLASS = "chatbox";

/**
 * Los estados del widget en los que se comprueba que todo control tiene nombre.
 *
 * Un control que solo aparece en un estado —la confirmación en línea, «Ir al final»— también
 * tiene que nombrarse en ese estado: si el nombre se pierde ahí, no lo detecta nadie.
 */
export const NAME_STATES = [
	"vacío",
	"campo lleno",
	"turno en curso",
	"confirmación abierta",
	"desplazado",
] as const;

export type NameState = (typeof NAME_STATES)[number];

/**
 * Un elemento del markup, descrito solo en lo que el contrato necesita saber de él.
 *
 * Es una estructura, no un nodo del AST: el escáner traduce el AST a esta forma y las reglas
 * trabajan sobre ella. Así las reglas se pueden probar con un caso escrito a mano, que es lo que
 * las hace masticables y lo que permite que un test que las exercise de verdad pueda fallar.
 */
export type NamedElement = {
	/** El archivo donde vive, para que el informe diga dónde está el problema. */
	file: string;
	/** La línea donde empieza el elemento. */
	line: number;
	/** La etiqueta JSX: `button`, `textarea`, `a`… */
	tag: string;
	/** El valor literal de `id`, si lo hay. */
	id: string | null;
	/** El valor literal de `for`, si lo hay (solo en `label`). */
	htmlFor: string | null;
	/** El valor literal de `class`, si lo hay. */
	className: string | null;
	/** El valor literal de `lang`, si lo hay. */
	language: string | null;
	/** El valor literal de `role`, si lo hay. */
	role: string | null;
	/** El valor literal de `type`, si lo hay. */
	type: string | null;
	/** Declara `aria-label`. */
	hasAriaLabel: boolean;
	/** Declara `aria-labelledby`. */
	hasAriaLabelledby: boolean;
	/** El elemento pinta texto visible, en su subárbol y sin contar lo que es `aria-hidden`. */
	hasText: boolean;
	/** El elemento está dentro de un `label`, que lo nombra sin necesitar `for`. */
	wrappedInLabel: boolean;
};

/** Un incumplimiento del contrato, con dónde está. */
export type NameOffence = { file: string; line: number; message: string };

/** Campos de formulario: necesitan además una etiqueta que los nombre. */
const FIELDS = new Set(["input", "select", "textarea"]);

/** Controles de activación que no son un campo: un enlace o un botón. */
const ACTIVATABLE = new Set(["a", "button"]);

/** Un `input` de este tipo no se ve y no necesita etiqueta. */
const HIDDEN_INPUT_TYPES = new Set(["hidden"]);

/**
 * ¿El elemento es un campo de formulario?
 *
 * Un `input[type=hidden]` queda fuera: no se ve, no se enfoca y no lo anuncia nadie.
 */
const isField = (element: NamedElement): boolean =>
	FIELDS.has(element.tag) &&
	!(element.tag === "input" && HIDDEN_INPUT_TYPES.has(element.type ?? ""));

/** ¿El elemento se activa con un puntero o con el teclado y necesita nombre? */
const isActivatable = (element: NamedElement): boolean =>
	ACTIVATABLE.has(element.tag) || element.role === "button";

/**
 * El nombre accesible de un campo: la etiqueta que lo asocia, o un nombre declarado en el
 * propio elemento.
 *
 * El contenido de un campo no es su nombre —un campo lleno sigue siendo «Escribe tu pregunta»—,
 * así que el texto visible no cuenta aquí.
 */
const fieldIsNamed = (element: NamedElement, labels: readonly NamedElement[]): boolean =>
	element.hasAriaLabel ||
	element.hasAriaLabelledby ||
	element.wrappedInLabel ||
	(element.id !== null && labels.some((label) => label.htmlFor === element.id));

/**
 * Los incumplimientos de las reglas de nombre de un archivo.
 *
 * Las reglas son:
 *
 * - **R1 · Etiqueta asociada**: un campo de formulario tiene nombre por una etiqueta que lo
 *   asocia (`for`/`id`, o una etiqueta que lo envuelve), o por `aria-label`/`aria-labelledby`.
 * - **R2 · Nombre accesible**: un control activable tiene nombre: su texto visible,
 *   `aria-label` o `aria-labelledby`.
 * - **R3 · Botón solo-icono**: un botón sin texto visible declara `aria-label` o
 *   `aria-labelledby`. Es la forma que toma R2 cuando el control no tiene texto: sin nombre, un
 *   lector de pantalla anuncia «botón» y nada más.
 *
 * R2 y R3 no se solapan: un botón sin texto se informa una sola vez, con el mensaje que explica
 * qué le falta.
 */
export function nameOffences(elements: readonly NamedElement[]): NameOffence[] {
	const offences: NameOffence[] = [];
	const labels = elements.filter((element) => element.tag === "label" && element.htmlFor !== null);

	for (const element of elements) {
		const where = `${element.file}:${element.line} <${element.tag}>`;

		if (isField(element)) {
			if (!fieldIsNamed(element, labels)) {
				offences.push({
					file: element.file,
					line: element.line,
					message: `${where}: campo sin etiqueta asociada ni \`aria-label\``,
				});
			}
			continue;
		}

		if (!isActivatable(element)) continue;
		if (element.hasText) continue;
		if (element.hasAriaLabel || element.hasAriaLabelledby) continue;

		offences.push({
			file: element.file,
			line: element.line,
			message:
				element.tag === "button" || element.role === "button"
					? `${where}: botón solo-icono sin \`aria-label\``
					: `${where}: control sin nombre accesible`,
		});
	}

	return offences;
}

/**
 * El incumplimiento del idioma del widget, si lo hay.
 *
 * El elemento raíz es el que lleva la clase del widget: es el que envuelve todos los textos y
 * el que hereda el idioma a todo el subárbol. Un `lang` en otro sitio no declara el idioma del
 * widget.
 *
 * Se evalúa sobre **todos** los elementos del widget, no sobre uno: la raíz es única y tiene que
 * aparecer una sola vez.
 */
export function languageOffence(elements: readonly NamedElement[]): NameOffence | null {
	const roots = elements.filter((element) => element.className === ROOT_CLASS);

	if (roots.length === 0) {
		return {
			file: "src/",
			line: 0,
			message: `no se encuentra el elemento raíz del widget (class="${ROOT_CLASS}")`,
		};
	}

	if (roots.length > 1) {
		return {
			file: roots[1].file,
			line: roots[1].line,
			message: `el elemento raíz del widget aparece ${roots.length} veces`,
		};
	}

	const root = roots[0];
	if (root.language === WIDGET_LANGUAGE) return null;

	return {
		file: root.file,
		line: root.line,
		message: `el elemento raíz del widget no declara \`${LANGUAGE_ATTRIBUTE}="${WIDGET_LANGUAGE}"\``,
	};
}
