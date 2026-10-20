import { parse } from "@babel/parser";
import type { Node } from "@babel/types";
import { describe, expect, it } from "vitest";
import { strings } from "../../src/strings.es";

/**
 * Test de inventario de RF-F62 (§Enforcement): ninguna redacción de interfaz vive fuera de
 * `src/strings.es.ts`.
 *
 * El escáner recorre los archivos con copy y extrae sus literales: cadenas, plantillas sin
 * sustitución y texto JSX crudo (`<button>Nueva conversación</button>`, que es como se cuela
 * el copy en la práctica). Todo literal que no esté en la lista blanca es una redacción sin
 * centralizar. No hay heurísticas de idioma: el juicio es explícito y la lista se lee entera
 * en un vistazo.
 *
 * Límite conocido: una plantilla con interpolación (`Hola ${nombre}`) compone valores y no es
 * un literal, así que no se reporta. El copy compuesto queda fuera; el spec lo cubre con la
 * regla de que la interpolación solo existe para el contador de caracteres.
 */

// --- Alcance: los archivos con copy -----------------------------------------
//
// Los seis componentes que renderizan texto y la capa de infraestructura que compone los
// mensajes de error. `ExternalLink.tsx` y el resto de `src/chat/` quedan fuera: no llevan
// copy. El glob incorpora solo, así que un componente nuevo entra en el inventario sin tocar
// el test.
const COPY_SOURCES = {
	...import.meta.glob("../../src/components/*.tsx", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
	...import.meta.glob("../../src/chat/infrastructure/chat-errors.ts", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
} as Record<string, string>;

// --- Lista blanca -----------------------------------------------------------
//
// Literales técnicos permitidos fuera del módulo. Ninguno es texto de interfaz: son valores
// que consume el navegador o el runtime. Un grupo nuevo se declara aquí, con su motivo.

/** Clases CSS e identificadores técnicos: los que necesita el DOM para estilos y `aria-labelledby`. */
const CSS_CLASSES_AND_IDS = [
	"chatbox",
	"chatbox-title",
	"chatbox-question",
	"chatbox__badge",
	"chatbox__conversation",
	"chatbox__conversation-actions",
	"chatbox__empty",
	"chatbox__footer",
	"chatbox__header",
	"chatbox__message-author",
	"chatbox__messages",
	"chatbox__notice",
	"chatbox__status",
];

/**
 * Valores técnicos de atributo y ARIA: `lang`, `role`, `aria-live`, `aria-atomic` y `type`.
 * `off` es el valor con el que el contador de caracteres se declara presente pero mudo
 * (RF-F41): sigue siendo texto visible y no interrumpe el anuncio de la región de estado.
 */
const ATTRIBUTE_VALUES = ["es", "true", "polite", "off", "status", "submit", "button"];

/** Teclado: nombres de tecla de `KeyboardEvent.key`. */
const KEYBOARD_KEYS = ["Enter", "Escape"];

/** Scroll y CSSOM: `scrollTo({ behavior })` y los estilos del autogrow del textarea. */
const SCROLL_AND_CSSOM_VALUES = ["smooth", "auto", "hidden"];

/** Media queries de accesibilidad. Valores compuestos: pueden llevar espacios. */
const MEDIA_QUERIES = ["(prefers-reduced-motion: reduce)"];

/** Estados de turno: conjunto cerrado de `chat-reducer`, no redacción. */
const TURN_STATES = ["idle", "connecting", "generating", "streaming", "error", "aborted"];

/**
 * Discriminantes de `TurnEnd` (RF-F41) que no son estados de turno: conjunto cerrado de
 * `useChatStream`, no redacción. `aborted` ya está en `TURN_STATES`.
 */
const TURN_END_KINDS = ["completed", "failed"];

/** Roles de mensaje: conjunto cerrado de `chat/types`, indexado en `strings.messages.author`. */
const MESSAGE_ROLES = ["user", "assistant"];

/** Type guards de `chat-errors.ts`. */
const TYPE_GUARDS = ["undefined", "AbortError"];

/**
 * Códigos de error: son claves de `strings.errors`, no copy. Se derivan del módulo en vez de
 * escribirse aquí, para que quitar una clave haga fallar este inventario y no solo el contrato.
 */
const ERROR_CODES = Object.keys(strings.errors);

const ALLOWED = new Set([
	...CSS_CLASSES_AND_IDS,
	...ATTRIBUTE_VALUES,
	...KEYBOARD_KEYS,
	...SCROLL_AND_CSSOM_VALUES,
	...MEDIA_QUERIES,
	...TURN_STATES,
	...TURN_END_KINDS,
	...MESSAGE_ROLES,
	...TYPE_GUARDS,
	...ERROR_CODES,
]);

// --- Escáner ----------------------------------------------------------------
//
// Se parsea el archivo en vez de buscar literales con expresiones regulares: `useRef<T>(x)`
// parece una etiqueta JSX y el texto JSX solo se ve si el parser distingue nodos. Un escáner
// aproximado passaría en falso justo cuando debe morder.

type DetectedString = { file: string; line: number; value: string; kind: "cadena" | "texto JSX" };

/**
 * Nodo del AST en forma estructural: se leen `type`, `loc` y `value`, y se recorren todas las
 * claves hijas. Ojo con `value`: en `ObjectProperty` no es el valor de un literal sino el nodo de
 * la derecha, así que se recorre como cualquier otra clave en vez de apartarse con el resto.
 */
type AstNode = Record<string, unknown> & {
	type?: string;
	loc?: { start: { line: number } };
	value?: unknown;
};

/**
 * Nombres de nodo tipados contra el propio parser: un nombre que no existe es un error de
 * compilación, no una rama muerta silenciosa.
 */
type NodeType = Node["type"];

/** Nodos cuyo `source` es una ruta de módulo, no texto de interfaz. */
const MODULE_REFERENCE_TYPES = new Set<NodeType>([
	"ImportDeclaration",
	"ExportNamedDeclaration",
	"ExportAllDeclaration",
]);

/**
 * Valores de la lista blanca que aún no aparecen en los archivos con copy. `user`: el spec
 * declara el conjunto de roles completo aunque hoy el código solo compare con `assistant`.
 * `idle`: sigue siendo un estado real de `chat-reducer`, pero desde RF-F41 ningún componente
 * lo nombra —la región de estado se deduce de eventos, no del estado— y el conjunto de
 * estados no se recorta porque el reducer lo sigue usando.
 */
const NOT_YET_IN_USE = ["user", "idle"];

/** `src/components/Chatbox.tsx`, sin el prefijo que devuelve el glob. */
function displayPath(path: string): string {
	const at = path.indexOf("src/");
	return at === -1 ? path : path.slice(at);
}

/**
 * Texto que aporta un nodo, o `null` si no aporta ninguno.
 *
 * Babel no emite `NoSubstitutionTemplateLiteral` (nodo de ESTree): una plantilla sin
 * interpolación sigue siendo un `TemplateLiteral` con un único segmento. Una plantilla con
 * `${…}` compone valores, así que no es un literal y no se reporta.
 */
function textOf(
	node: AstNode,
	type: string
): { value: string; kind: DetectedString["kind"] } | null {
	if (type === "StringLiteral" || type === "JSXText") {
		if (typeof node.value !== "string") return null;
		return { value: node.value, kind: type === "JSXText" ? "texto JSX" : "cadena" };
	}
	if (type === "TemplateLiteral") {
		const { expressions, quasis } = node;
		if (!Array.isArray(expressions) || expressions.length > 0) return null;
		if (!Array.isArray(quasis) || quasis.length !== 1) return null;
		const cooked = (quasis[0] as { value?: { cooked?: unknown } } | undefined)?.value?.cooked;
		return typeof cooked === "string" ? { value: cooked, kind: "cadena" } : null;
	}
	return null;
}

function collectLiterals(path: string, source: string): DetectedString[] {
	const file = displayPath(path);
	const plugins: ("typescript" | "jsx")[] = path.endsWith(".tsx")
		? ["typescript", "jsx"]
		: ["typescript"];
	const ast = parse(source, { sourceType: "module", plugins }) as unknown as AstNode;
	const found: DetectedString[] = [];

	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const entry of node) visit(entry);
			return;
		}
		if (node === null || typeof node !== "object") return;
		const { type, loc } = node as AstNode;
		if (typeof type !== "string") return;

		// El nombre del nodo se compara contra los sets tipados; un nombre que no es de Babel
		// no pasa el typecheck, pero el AST sigue siendo dinámico en tiempo de ejecución.
		const nodeType = type as NodeType;
		const moduleReference = MODULE_REFERENCE_TYPES.has(nodeType);
		const text = moduleReference ? null : textOf(node as AstNode, type);
		if (text) {
			found.push({
				file,
				line: loc?.start.line ?? 0,
				value: text.value.trim(),
				kind: text.kind,
			});
		}

		for (const [key, child] of Object.entries(node)) {
			if (key === "type" || key === "loc") continue;
			if (moduleReference && key === "source") continue;
			visit(child);
		}
	};

	visit(ast);
	return found;
}

// --- Inventario -------------------------------------------------------------

const LITERALS = Object.entries(COPY_SOURCES).flatMap(([path, source]) =>
	collectLiterals(path, source)
);

/** Un literal vacío es solo espaciado de JSX o estado inicial; no es redacción. */
function isAllowed(detectedString: DetectedString): boolean {
	if (detectedString.value === "") return true;
	return ALLOWED.has(detectedString.value);
}

function describeViolations(violations: DetectedString[]): string {
	return [
		"Texto de interfaz fuera de `src/strings.es.ts`:",
		...violations.map(
			(literal) =>
				`  ${literal.file}:${literal.line}  ${literal.kind}  ${JSON.stringify(literal.value)}`
		),
		"Muévelo al módulo de textos; si es un valor técnico, decláralo en la lista blanca de este test.",
	].join("\n");
}

describe("literal inventory outside the strings module (RF-F62)", () => {
	it("scans the files that carry copy", () => {
		// Un glob mal escrito dejaría el inventario vacío y el test pasaría en falso.
		const files = Object.keys(COPY_SOURCES).map(displayPath).sort();
		expect(files.length).toBeGreaterThan(0);
		expect(files.filter((file) => !file.startsWith("src/components/"))).toEqual([
			"src/chat/infrastructure/chat-errors.ts",
		]);
	});

	it("extracts every way copy can slip in", () => {
		const snippet = [
			"const notice = `Unapproved interface copy`;",
			'export function Button() { return <button type="button">Texto JSX no aprobado</button>; }',
		].join("\n");
		const values = collectLiterals("probe.tsx", snippet).map(
			(detectedString) => detectedString.value
		);
		expect(values).toEqual(["Unapproved interface copy", "button", "Texto JSX no aprobado"]);
	});

	it("rejects interface copy while accepting technical literals in a probe", () => {
		const snippet = [
			"const notice = `Unapproved interface copy`;",
			'export function Button() { return <button type="button">Texto JSX no aprobado</button>; }',
		].join("\n");
		const probeLiterals = collectLiterals("probe.tsx", snippet);
		const violations = probeLiterals.filter((detectedString) => !isAllowed(detectedString));

		expect(violations.map((detectedString) => detectedString.value)).toEqual([
			"Unapproved interface copy",
			"Texto JSX no aprobado",
		]);
		expect(violations, describeViolations(violations)).not.toEqual([]);
		expect(probeLiterals.filter(isAllowed).map((detectedString) => detectedString.value)).toContain(
			"button"
		);
	});

	it("keeps no interface copy outside the module", () => {
		const violations = LITERALS.filter((literal) => !isAllowed(literal));
		expect(violations, describeViolations(violations)).toEqual([]);
	});

	it("keeps the whitelist free of dead entries", () => {
		// Una entrada que no aparece en ningún archivo no justifica su sitio: o es una errata,
		// o es copy que alguien metió para callar al escáner.
		const seen = new Set(LITERALS.map((literal) => literal.value));
		const dead = [...ALLOWED].filter(
			(value) => !seen.has(value) && !NOT_YET_IN_USE.includes(value)
		);
		expect(
			dead,
			"Every whitelisted value must be a literal the scanned files really contain"
		).toEqual([]);
	});
});
