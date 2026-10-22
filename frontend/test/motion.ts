/**
 * Contrato de movimiento del widget (RF-F44, issue #100).
 *
 * Fuente única de las fuentes de movimiento, de sus selectores y de las media queries del
 * contrato, compartida por los dos niveles de verificación —mecanismo en jsdom y resolución
 * en Chromium— para que no pueda haber dos definiciones de «movimiento inventariado» que
 * diverjan. No es código de producción: vive con los tests.
 */

import postcss, { type AtRule, type Declaration, type Node, type Root, type Rule } from "postcss";
import { REDUCED_MOTION_QUERY } from "../src/chat/domain/motion";
import { normalizeMediaParams } from "./media-params";

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
	/** Cómo lo llama la gente: los mensajes de la guarda lo nombran. */
	name: string;
	/** De dónde sale el movimiento. */
	kind: MotionKind;
	/**
	 * El único sitio donde la fuente tiene derecho a existir: el selector CSS de una
	 * animación, el módulo donde vive la regla de un scroll.
	 */
	target: string;
};

/** El módulo donde vive la regla de scroll, y el único que puede pedir scroll suave. */
export const RULE_MODULE = "src/chat/domain/motion.ts";

/** Las fuentes de movimiento que el widget puede tener. La guarda vigila que no haya más. */
export const MOTION_SOURCES: MotionSource[] = [
	{
		id: "typing-indicator",
		name: "Indicador de escritura",
		kind: "animación CSS",
		target: TYPING_SELECTOR,
	},
	{
		id: "smooth-scroll",
		name: "Scroll suave",
		kind: "scroll de JS",
		target: RULE_MODULE,
	},
];

/** Una razón por la que la hoja de estilos viola el contrato. */
export type Violation = { reason: string };

/** El path de un módulo tal y como lo ve el inventario: `src/...`, sin el prefijo del glob. */
export const sourcePath = (path: string): string => {
	const at = path.indexOf("src/");
	return at === -1 ? path : path.slice(at);
};

/** Si el nodo vive dentro de un bloque `@media` con esa condición. */
const insideMedia = (node: Node, condition: string): boolean => {
	let current: Node | undefined = node;
	while (current) {
		const parent: Node | undefined = current.parent;
		if (!parent) return false;
		if (parent.type === "atrule") {
			const params = (parent as AtRule).params;
			if (typeof params === "string" && normalizeMediaParams(params) === condition) return true;
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

/** Los selectores de la regla a la que pertenece la declaración. */
const selectorsOf = (declaration: Declaration): string[] => {
	const parent = declaration.parent;
	if (parent && parent.type === "rule") return (parent as Rule).selectors;
	return [];
};

/** Si la declaración está en una regla con ese selector. */
const inRuleWith = (declaration: Declaration, selector: string): boolean =>
	selectorsOf(declaration).includes(selector);

/**
 * El selector sin sus pseudo-clases: `:nth-child(2)` es implementación, no identidad.
 */
const baseSelector = (selector: string): string =>
	selector.replace(/::?[a-z-]+(\([^)]*\))?/gi, "").trim();

/** Los selectores CSS donde el inventario permite declarar movimiento. */
const cssTargets = (): string[] =>
	MOTION_SOURCES.filter((source) => source.kind === "animación CSS").map((source) => source.target);

/** Los módulos donde el inventario permite pedir scroll suave. */
const jsTargets = (): string[] =>
	MOTION_SOURCES.filter((source) => source.kind === "scroll de JS").map((source) => source.target);

/**
 * El salto instantáneo de la caja de scroll, declarado dentro del contrato.
 *
 * `behavior: "auto"` delega en el `scroll-behavior` computado del elemento, así que el CSS
 * es lo que garantiza que el scroll no sea suave: si aquí no se declara, la preferencia se
 * respeta en la mitad de los caminos.
 */
const declaresInstantScroll = (root: Root): boolean => {
	let found = false;
	root.walkAtRules("media", (atRule) => {
		const params = atRule.params;
		if (typeof params !== "string") return;
		if (normalizeMediaParams(params) !== REDUCED_MOTION_QUERY) return;
		atRule.walkDecls("scroll-behavior", (declaration) => {
			if (declaration.value.trim().toLowerCase() !== "auto") return;
			if (inRuleWith(declaration, SCROLL_BOX_SELECTOR)) found = true;
		});
	});
	return found;
};

/** Si el inventario tiene una fuente de animación, la hoja la tiene que declarar. */
const declaresAnimationFor = (root: Root, selector: string): boolean => {
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
 * Función pura sobre el árbol ya parseado: la guarda la usa contra la hoja real del widget
 * —parseada una sola vez, por el módulo que la comparte con el resto de verificaciones— y el
 * test la usa contra hojas escritas a mano. Un verificador que nunca rechaza no protege
 * nada, así que cada regla tiene su entrada que la hace morder.
 *
 * La guarda es **bidireccional**: una fuente del inventario tiene que existir en la hoja
 * (inventariado → declarado) y nada puede animarse fuera del inventario (declarado →
 * inventariado). Con una sola de las dos direcciones, una animación nueva se cuela en
 * silencio.
 */
export function findMotionViolations(root: Root): Violation[] {
	const violations: Violation[] = [];

	const conditions = new Set<string>();
	root.walkAtRules("media", (atRule) => {
		const params = atRule.params;
		if (typeof params === "string") conditions.add(normalizeMediaParams(params));
	});

	if (!conditions.has(NO_PREFERENCE_QUERY)) {
		violations.push({
			reason: `falta el bloque «${NO_PREFERENCE_QUERY}», que es donde vive la animación`,
		});
	}
	if (!conditions.has(REDUCED_MOTION_QUERY)) {
		violations.push({
			reason: `falta el bloque «${REDUCED_MOTION_QUERY}», que es el contrato del movimiento reducido`,
		});
	}

	root.walkAtRules("keyframes", (atRule) => {
		if (insideMedia(atRule, NO_PREFERENCE_QUERY)) return;
		const name = atRule.params;
		violations.push({
			reason: `«@keyframes ${typeof name === "string" ? name : "sin nombre"}» fuera del bloque «${NO_PREFERENCE_QUERY}»`,
		});
	});

	root.walkDecls((declaration) => {
		const prop = declaration.prop.toLowerCase();
		const value = declaration.value.trim().toLowerCase();

		if (prop === "animation" || prop.startsWith("animation-")) {
			if (value === "none") return;
			if (!insideMedia(declaration, NO_PREFERENCE_QUERY)) {
				violations.push({
					reason: `«${declaration.prop}: ${declaration.value}» fuera del bloque «${NO_PREFERENCE_QUERY}»`,
				});
				return;
			}
			const uninventoried = selectorsOf(declaration).filter(
				(selector) => !cssTargets().includes(baseSelector(selector))
			);
			if (uninventoried.length > 0) {
				violations.push({
					reason: `la animación de «${uninventoried.join(", ")}» no está en el inventario de movimiento`,
				});
			}
			return;
		}

		if (prop === "transition" || prop.startsWith("transition-")) {
			if (value === "none") return;
			if (insideMedia(declaration, NO_PREFERENCE_QUERY)) return;
			violations.push({
				reason: `«${declaration.prop}: ${declaration.value}» fuera del bloque «${NO_PREFERENCE_QUERY}»`,
			});
			return;
		}

		if (prop === "scroll-behavior" && value === "smooth") {
			violations.push({
				reason: `«scroll-behavior: smooth» en «${selectorOf(declaration)}»: el scroll lo decide la regla de RF-F44, no el CSS`,
			});
		}
	});

	if (!declaresInstantScroll(root)) {
		violations.push({
			reason: `el bloque «${REDUCED_MOTION_QUERY}» no declara «scroll-behavior: auto» en «${SCROLL_BOX_SELECTOR}»`,
		});
	}

	for (const source of MOTION_SOURCES) {
		if (source.kind !== "animación CSS") continue;
		if (declaresAnimationFor(root, source.target)) continue;
		violations.push({
			reason: `el inventario declara «${source.name}» pero no hay ninguna animación para «${source.target}»`,
		});
	}

	return violations;
}

/**
 * Los módulos que piden un scroll suave sin que la regla del contrato lo autorice.
 *
 * Función pura sobre un mapa de fuentes: la guarda la usa contra el código real del widget y
 * el test la usa contra un mapa escrito a mano, que es lo que le da una entrada que rechaza.
 */
export function findSmoothScrollOffenders(sources: Record<string, string>): string[] {
	const allowed = new Set(jsTargets());
	return Object.entries(sources)
		.filter(([path]) => !allowed.has(sourcePath(path)))
		.filter(([, source]) => /["'`]smooth["'`]/.test(source))
		.map(([path]) => sourcePath(path));
}
