/**
 * Axe sobre el widget real, en Chromium.
 *
 * Una sola fuente para dos cosas que antes estaban en cuatro sitios: **qué se audita** (el
 * nivel de reglas) y **dónde** (la raíz del escaneo). Cuatro specs copiaban el mismo bloque
 * `axe.run` con dos conjuntos de reglas distintos, así que cada copia era una definición
 * más de qué se audita, y el más amplio no era el que se usaba en todas partes.
 *
 * Ver `docs/decisions/005-live-region-verification.md` y
 * `docs/specs/frontend/RF-F41-pasada-axe.md`.
 */

import type { Page } from "@playwright/test";
import axe from "axe-core";

/**
 * El nivel auditado: WCAG 2.0, 2.1 y 2.2, niveles A y AA.
 *
 * Es el conjunto más amplio de los que se usaban: el escaneo de contraste ya llegaba a 2.2
 * y los demás se quedaban en 2.0. Un solo nivel para todo el widget.
 */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

/** Una violación, reducida a lo que hace falta para entenderla y localizarla. */
export type AxeViolation = {
	/** El identificador de la regla que falló (por ejemplo, `image-alt`). */
	id: string;
	/** La ayuda de la regla, en texto. */
	help: string;
	/** Los selectores de los nodos que la violan. */
	target: string[];
};

/**
 * Las violaciones de axe sobre el widget, en el estado en que esté la página.
 *
 * El escaneo se limita a la raíz del widget: es lo que se distribuye y lo que el sitio
 * host embebe. Las reglas de página —el `lang` del documento, un único `h1`— no son
 * responsabilidad del widget.
 */
export async function axeViolations(page: Page): Promise<AxeViolation[]> {
	await page.addScriptTag({ content: axe.source });

	return page.evaluate(
		async (tags) => {
			const api = (window as unknown as Window & { axe: typeof axe }).axe;
			const results = await api.run(document.querySelector(".chatbox") as HTMLElement, {
				runOnly: { type: "tag", values: tags },
			});

			return results.violations.map((violation) => ({
				id: violation.id,
				help: violation.help,
				target: violation.nodes.map((node) =>
					node.target
						.map((selector) => (Array.isArray(selector) ? selector.join(" ") : selector))
						.join(", ")
				),
			}));
		},
		[...AXE_TAGS]
	);
}
