/**
 * Lectura de las declaraciones de una hoja, sin la hoja.
 *
 * Vive aparte de `css-layers.ts` porque ese módulo importa el archivo CSS del widget —con
 * la consulta `?raw` de Vite— y el contrato de viewport también lo usan los tests de
 * navegador, que no pasan por Vite. La parte que lee declaraciones no necesita el archivo:
 * duplicarla haría que un cambio en la hoja se interpretara de dos maneras.
 */

import type { Root, Rule } from "postcss";

/** Las declaraciones de una regla, por propiedad. */
export const declarationsOf = (rule: Rule): Record<string, string> =>
	Object.fromEntries(
		rule.nodes
			.filter((node) => node.type === "decl")
			.map((node) => [node.prop, (node as { value: string }).value])
	);

/**
 * La regla que declara exactamente ese selector, y solo ese.
 *
 * Exacto y único a propósito: una regla agrupada —`.chatbox textarea, .chatbox button`—
 * declara el selector entre otros, y lo que se busca es la regla que lo governa en
 * solitario.
 *
 * Se buscan también dentro de los `@media`: una regla anidada que vuelva a declarar lo
 * que la de primer nivel declara gana en su contexto, y la guarda tiene que verla.
 */
export const ruleFor = (root: Root, selector: string): Rule | undefined => {
	let found: Rule | undefined;
	root.walkRules((rule) => {
		if (found) return;
		if (rule.selectors.length === 1 && rule.selectors[0] === selector) found = rule;
	});
	return found;
};

/** Las reglas que apuntan a ese selector, en orden de cascada, anidadas o no. */
export const rulesWithSelector = (root: Root, selector: string): Rule[] => {
	const found: Rule[] = [];
	root.walkRules((rule) => {
		if (rule.selectors.includes(selector)) found.push(rule);
	});
	return found;
};
