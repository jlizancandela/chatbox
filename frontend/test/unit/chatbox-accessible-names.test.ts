/**
 * RF-F45 — el contrato de nombres accesibles del widget.
 *
 * Nivel de verificación: **mecanismo**. Afirma que el markup del widget nombra todo lo que
 * nombra: el campo de texto con una etiqueta asociada, los controles con un nombre accesible,
 * los botones solo-icono con `aria-label`, y el componente con el idioma que declara.
 *
 * El nivel de resolución (Chromium, sobre el árbol de accesibilidad real) vive en
 * `test/browser/accessible-names.spec.ts`. Este nivel no se apoya en el DOM renderizado: mira
 * el código, que es donde el nombre se puede perder sin que nadie lo note.
 */

import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";
import {
	languageOffence,
	type NamedElement,
	nameOffences,
	ROOT_CLASS,
	WIDGET_LANGUAGE,
} from "../accessible-names";

// --- El escáner ----------------------------------------------------------------

type AstNode = Record<string, unknown> & {
	type?: string;
	loc?: { start: { line: number } };
	value?: unknown;
};

/**
 * La etiqueta y los atributos de un elemento.
 *
 * En el AST de Babel el nombre y los atributos cuelgan de `openingElement`, no del elemento:
 * `JSXElement` solo tiene los hijos y el cierre.
 */
const openingOf = (element: AstNode): AstNode => {
	const opening = element.openingElement as AstNode | undefined;
	return opening && typeof opening === "object" ? opening : element;
};

const tagOf = (element: AstNode): string => {
	const name = (openingOf(element).name as AstNode | undefined)?.name;
	return typeof name === "string" ? name : "";
};

const attributesOf = (element: AstNode): AstNode[] => {
	const attributes = openingOf(element).attributes;
	return Array.isArray(attributes) ? (attributes as AstNode[]) : [];
};

const childrenOf = (element: AstNode): AstNode[] => {
	const children = element.children;
	return Array.isArray(children) ? (children as AstNode[]) : [];
};

/**
 * El valor literal de un atributo, si lo hay.
 *
 * Un valor que no es un literal —`aria-label={copy.ariaLabel}`, `class={...}`— no se resuelve:
 * la guarda solo necesita saber que el atributo existe, no qué vale.
 */
const literalAttribute = (element: AstNode, name: string): string | null => {
	for (const attribute of attributesOf(element)) {
		if ((attribute.name as AstNode | undefined)?.name !== name) continue;
		const value = attribute.value as AstNode | null;
		if (!value || typeof value !== "object") return null;
		if (value.type === "StringLiteral" && typeof value.value === "string") return value.value;
		const inner =
			value.type === "JSXExpressionContainer" ? (value.expression as AstNode | null) : null;
		return inner?.type === "StringLiteral" && typeof inner.value === "string" ? inner.value : null;
	}
	return null;
};

/** ¿El elemento declara el atributo? El valor puede ser dinámico: lo que importa es que exista. */
const declaresAttribute = (element: AstNode, name: string): boolean =>
	attributesOf(element).some((attribute) => (attribute.name as AstNode | undefined)?.name === name);

/**
 * ¿El elemento es `aria-hidden`?
 *
 * Se reconocen las dos formas que se usan: el literal (`aria-hidden="true"`) y la expresión
 * booleana (`aria-hidden={true}`). Lo que es `aria-hidden` no se anuncia, así que un icono
 * decorativo no puede ser el nombre de un botón.
 */
const isAriaHidden = (element: AstNode): boolean => {
	for (const attribute of attributesOf(element)) {
		if ((attribute.name as AstNode | undefined)?.name !== "aria-hidden") continue;
		const value = attribute.value as AstNode | null;
		if (!value || typeof value !== "object") return false;
		if (value.type === "StringLiteral") return value.value === "true";
		const inner =
			value.type === "JSXExpressionContainer" ? (value.expression as AstNode | null) : null;
		return inner?.type === "BooleanLiteral" && inner.value === true;
	}
	return false;
};

/**
 * ¿Pinta esta expresión texto visible?
 *
 * Un identificador, una llamada o un literal: puede pintar texto, y ante la duda se cuenta como
 * texto. Falso positivo antes que falso negativo: el coste de equivocarse es un aviso que se
 * revisa a mano; el de la otra dirección es un control sin nombre que pasa desapercibido.
 */
const expressionRendersText = (expression: unknown): boolean => {
	if (!expression || typeof expression !== "object") return false;
	const node = expression as AstNode;
	switch (node.type) {
		case "JSXElement":
		case "JSXFragment":
			return subtreeRendersText(node);
		case "ConditionalExpression":
			return expressionRendersText(node.consequent) || expressionRendersText(node.alternate);
		case "LogicalExpression":
			return expressionRendersText(node.right);
		default:
			return true;
	}
};

/**
 * ¿Pinta el subárbol del elemento texto visible?
 *
 * Lo que es `aria-hidden` no se anuncia: un icono con un `×` dentro no es el nombre del botón.
 */
const subtreeRendersText = (element: AstNode): boolean => {
	if (isAriaHidden(element)) return false;
	return childrenOf(element).some(childRendersText);
};

/** ¿Pinta este hijo texto visible? */
const childRendersText = (child: AstNode): boolean => {
	if (child.type === "JSXText") {
		return typeof child.value === "string" && child.value.trim() !== "";
	}
	if (child.type === "JSXExpressionContainer") {
		return expressionRendersText(child.expression);
	}
	if (child.type === "JSXElement" || child.type === "JSXFragment") {
		return subtreeRendersText(child);
	}
	return false;
};

/**
 * Los elementos del markup que el contrato vigila.
 *
 * El escaneo recorre el archivo entero, no solo los componentes: un control que se cuela en
 * `src/chat/components/` entra en el contrato igual que uno de `src/components/`.
 */
const scan = (source: string, file: string): NamedElement[] => {
	const ast = parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	}) as unknown as AstNode;
	const found: NamedElement[] = [];

	const visit = (node: unknown, insideLabel: boolean): void => {
		if (Array.isArray(node)) {
			for (const entry of node) visit(entry, insideLabel);
			return;
		}
		if (node === null || typeof node !== "object") return;
		const { type } = node as AstNode;
		if (typeof type !== "string") return;

		if (type === "JSXElement") {
			const element = node as AstNode;
			const tag = tagOf(element);
			const children = childrenOf(element);

			found.push({
				file,
				line: element.loc?.start.line ?? 0,
				tag,
				id: literalAttribute(element, "id"),
				// Preact acepta `for` y su alias `htmlFor`: los dos asocian la etiqueta.
				htmlFor: literalAttribute(element, "for") ?? literalAttribute(element, "htmlFor"),
				className: literalAttribute(element, "class"),
				language: literalAttribute(element, "lang"),
				role: literalAttribute(element, "role"),
				type: literalAttribute(element, "type"),
				hasAriaLabel: declaresAttribute(element, "aria-label"),
				hasAriaLabelledby: declaresAttribute(element, "aria-labelledby"),
				hasText: children.some(childRendersText),
				wrappedInLabel: insideLabel,
			});

			const inLabel = insideLabel || tag === "label";
			for (const child of children) visit(child, inLabel);
			for (const attribute of attributesOf(element)) visit(attribute, inLabel);
			return;
		}

		for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
			if (key === "type" || key === "loc") continue;
			visit(child, insideLabel);
		}
	};

	visit(ast, false);
	return found;
};

/** `src/components/Chatbox.tsx`, sin el prefijo que devuelve el glob. */
const displayPath = (path: string): string => {
	const at = path.indexOf("src/");
	return at === -1 ? path : path.slice(at);
};

/**
 * Los componentes del widget, en **todo** `src/`.
 *
 * `src/dev/` queda fuera: son fixtures de verificación manual que no se distribuyen.
 */
const COMPONENT_SOURCES = Object.fromEntries(
	Object.entries(
		import.meta.glob("../../src/**/*.tsx", {
			query: "?raw",
			import: "default",
			eager: true,
		}) as Record<string, string>
	).filter(([path]) => !path.includes("/src/dev/"))
);

const ALL_ELEMENTS = Object.entries(COMPONENT_SOURCES).flatMap(([path, source]) =>
	scan(source, displayPath(path))
);

// --- El widget real ------------------------------------------------------------

describe("el widget real cumple el contrato de nombres", () => {
	it("el escáner mira los componentes del widget", () => {
		// Un glob mal escrito dejaría el inventario vacío y el test pasaría en falso.
		const files = Object.keys(COMPONENT_SOURCES).map(displayPath).sort();
		expect(files.length).toBeGreaterThan(0);
		expect(files).toContain("src/components/Chatbox.tsx");
		expect(ALL_ELEMENTS.length).toBeGreaterThan(0);
	});

	it("ningún control se queda sin nombre", () => {
		expect(nameOffences(ALL_ELEMENTS)).toEqual([]);
	});

	it("el widget declara su idioma en la raíz", () => {
		expect(languageOffence(ALL_ELEMENTS)).toBeNull();
	});

	it("el campo de texto se nombra con su etiqueta", () => {
		const field = ALL_ELEMENTS.find((element) => element.tag === "textarea" && element.id !== null);
		expect(field, "el widget tiene un campo de texto").toBeDefined();
		expect(
			ALL_ELEMENTS.some((element) => element.tag === "label" && element.htmlFor === field?.id),
			"hay una etiqueta que apunta al campo"
		).toBe(true);
	});

	it("el elemento raíz es el único que declara el idioma", () => {
		const roots = ALL_ELEMENTS.filter((element) => element.className === ROOT_CLASS);
		expect(roots).toHaveLength(1);
		expect(roots[0].language).toBe(WIDGET_LANGUAGE);
	});
});

// --- La guarda muerde ----------------------------------------------------------

describe("la guarda de nombres", () => {
	/** Los incumplimientos de un fragmento de código escrito a mano. */
	const offencesOf = (source: string): string[] =>
		nameOffences(scan(source, "src/components/Fantasma.tsx")).map((offence) => offence.message);

	it("muerde con un botón solo-icono sin `aria-label`", () => {
		// La regresión que la Decisión 007 dejó anunciada: un botón de icono entra en el widget
		// y no lo nombra nadie. Sin nombre, un lector de pantalla anuncia «botón» y nada más.
		const offences = offencesOf(
			'export const Fantasma = () => <button type="button"><Icon /></button>;'
		);
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("botón solo-icono");
	});

	it("muerde con un enlace sin texto y sin `aria-label`", () => {
		const offences = offencesOf('export const F = () => <a href="/x"></a>;');
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("control sin nombre accesible");
	});

	it("muerde con un campo sin etiqueta asociada", () => {
		const offences = offencesOf('export const F = () => <textarea id="campo" />;');
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("campo sin etiqueta asociada");
	});

	it("muerde cuando la etiqueta apunta a otro campo", () => {
		const offences = offencesOf(
			'export const F = () => (<><label for="otro">Texto</label><textarea id="campo" /></>);'
		);
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("campo sin etiqueta asociada");
	});

	it("acepta un botón solo-icono que sí se nombra", () => {
		expect(
			offencesOf(
				'export const F = () => <button type="button" aria-label="Ir al final"><Icon /></button>;'
			)
		).toEqual([]);
	});

	it("acepta un campo con etiqueta y un control con texto visible", () => {
		expect(
			offencesOf(
				'export const F = () => (<><label htmlFor="campo">Escribe</label>' +
					'<textarea id="campo" /><button type="button">Enviar</button></>);'
			)
		).toEqual([]);
	});

	it("acepta un campo envuelto en su etiqueta", () => {
		// Una etiqueta que envuelve al campo lo nombra sin `for`: es la otra forma de
		// asociarla, y la guarda no puede marcarla como falta de etiqueta.
		expect(offencesOf("export const F = () => <label>Escribe<textarea /></label>;")).toEqual([]);
	});

	it("no cuenta el texto que es `aria-hidden` como nombre", () => {
		// Un icono con un «×» dentro no es el nombre del botón: si es `aria-hidden`, el
		// botón sigue sin nombre y tiene que declararlo.
		const offences = offencesOf(
			'export const F = () => <button type="button"><span aria-hidden="true">×</span></button>;'
		);
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("botón solo-icono");
	});

	it("tampoco cuenta el texto con `aria-hidden` escrito como expresión", () => {
		// Las dos formas de escribirlo significan lo mismo: si solo se reconociera el
		// literal, un icono decorativo con `aria-hidden={true}` contaría como texto y el
		// botón solo-icono passaría sin nombre.
		const offences = offencesOf(
			'export const F = () => <button type="button"><span aria-hidden={true}>×</span></button>;'
		);
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("botón solo-icono");
	});

	it('muerde con un `role="button"` sin nombre', () => {
		const offences = offencesOf('export const F = () => <span role="button" />;');
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("botón solo-icono");
	});
});

describe("la guarda del idioma", () => {
	const languageOffenceOf = (source: string): string | null =>
		languageOffence(scan(source, "src/components/Fantasma.tsx"))?.message ?? null;

	it("muerde cuando la raíz no declara el idioma", () => {
		const message = languageOffenceOf('export const F = () => <section class="chatbox" />;');
		expect(message).toContain('no declara `lang="es"`');
	});

	it("muerde cuando la raíz declara otro idioma", () => {
		const message = languageOffenceOf(
			'export const F = () => <section class="chatbox" lang="en" />;'
		);
		expect(message).toContain('no declara `lang="es"`');
	});

	it("muerde cuando no se encuentra la raíz del widget", () => {
		const message = languageOffenceOf('export const F = () => <section class="otro" />;');
		expect(message).toContain("no se encuentra el elemento raíz");
	});

	it("acepta una raíz que declara el idioma del widget", () => {
		expect(languageOffenceOf('export const F = () => <section class="chatbox" lang="es" />;')).toBe(
			null
		);
	});
});
