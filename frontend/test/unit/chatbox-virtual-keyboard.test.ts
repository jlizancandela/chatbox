/**
 * RF-F51 — el contrato de teclado virtual del widget (issue #119).
 *
 * Nivel de verificación: **mecanismo**. Afirma que la raíz del widget reserva la franja que
 * tapa el teclado virtual, con la variable que publica el componente y con su valor de
 * reserva. El valor resuelto lo verifica la suite de navegador
 * (`test/browser/virtual-keyboard.spec.ts`).
 */

import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { declarationsOf, ruleFor } from "../css-declarations";
import { styles } from "../css-layers";
import { ROOT_SELECTOR } from "../viewport";
import {
	EXPECTED_ROOT_PADDING,
	findKeyboardViolations,
	KEYBOARD_INSET_FALLBACK,
	KEYBOARD_INSET_PROPERTY,
} from "../virtual-keyboard";

/** Las razones por las que una hoja viola el contrato. */
const reasonsOf = (source: string): string[] =>
	findKeyboardViolations(postcss.parse(source)).map((violation) => violation.reason);

/**
 * Una hoja que cumple el contrato entero.
 *
 * Cada entrada que rechaza parte de aquí y rompe un punto: si la referencia no cumpliera, el
 * resto de las entradas no probarían nada.
 */
const COMPLIANT = `
.chatbox {
	height: 100%;
	max-height: 100dvh;
	padding-bottom: var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK});
}
`;

// --- La hoja real del widget ---------------------------------------------------

describe("la hoja real del widget", () => {
	it("no viola el contrato de teclado virtual", () => {
		expect(findKeyboardViolations(styles)).toEqual([]);
	});

	it("la raíz reserva la franja que tapa el teclado", () => {
		const rule = ruleFor(styles, ROOT_SELECTOR);
		expect(rule).toBeDefined();
		const padding = declarationsOf(rule as NonNullable<typeof rule>)["padding-bottom"];
		expect(padding).toBe(EXPECTED_ROOT_PADDING);
	});
});

// --- La guarda muerde ----------------------------------------------------------

describe("la guarda del contrato", () => {
	it("la hoja de referencia cumple el contrato", () => {
		expect(reasonsOf(COMPLIANT)).toEqual([]);
	});

	it("rechaza una raíz que no reserva la franja", () => {
		const reasons = reasonsOf(COMPLIANT.replace(/padding-bottom:[^;]+;/, ""));
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no reserva la franja");
	});

	it("rechaza una franja con un valor fijo", () => {
		// La franja se mide en tiempo de ejecución: un valor fijo en la hoja significaría
		// que el widget reserva siempre la misma franja, con teclado o sin él.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				`padding-bottom: var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK});`,
				"padding-bottom: 300px;"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no reserva la franja del teclado");
	});

	it("rechaza una franja sin valor de reserva", () => {
		// Sin reserva, un `var()` inválido dejaría el pie del widget sin su sitio.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				`var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK})`,
				`var(${KEYBOARD_INSET_PROPERTY})`
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no reserva la franja del teclado");
	});

	it("rechaza una franja que lee una safe area", () => {
		// La safe area la publica el navegador como `env()` y va en las regiones (RF-F50);
		// la franja del teclado se mide y no se declara.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				`padding-bottom: var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK});`,
				"padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("lee una safe area");
	});

	it("rechaza una franja declarada en unidades de viewport", () => {
		// `dvh` mide el viewport de layout, que el teclado virtual no encoge: la franja
		// saldría cero y el teclado taparía el campo de texto.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				`padding-bottom: var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK});`,
				"padding-bottom: 100dvh;"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("unidad de viewport");
	});

	it("rechaza una regla posterior que vuelve a declarar la franja", () => {
		// Una regla más específica ganaría por orden de cascada y dejaría el widget sin
		// la franja reservada sin que ninguna de las dos capas se entere.
		const reasons = reasonsOf(`${COMPLIANT}\n.chatbox { padding-bottom: 0; }`);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("más de una regla");
	});

	it("rechaza una regla dentro de un @media que vuelve a declarar la franja", () => {
		const reasons = reasonsOf(
			`${COMPLIANT}\n@media (min-width: 600px) { .chatbox { padding-bottom: 0; } }`
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("más de una regla");
	});

	it("rechaza una regla que alcanza la raíz por otro camino", () => {
		// La raíz también la alcanzan las reglas que la nombran con más clases o a través
		// de un selector del sitio host: una de ellas volvería a declarar el padding y
		// ganaría por orden de cascada.
		const themed = reasonsOf(`${COMPLIANT}\n[data-theme="dark"] .chatbox { padding-bottom: 0; }`);
		expect(themed.length).toBeGreaterThan(0);
		expect(themed.join(" | ")).toContain("más de una regla");

		const compounded = reasonsOf(`${COMPLIANT}\n.chatbox.chatbox--flotante { padding-bottom: 0; }`);
		expect(compounded.length).toBeGreaterThan(0);
		expect(compounded.join(" | ")).toContain("más de una regla");
	});

	it("rechaza el atajo `padding`, que se comería la franja", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				`padding-bottom: var(${KEYBOARD_INSET_PROPERTY}, ${KEYBOARD_INSET_FALLBACK});`,
				"padding: 0;"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("atajo «padding»");
	});
});
