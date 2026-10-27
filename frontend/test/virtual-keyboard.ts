/**
 * Contrato de teclado virtual del widget (RF-F51).
 *
 * Fuente única del nombre de la variable que publica la franja que tapa el teclado, del
 * valor de reserva que tiene que tener y de la guarda que vigila la hoja de estilos,
 * compartida por los dos niveles de verificación —mecanismo en jsdom y resolución en
 * Chromium— para que no pueda haber dos definiciones de «franja del teclado» que diverjan. No
 * es código de producción: vive con los tests.
 *
 * Las reglas de cálculo —zona visible, franja que tapa el teclado, anclaje inferior— viven
 * en `src/chat/domain/visual-viewport.ts`, porque el widget también las necesita.
 */

import type { Declaration, Root, Rule } from "postcss";
import { ROOT_SELECTOR } from "./viewport";

/**
 * La clase raíz del widget, con su frontera de palabra.
 *
 * `.chatbox__footer` no es la raíz: el guion sigue al nombre y la frontera lo deja fuera.
 */
const ROOT_CLASS = /\.chatbox(?![\w-])/;

/**
 * El último compuesto de un selector: la parte que nombra al elemento.
 *
 * `.chatbox` es un compuesto; `.chatbox__footer`, otro; `[data-theme="dark"] .chatbox`,
 * dos, y el último es el que nombra al elemento.
 */
const lastCompound = (selector: string): string =>
	selector
		.split(/[\s>+~]+/)
		.filter(Boolean)
		.pop() ?? "";

/**
 * Las reglas que alcanzan a la raíz del widget.
 *
 * No basta con que el selector sea exactamente `.chatbox`: una regla agrupada —`.chatbox,
 * .chatbox *::before`— o una que lo nombre con más clases también la alcanzan. Lo que
 * decide es el último compuesto del selector: si nombra la clase raíz, el selector apunta
 * a la raíz.
 */
const rulesTargetingRoot = (root: Root): Rule[] => {
	const found: Rule[] = [];
	root.walkRules((rule) => {
		if (rule.selectors.some((selector) => ROOT_CLASS.test(lastCompound(selector)))) {
			found.push(rule);
		}
	});
	return found;
};

/**
 * La variable CSS con la que el widget publica la franja que tapa el teclado.
 *
 * El componente la escribe en la raíz y el CSS la lee: sin teclado vale cero y no se
 * reserva nada.
 */
export const KEYBOARD_INSET_PROPERTY = "--chatbox-keyboard-inset";

/**
 * El valor de reserva de la variable.
 *
 * Sin teclado no se reserva nada: un `var()` sin reserva caería en `unset` y el pie del
 * widget se quedaría sin su sitio.
 */
export const KEYBOARD_INSET_FALLBACK = "0px";

/** La declaración que la raíz del widget tiene que hacer para reservar la franja. */
export const EXPECTED_ROOT_PADDING = `var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK})`;

/** Una razón por la que la hoja de estilos viola el contrato. */
export type Violation = { reason: string };

/** Las unidades de viewport que el contrato rechaza en la franja del teclado. */
const VIEWPORT_UNITS = /(?<![a-z])(vh|svh|lvh|dvh)(?![a-z])/i;

/**
 * Las propiedades que declaran el padding inferior de la raíz.
 *
 * La física y la lógica: `padding-block-end` es el padding inferior en un modo de escritura
 * horizontal, y una regla que lo declarara dejaría la franja del teclado a cero sin que
 * ninguna regla física la tocara.
 */
const BOTTOM_PADDING_PROPERTIES = ["padding-bottom", "padding-block-end"];

/**
 * Los atajos que tocan el padding inferior de la raíz.
 *
 * Los dos se comen la franja reservada: `padding` la pone a cero y `padding-block` también.
 */
const PADDING_SHORTHANDS = ["padding", "padding-block"];

/**
 * Las violaciones del contrato de teclado virtual en una hoja de estilos.
 *
 * Función pura sobre el árbol ya parseado: la guarda la usa contra la hoja real del widget
 * —parseada una sola vez, por el módulo que la comparte con el resto de verificaciones— y el
 * test la usa contra hojas escritas a mano. Un verificador que nunca rechaza no protege
 * nada, así que cada regla tiene su entrada que la hace morder.
 */
export function findKeyboardViolations(root: Root): Violation[] {
	const violations: Violation[] = [];

	// Todas las reglas que alcanzan a la raíz, incluidas las agrupadas y las anidadas: una
	// regla posterior que volviera a declarar el padding ganaría por orden de cascada y
	// dejaría el widget sin la franja reservada.
	const rules = rulesTargetingRoot(root);

	const paddings = rules.flatMap((rule) =>
		rule.nodes
			.filter(
				(node): node is Declaration =>
					node.type === "decl" && BOTTOM_PADDING_PROPERTIES.includes(node.prop.toLowerCase())
			)
			.map((node) => ({
				property: node.prop.toLowerCase(),
				value: node.value.trim(),
			}))
	);

	if (paddings.length === 0) {
		violations.push({
			reason: `«${ROOT_SELECTOR}» no reserva la franja que tapa el teclado virtual`,
		});
	} else {
		const effective = paddings[paddings.length - 1];

		if (effective.value !== EXPECTED_ROOT_PADDING) {
			violations.push({
				reason: `el padding inferior de «${ROOT_SELECTOR}» no reserva la franja del teclado: «${effective.value}»`,
			});
		}

		if (paddings.length > 1) {
			violations.push({
				reason: `el padding inferior de «${ROOT_SELECTOR}» lo declara más de una regla: ${paddings
					.map((padding) => `«${padding.property}: ${padding.value}»`)
					.join(", ")}`,
			});
		}

		if (/env\(\s*safe-area-inset/i.test(effective.value)) {
			violations.push({
				reason: `el padding inferior de «${ROOT_SELECTOR}» lee una safe area: la safe area va en las regiones (RF-F50)`,
			});
		}

		if (VIEWPORT_UNITS.test(effective.value)) {
			violations.push({
				reason: `el padding inferior de «${ROOT_SELECTOR}» usa una unidad de viewport: la franja se mide en tiempo de ejecución, no se declara`,
			});
		}
	}

	// Los atajos volverían a poner el padding inferior a cero y se comerían la franja
	// reservada.
	for (const rule of rules) {
		for (const node of rule.nodes) {
			if (node.type !== "decl") continue;
			if (!PADDING_SHORTHANDS.includes(node.prop.toLowerCase())) continue;
			violations.push({
				reason: `«${rule.selector}» declara el atajo «${node.prop.toLowerCase()}»: se comería la franja que reserva el teclado`,
			});
		}
	}

	return violations;
}
