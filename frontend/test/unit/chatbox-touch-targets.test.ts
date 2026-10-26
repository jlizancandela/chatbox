/**
 * RF-F43 — el contrato de objetivos táctiles del widget (issue #98).
 *
 * Nivel de verificación: **mecanismo**. Se afirma que la hoja de estilos fija el suelo de
 * 44 px en px CSS absolutos y que todo control interactivo de los componentes está
 * inventariado con una identidad del contrato. El valor resuelto lo verifica la suite de
 * navegador (`test/browser/touch-targets.spec.ts`). Ver
 * `docs/decisions/007-objetivos-tactiles.md`.
 */

import { parse } from "@babel/parser";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { cssSource, declarationsOf, styles } from "../css-layers";
import {
	CONTROL_ATTRIBUTE,
	CONTROL_IDS,
	declaredSize,
	EXEMPT,
	FLOOR_SELECTOR,
	isFloor,
	KNOWN_IDS,
} from "../touch-targets";

// --- El suelo ----------------------------------------------------------------

/**
 * Suelos declarados en una regla que apunta a botones, fuera de px CSS absolutos.
 *
 * Comprobar solo la regla `.chatbox button` no basta: una regla más específica puede volver a
 * declarar el suelo en `rem` después, y con una raíz de 14 px el control mediría 38,5 px sin
 * que ninguno de los dos niveles se entere. `0` no es un suelo, es su ausencia.
 */
function floorOffencesIn(source: string): string[] {
	const offences: string[] = [];
	postcss.parse(source).walkRules((rule) => {
		if (!rule.selectors.some((selector) => selector.includes("button"))) return;
		for (const node of rule.nodes) {
			if (node.type !== "decl") continue;
			if (node.prop !== "min-height" && node.prop !== "min-width") continue;
			const size = declaredSize(node.value);
			if (size === null || (size.value === 0 && size.unit === "")) continue;
			if (!isFloor(size)) offences.push(`${rule.selector} { ${node.prop}: ${node.value} }`);
		}
	});
	return offences;
}

describe("el suelo declarado", () => {
	/**
	 * La regla que fija el suelo, por coincidencia exacta de selector.
	 *
	 * No vale `topLevelRule`: esa devuelve la primera regla que *incluye* el selector, y aquí
	 * la primera es `.chatbox textarea, .chatbox button`, que solo declara la fuente. Buscar
	 * el suelo en la regla equivocada daría verde con el suelo equivocado.
	 */
	const matches = styles.nodes.filter(
		(node): node is Rule =>
			node.type === "rule" && node.selectors.length === 1 && node.selectors[0] === FLOOR_SELECTOR
	);

	it("la regla del suelo existe y es única", () => {
		expect(matches).toHaveLength(1);
	});

	const declarations = declarationsOf(matches[0] as Rule);

	it("es 44 px CSS absolutos en las dos dimensiones", () => {
		expect(declarations["min-height"]).toBe("44px");
		expect(declarations["min-width"]).toBe("44px");
	});

	it("ninguna regla de botones declara el suelo en una unidad relativa", () => {
		expect(floorOffencesIn(cssSource)).toEqual([]);
	});

	it("rechaza un suelo en rem escondido en otra regla", () => {
		// La regresión que motivó la Decisión 007, por la puerta de atrás: una regla más
		// específica vuelve a declarar el suelo en rem y ambos niveles se quedan en verde.
		const offences = floorOffencesIn(
			".chatbox button { min-height: 44px; min-width: 44px; }\n" +
				'.chatbox__footer button[type="submit"] { min-height: 2.75rem; }'
		);
		expect(offences).toHaveLength(1);
		expect(offences[0]).toContain("2.75rem");
	});

	it("rechaza cualquier suelo que no sea 44 px absolutos", () => {
		// 2.75rem vale 44 px con una raíz de 16 px y 38,5 px con una raíz de 14 px: el host
		// con el tamaño de fuente más común rompería RF-F43 sin que el navegador lo viera.
		expect(isFloor(declaredSize("2.75rem"))).toBe(false);
		expect(isFloor(declaredSize("40px"))).toBe(false);
		expect(isFloor(declaredSize("calc(44px)"))).toBe(false);
		expect(isFloor(declaredSize(undefined))).toBe(false);
		expect(isFloor(declaredSize("44px"))).toBe(true);
	});
});

// --- La guarda ----------------------------------------------------------------

type AstNode = Record<string, unknown> & {
	type?: string;
	loc?: { start: { line: number } };
	value?: unknown;
};

/** Etiquetas JSX que el contrato trata como controles de activación. */
const INTERACTIVE_ELEMENTS = new Set(["a", "button", "input", "select", "textarea"]);

/** Rol que hace interactivo un elemento que no lo es por su etiqueta. */
const INTERACTIVE_ROLES = new Set(["button"]);

type InteractiveElement = { tag: string; line: number; id: string | null };

/**
 * El valor de un atributo JSX, cuando es una cadena literal.
 *
 * Una identidad dinámica (`{id}`) no se resuelve: si el control no puede nombrar su
 * identidad en el código fuente, la guarda no tiene nada que contrastar con el inventario,
 * así que lo trata como si no la declarara.
 */
function attributeOf(element: AstNode, name: string): string | undefined {
	const attributes = element.attributes;
	if (!Array.isArray(attributes)) return undefined;
	for (const entry of attributes) {
		const attribute = entry as AstNode;
		if ((attribute.name as AstNode | undefined)?.name !== name) continue;
		const value = attribute.value as AstNode | null;
		if (!value || typeof value !== "object") return undefined;
		if (value.type === "StringLiteral" && typeof value.value === "string") return value.value;
		const inner = value.type === "JSXExpressionContainer" ? (value.expression as AstNode) : null;
		return inner?.type === "StringLiteral" && typeof inner.value === "string"
			? inner.value
			: undefined;
	}
	return undefined;
}

/** Los controles interactivos que declara un archivo de componentes. */
function interactiveElements(source: string): InteractiveElement[] {
	const ast = parse(source, {
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	}) as unknown as AstNode;
	const found: InteractiveElement[] = [];

	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const entry of node) visit(entry);
			return;
		}
		if (node === null || typeof node !== "object") return;
		const { type } = node as AstNode;
		if (typeof type !== "string") return;

		if (type === "JSXOpeningElement") {
			const element = node as AstNode;
			const tag = (element.name as AstNode | undefined)?.name;
			const role = attributeOf(element, "role");
			const interactive =
				typeof tag === "string" &&
				(INTERACTIVE_ELEMENTS.has(tag) || (role !== undefined && INTERACTIVE_ROLES.has(role)));
			if (interactive && typeof tag === "string") {
				found.push({
					tag,
					line: element.loc?.start.line ?? 0,
					id: attributeOf(element, CONTROL_ATTRIBUTE) ?? null,
				});
			}
		}

		for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
			if (key === "type" || key === "loc") continue;
			visit(child);
		}
	};

	visit(ast);
	return found;
}

/** `src/components/Chatbox.tsx`, sin el prefijo que devuelve el glob. */
function displayPath(path: string): string {
	const at = path.indexOf("src/");
	return at === -1 ? path : path.slice(at);
}

type Offence = { file: string; line: number; message: string };

/**
 * Incumplimientos del inventario en un conjunto de componentes: todo control interactivo
 * tiene que declarar una identidad del contrato, y una identidad no puede declarar dos
 * controles distintos.
 *
 * Es la guarda de RF-F43: sin ella, un control nuevo entra en el widget sin que nadie lo
 * mida, y el contrato se queda viejo solo en la siguiente modificación de estilos.
 */
function inventoryOffences(sources: Record<string, string>): Offence[] {
	const offences: Offence[] = [];
	const declared = new Map<string, string>();

	for (const [path, source] of Object.entries(sources)) {
		const file = displayPath(path);
		for (const element of interactiveElements(source)) {
			const where = `${file}:${element.line} <${element.tag}>`;
			if (element.id === null) {
				offences.push({
					file,
					line: element.line,
					message: `${where}: control interactivo sin \`${CONTROL_ATTRIBUTE}\``,
				});
				continue;
			}
			if (!KNOWN_IDS.has(element.id)) {
				offences.push({
					file,
					line: element.line,
					message: `${where}: identidad «${element.id}» fuera del contrato`,
				});
				continue;
			}
			const previous = declared.get(element.id);
			if (previous) {
				offences.push({
					file,
					line: element.line,
					message: `${where}: identidad «${element.id}» ya declarada en ${previous}`,
				});
				continue;
			}
			declared.set(element.id, where);
		}
	}

	return offences;
}

/**
 * Los componentes del widget, en **todo** `src/`, no solo en `src/components/`.
 *
 * El alcance es lo que importa: con el glob limitado a `src/components/`, un `<button>` en
 * `src/chat/components/` entraba sin vigilar y la guarda seguía en verde.
 */
const COMPONENT_SOURCES = Object.fromEntries(
	Object.entries(
		import.meta.glob("../../src/**/*.tsx", {
			query: "?raw",
			import: "default",
			eager: true,
		}) as Record<string, string>
	)
);

describe("la guarda del inventario", () => {
	it("todo control interactivo de los componentes está inventariado", () => {
		expect(inventoryOffences(COMPONENT_SOURCES)).toEqual([]);
	});

	it("muerde cuando un control no declara su identidad", () => {
		const offences = inventoryOffences({
			"src/components/Fantasma.tsx":
				'export const Fantasma = () => <button type="button">Ir</button>;',
		});
		expect(offences).toHaveLength(1);
		expect(offences[0].message).toContain("sin `data-chatbox-control`");
	});

	it("muerde con una identidad que el inventario no conoce", () => {
		const offences = inventoryOffences({
			"src/components/Fantasma.tsx":
				'export const F = () => <button data-chatbox-control="inventado">Ir</button>;',
		});
		expect(offences).toHaveLength(1);
		expect(offences[0].message).toContain("fuera del contrato");
	});

	it("muerde cuando una identidad declara dos controles", () => {
		const offences = inventoryOffences({
			"src/components/Uno.tsx":
				'export const Uno = () => <button data-chatbox-control="send">A</button>;',
			"src/components/Dos.tsx":
				'export const Dos = () => <button data-chatbox-control="send">B</button>;',
		});
		expect(offences).toHaveLength(1);
		expect(offences[0].message).toContain("ya declarada en");
	});

	it("el inventario no se queda viejo: todo control tiene su identidad en el markup", () => {
		const declared = new Set(
			Object.values(COMPONENT_SOURCES)
				.flatMap((source) => interactiveElements(source))
				.map((element) => element.id)
				.filter((id): id is string => id !== null)
		);
		expect([...CONTROL_IDS].filter((id) => !declared.has(id))).toEqual([]);
	});

	it("toda identidad exenta está declarada con su motivo", () => {
		for (const [id, reason] of Object.entries(EXEMPT)) {
			expect(reason.length, `la excepción «${id}» dice por qué se salta`).toBeGreaterThan(0);
		}
	});
});
