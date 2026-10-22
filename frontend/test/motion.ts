/**
 * Contrato de movimiento del widget (RF-F44, issue #100).
 *
 * Fuente única de las fuentes de movimiento, de sus selectores y de las media queries del
 * contrato, compartida por los dos niveles de verificación —mecanismo en jsdom y resolución
 * en Chromium— para que no pueda haber dos definiciones de «movimiento inventariado» que
 * diverjan. No es código de producción: vive con los tests.
 */

import postcss, { type AtRule, type Declaration, type Node, type Rule } from "postcss";
import { REDUCED_MOTION_QUERY } from "../src/chat/domain/motion";

/** La media query que abre la puerta al movimiento: la animación vive dentro de ella. */
export const NO_PREFERENCE_QUERY = "(prefers-reduced-motion: no-preference)";

/** La caja de scroll del widget: el único `overflow-y: auto` del chatbox. */
export const SCROLL_BOX_SELECTOR = ".chatbox__conversation";

/** Los tres puntos del indicador de escritura. */
export const TYPING_SELECTOR = ".chatbox__typing-dot";

export type MotionKind = "animación CSS" | "scroll de JS";

export type MotionSource = {
	/** Identidad: con la que la fuente se declara en el inventario. */
	id: string;
	/** Cómo lo llama la gente, para que un informe se lea sin abrir el inventario. */
	name: string;
	/** El selector con el que el nivel de resolución la encuentra en el DOM. */
	selector: string;
	/** De dónde sale el movimiento. */
	kind: MotionKind;
};

/** Las fuentes de movimiento que el widget puede tener. La guarda vigila que no haya más. */
export const MOTION_SOURCES: MotionSource[] = [
	{
		id: "typing-indicator",
		name: "Indicador de escritura",
		selector: TYPING_SELECTOR,
		kind: "animación CSS",
	},
	{
		id: "smooth-scroll",
		name: "Scroll suave",
		selector: SCROLL_BOX_SELECTOR,
		kind: "scroll de JS",
	},
];

export const MOTION_SOURCE_IDS: ReadonlySet<string> = new Set(
	MOTION_SOURCES.map((source) => source.id)
);

/** Una razón por la que la hoja de estilos viola el contrato. */
export type Violation = { reason: string };

const normalize = (params: string): string => params.replace(/\s+/g, " ").trim();

/** Si el nodo vive dentro de un bloque `@media` con esa condición. */
const insideMedia = (node: Node, condition: string): boolean => {
	let current: Node | undefined = node;
	while (current) {
		const parent: Node | undefined = current.parent;
		if (!parent) return false;
		if (parent.type === "atrule") {
			const params = (parent as AtRule).params;
			if (typeof params === "string" && normalize(params) === condition) return true;
		}
		current = parent;
	}
	return false;
};

/** El selector de la regla a la que pertenece la declaración. */
const selectorOf = (declaration: Declaration): string => {
	const parent = declaration.parent;
	if (parent && parent.type === "rule") return (parent as Rule).selector;
	return "";
};

/** Si la declaración está en una regla con ese selector. */
const inRuleWith = (declaration: Declaration, selector: string): boolean => {
	const parent = declaration.parent;
	if (parent?.type !== "rule") return false;
	return (parent as Rule).selectors.includes(selector);
};

/**
 * El salto instantáneo de la caja de scroll, declarado dentro del contrato.
 *
 * `behavior: "auto"` delega en el `scroll-behavior` computado del elemento, así que el CSS
 * es lo que garantiza que el scroll no sea suave: si aquí no se declara, la preferencia se
 * respeta en la mitad de los caminos.
 */
const declaresInstantScroll = (root: postcss.Root): boolean => {
	let found = false;
	root.walkAtRules("media", (atRule) => {
		const params = atRule.params;
		if (typeof params !== "string" || normalize(params) !== REDUCED_MOTION_QUERY) return;
		atRule.walkDecls("scroll-behavior", (declaration) => {
			if (declaration.value.trim().toLowerCase() !== "auto") return;
			if (inRuleWith(declaration, SCROLL_BOX_SELECTOR)) found = true;
		});
	});
	return found;
};

/** Si el inventario tiene una fuente de animación, la hoja la tiene que declarar. */
const declaresAnimationFor = (root: postcss.Root, selector: string): boolean => {
	let found = false;
	root.walkDecls((declaration) => {
		if (found) return;
		if (declaration.prop.toLowerCase() !== "animation") return;
		if (!insideMedia(declaration, NO_PREFERENCE_QUERY)) return;
		if (inRuleWith(declaration, selector)) found = true;
	});
	return found;
};

/**
 * Las violaciones del contrato de movimiento en una hoja de estilos.
 *
 * Función pura sobre el texto: la guarda la usa contra la hoja real del widget y el test la
 * usa contra hojas escritas a mano. Un verificador que nunca rechaza no protege nada, así
 * que cada regla tiene su entrada que la hace morder.
 */
export function findMotionViolations(css: string): Violation[] {
	const root = postcss.parse(css);
	const violations: Violation[] = [];

	const conditions = new Set<string>();
	root.walkAtRules("media", (atRule) => {
		const params = atRule.params;
		if (typeof params === "string") conditions.add(normalize(params));
	});

	if (!conditions.has(NO_PREFERENCE_QUERY)) {
		violations.push({
			reason: `falta el bloque \`${NO_PREFERENCE_QUERY}\`, que es donde vive la animación`,
		});
	}
	if (!conditions.has(REDUCED_MOTION_QUERY)) {
		violations.push({
			reason: `falta el bloque \`${REDUCED_MOTION_QUERY}\`, que es el contrato del movimiento reducido`,
		});
	}

	root.walkAtRules("keyframes", (atRule) => {
		if (insideMedia(atRule, NO_PREFERENCE_QUERY)) return;
		const name = atRule.params;
		violations.push({
			reason: `\`@keyframes ${typeof name === "string" ? name : "sin nombre"}\` fuera del bloque \`${NO_PREFERENCE_QUERY}\``,
		});
	});

	root.walkDecls((declaration) => {
		const prop = declaration.prop.toLowerCase();
		const value = declaration.value.trim().toLowerCase();

		if (prop === "animation" || prop.startsWith("animation-")) {
			if (value === "none") return;
			if (insideMedia(declaration, NO_PREFERENCE_QUERY)) return;
			violations.push({
				reason: `\`${declaration.prop}: ${declaration.value}\` fuera del bloque \`${NO_PREFERENCE_QUERY}\``,
			});
			return;
		}

		if (prop === "transition" || prop.startsWith("transition-")) {
			if (value === "none") return;
			if (insideMedia(declaration, NO_PREFERENCE_QUERY)) return;
			violations.push({
				reason: `\`${declaration.prop}: ${declaration.value}\` fuera del bloque \`${NO_PREFERENCE_QUERY}\``,
			});
			return;
		}

		if (prop === "scroll-behavior" && value === "smooth") {
			violations.push({
				reason: `\`scroll-behavior: smooth\` en \`${selectorOf(declaration)}\`: el scroll lo decide la regla de RF-F44, no el CSS`,
			});
		}
	});

	if (!declaresInstantScroll(root)) {
		violations.push({
			reason: `el bloque \`${REDUCED_MOTION_QUERY}\` no declara \`scroll-behavior: auto\` en \`${SCROLL_BOX_SELECTOR}\``,
		});
	}

	for (const source of MOTION_SOURCES) {
		if (source.kind !== "animación CSS") continue;
		if (declaresAnimationFor(root, source.selector)) continue;
		violations.push({
			reason: `el inventario declara \`${source.id}\` pero no hay ninguna animación para \`${source.selector}\``,
		});
	}

	return violations;
}
