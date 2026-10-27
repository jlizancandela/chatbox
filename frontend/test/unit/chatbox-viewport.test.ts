/**
 * RF-F50 — el contrato de viewport móvil del widget.
 *
 * Nivel de verificación: **mecanismo**. Afirma que la hoja de estilos dimensiona la altura
 * con la unidad del viewport dinámico, que separa el contenido de las safe areas sin perder
 * su padding base, y que el campo de texto declara un suelo de tamaño de fuente que no
 * depende de la raíz del sitio host. El valor resuelto lo verifica la suite de navegador
 * (`test/browser/viewport.spec.ts`).
 */

import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { declarationsOf, ruleFor } from "../css-declarations";
import { styles } from "../css-layers";
import {
	DYNAMIC_VIEWPORT_UNIT,
	FONT_SIZE_FLOOR_PX,
	findViewportViolations,
	parseFontSize,
	parseSafeAreaPadding,
	SAFE_AREAS,
} from "../viewport";

/** Las razones por las que una hoja viola el contrato. */
const reasonsOf = (source: string): string[] =>
	findViewportViolations(postcss.parse(source)).map((violation) => violation.reason);

/**
 * Una hoja que cumple el contrato entero.
 *
 * Cada entrada que rechaza parte de aquí y rompe un punto: si la referencia no cumpliera,
 * el resto de las entradas no probarían nada.
 */
const COMPLIANT = `
.chatbox { height: 100%; max-height: 100dvh; }
.chatbox__header {
	padding: 0.75rem 1rem;
	padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
.chatbox__conversation {
	padding: 1rem;
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
.chatbox__footer {
	padding: 0.75rem 1rem;
	padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
	padding-left: max(1rem, env(safe-area-inset-left, 0px));
	padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
.chatbox textarea { font-size: max(1rem, 16px); }
`;

// --- La hoja real del widget ---------------------------------------------------

describe("la hoja real del widget", () => {
	it("no viola el contrato de viewport móvil", () => {
		expect(findViewportViolations(styles)).toEqual([]);
	});

	it("la raíz declara el tope de altura en la unidad del viewport dinámico", () => {
		const root = ruleFor(styles, ".chatbox");
		expect(root).toBeDefined();
		expect(declarationsOf(root as NonNullable<typeof root>)["max-height"]).toBe("100dvh");
	});

	it.each(SAFE_AREAS)("«$region» separa el borde «$edge» de la pantalla", (area) => {
		const rule = ruleFor(styles, area.region);
		expect(rule, area.region).toBeDefined();
		const padding = declarationsOf(rule as NonNullable<typeof rule>)[`padding-${area.edge}`];
		expect(padding, `${area.region} · ${area.edge}`).toBeDefined();
		const parsed = parseSafeAreaPadding(padding as string);
		expect(parsed, `${area.region} · ${area.edge}: «${padding}»`).not.toBeNull();
		expect(parsed?.inset).toBe(area.edge);
		expect(parsed?.base).toBe(area.base);
		expect(parsed?.fallback).toBeDefined();
	});

	it("el campo de texto declara el suelo de tamaño de fuente", () => {
		const rule = ruleFor(styles, ".chatbox textarea");
		expect(rule).toBeDefined();
		const parsed = parseFontSize(declarationsOf(rule as NonNullable<typeof rule>)["font-size"]);
		expect(parsed).not.toBeNull();
		expect(parsed?.floor).toBe(FONT_SIZE_FLOOR_PX);
		expect(parsed?.respectsUserSize).toBe(true);
	});
});

// --- La guarda muerde ----------------------------------------------------------

describe("la guarda del contrato", () => {
	it("la hoja de referencia cumple el contrato", () => {
		expect(reasonsOf(COMPLIANT)).toEqual([]);
	});

	it("rechaza un tope de altura que no usa la unidad dinámica", () => {
		const reasons = reasonsOf(COMPLIANT.replace("max-height: 100dvh", "max-height: 100vh"));
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("100vh");
		expect(reasons.join(" | ")).toContain(DYNAMIC_VIEWPORT_UNIT);
	});

	it("rechaza una raíz sin tope de altura", () => {
		const reasons = reasonsOf(COMPLIANT.replace("max-height: 100dvh; ", ""));
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no declara el tope de altura");
	});

	it("rechaza una altura declarada en vh en cualquier regla", () => {
		// La regresión que motivó el requisito: `vh` mide el viewport con la barra
		// desplegada, y en móvil deja el pie del widget fuera de la pantalla.
		const reasons = reasonsOf(`${COMPLIANT}\n.chatbox__header { height: 100vh; }`);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("100vh");
	});

	it("rechaza una altura declarada en svh o lvh", () => {
		expect(reasonsOf(`${COMPLIANT}\n.chatbox__header { height: 100lvh; }`)).toHaveLength(1);
		expect(reasonsOf(`${COMPLIANT}\n.chatbox__header { height: 100svh; }`)).toHaveLength(1);
	});

	it("rechaza una región que no existe", () => {
		const reasons = reasonsOf(COMPLIANT.replace(".chatbox__footer {", ".chatbox__pie {"));
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("falta la regla");
	});

	it("rechaza una región que no declara el padding del borde", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace("padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));", "")
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no suma la safe area");
	});

	it("rechaza una región sin padding propio", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(/\.chatbox__footer \{[^}]*\}/, ".chatbox__footer { display: flex; }")
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no declara el padding del borde");
	});

	it("rechaza una región que pierde su padding base", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(".chatbox__footer {\n\tpadding: 0.75rem 1rem;", ".chatbox__footer {")
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no declara el padding base del borde");
	});

	it("rechaza un padding que se come el padding base", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				"padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))",
				"padding-bottom: env(safe-area-inset-bottom, 0px)"
			)
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no suma la safe area");
	});

	it("rechaza un padding que ignora la safe area", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				"padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))",
				"padding-bottom: 0.75rem"
			)
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no suma la safe area");
	});

	it("rechaza un padding que lee la safe area de otro borde", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				"padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))",
				"padding-bottom: max(0.75rem, env(safe-area-inset-top, 0px))"
			)
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("lee la safe area de «top»");
	});

	it("rechaza un inset sin valor de reserva", () => {
		// Sin reserva, `env()` puede ser inválido en tiempo de valor calculado y el borde
		// se quedaría sin padding en lugar de perder solo la safe area.
		const reasons = reasonsOf(
			COMPLIANT.replace("env(safe-area-inset-bottom, 0px)", "env(safe-area-inset-bottom)")
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("valor de reserva");
	});

	it("rechaza un padding que no parte del padding base del contrato", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				"max(1rem, env(safe-area-inset-left, 0px))",
				"max(1.25rem, env(safe-area-inset-left, 0px))"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("1.25rem");
	});

	it("rechaza una regla posterior que vuelve a declarar el padding", () => {
		// Una regla más específica ganaría por orden de cascada y dejaría el widget sin
		// safe area sin que ninguna de las dos capas se entere.
		const reasons = reasonsOf(`${COMPLIANT}\n.chatbox__footer { padding-left: 1rem; }`);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no suma la safe area");
	});

	it("rechaza una regla dentro de un @media que vuelve a declarar el padding", () => {
		// La guarda mira también las reglas anidadas: dentro de su media query, la regla
		// anidada gana y dejaría el widget sin safe area.
		const reasons = reasonsOf(
			`${COMPLIANT}\n@media (min-width: 600px) { .chatbox__footer { padding-left: 1rem; } }`
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("no suma la safe area");
	});

	it("rechaza una región cuyo padding base no es el del contrato", () => {
		// El `max()` partiría del base del contrato y la región declararía otro: la safe
		// area se comería parte del espaciado propio del widget.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				".chatbox__header {\n\tpadding: 0.75rem 1rem;",
				".chatbox__header {\n\tpadding: 1.25rem 1rem;"
			)
		);
		expect(reasons.length).toBeGreaterThan(0);
		expect(reasons.join(" | ")).toContain("padding base");
	});

	it("rechaza un tamaño de fuente en rem", () => {
		// `1rem` vale 16 px con la raíz del sitio host a 16 px y 14 px con una raíz de
		// 14 px: el host más común rompería RF-F50 sin que el navegador de test lo viera.
		const reasons = reasonsOf(COMPLIANT.replace("font-size: max(1rem, 16px)", "font-size: 1rem"));
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no es un suelo con la forma");
	});

	it("rechaza un tamaño de fuente por debajo del suelo", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace("font-size: max(1rem, 16px)", "font-size: max(1rem, 15px)")
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("el suelo es 16 px");
	});

	it("rechaza un tamaño de fuente que ignora el del sitio host", () => {
		// `16px` a secas cumple el suelo, pero ignora el tamaño de fuente que la persona
		// eligió en su navegador.
		const reasons = reasonsOf(COMPLIANT.replace("font-size: max(1rem, 16px)", "font-size: 16px"));
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no es un suelo con la forma");
	});

	it("rechaza un tamaño de fuente que no llega al tamaño de la raíz", () => {
		// `0.5rem` nunca valdría más que el suelo: el tamaño que la persona eligió en su
		// navegador quedaría sin sitio.
		const reasons = reasonsOf(
			COMPLIANT.replace("font-size: max(1rem, 16px)", "font-size: max(0.5rem, 16px)")
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no es un suelo con la forma");
	});

	it("rechaza un interlineado en px absolutos en el campo", () => {
		// El interlineado tiene que acompañar al tamaño de fuente: en px absolutos lo
		// contradice.
		const reasons = reasonsOf(
			COMPLIANT.replace(
				"font-size: max(1rem, 16px);",
				"font-size: max(1rem, 16px); line-height: 20px;"
			)
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("unidad absoluta");
	});

	it("rechaza un campo de texto sin tamaño declarado", () => {
		const reasons = reasonsOf(COMPLIANT.replace("font-size: max(1rem, 16px);", ""));
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("no declara su tamaño de fuente");
	});

	it("rechaza una segunda regla que declara el tamaño del campo", () => {
		// Una regla más específica gana por orden de cascada y dejaría el campo por debajo
		// del suelo sin que ninguno de los dos niveles lo viera.
		const reasons = reasonsOf(`${COMPLIANT}\n.chatbox__footer textarea { font-size: 0.875rem; }`);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("más de una declaración");
	});

	it("rechaza una regla que apunte al campo por su id", () => {
		// El campo también se puede nombrar por su id: la guarda mira los tres nombres.
		const reasons = reasonsOf(`${COMPLIANT}\n#chatbox-question { font-size: 0.875rem; }`);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("más de una declaración");
	});

	it("rechaza una regla que apunte al campo por su identidad", () => {
		// Y por la identidad del contrato de objetivos táctiles, que también lo nombra.
		const reasons = reasonsOf(
			`${COMPLIANT}\n[data-chatbox-control="question-field"] { font-size: 0.875rem; }`
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("más de una declaración");
	});

	it("no confunde una clase que se parece al campo con el campo", () => {
		// Una guarda que avisara de una clase que no es el campo enseñaría a ignorar la
		// guarda.
		const reasons = reasonsOf(`${COMPLIANT}\n.chatbox__textarea-hint { font-size: 0.875rem; }`);
		expect(reasons).toEqual([]);
	});

	it("rechaza el atajo font, que fija también el tamaño del campo", () => {
		const reasons = reasonsOf(
			COMPLIANT.replace(
				".chatbox textarea { font-size: max(1rem, 16px); }",
				".chatbox textarea { font: inherit; font-size: max(1rem, 16px); }"
			)
		);
		expect(reasons).toHaveLength(1);
		expect(reasons[0]).toContain("más de una declaración");
	});
});
