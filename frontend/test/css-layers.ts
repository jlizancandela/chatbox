/**
 * Lectura de las capas de la hoja de estilos del widget.
 *
 * Compartido por la verificación del theming (RF-F61) y la del contrato de contraste
 * (RF-F42): las dos necesitan leer los mismos tokens y el mismo orden de capas, y duplicar
 * el parser haría que una cambio en la hoja se interpretara de dos maneras.
 */

import postcss, { type AtRule, type Rule } from "postcss";
import css from "../src/components/Chatbox.css?raw";
import { declarationsOf } from "./css-declarations";
import { normalizeMediaParams } from "./media-params";

export const cssSource = css;

export const styles = postcss.parse(css);

export { declarationsOf };

export const tokensOf = (rule: Rule): Record<string, string> =>
	Object.fromEntries(
		Object.entries(declarationsOf(rule)).filter(([prop]) => prop.startsWith("--chatbox-color-"))
	);

/** Busca una regla por selector entre las de primer nivel. */
export const topLevelRule = (selector: string): Rule => {
	const rule = styles.nodes.find(
		(node): node is Rule => node.type === "rule" && node.selectors.includes(selector)
	);
	if (!rule) throw new Error(`Falta la regla de primer nivel: ${selector}`);
	return rule;
};

/** La condición de una media query, normalizada: los espacios no son parte del nombre. */
export const mediaRule = (condition: string): AtRule => {
	const media = styles.nodes.find(
		(node): node is AtRule =>
			node.type === "atrule" &&
			node.name === "media" &&
			normalizeMediaParams(node.params) === condition
	);
	if (!media) throw new Error(`Falta la media query: ${condition}`);
	return media;
};

/** Busca una regla por selector dentro de un contenedor, sin depender de los espacios. */
export const ruleInside = (container: AtRule, selector: string): Rule => {
	const rule = ruleWith(container, selector);
	if (!rule) throw new Error(`Falta la regla "${selector}"`);
	return rule;
};

export const ruleWith = (container: AtRule, selector: string): Rule | undefined =>
	(container.nodes ?? []).find(
		(node): node is Rule => node.type === "rule" && node.selectors.includes(selector)
	);

/** Desplazamiento en el código fuente: el orden de las capas se decide ahí. */
export const offsetOf = (rule: Rule): number => {
	const offset = rule.source?.start?.offset;
	if (offset === undefined) throw new Error("Falta el desplazamiento en el código fuente");
	return offset;
};
