/**
 * RF-F44 — el contrato de movimiento del widget (issue #100).
 *
 * Nivel de verificación: **mecanismo**. Comprueba que la hoja de estilos respeta el
 * contrato —la animación solo existe cuando la persona permite el movimiento y el scroll
 * suave no se declara en el CSS— y que el literal del scroll suave no aparece por el
 * código. El nivel de resolución (`test/browser/motion.spec.ts`) afirma lo que el navegador
 * hace con esa hoja. Ver `docs/decisions/008-movimiento-reducido.md`.
 */

import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY } from "../../src/chat/domain/motion";
import { cssSource, styles } from "../css-layers";
import {
	findMotionViolations,
	findSmoothScrollOffenders,
	MOTION_SOURCES,
	NO_PREFERENCE_QUERY,
	SCROLL_BOX_SELECTOR,
	TYPING_SELECTOR,
} from "../motion";

/** Todo el código del widget: el literal del scroll suave solo puede vivir en la regla. */
const SOURCE_FILES = import.meta.glob("../../src/**/*.{ts,tsx}", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

/**
 * Los dos bloques del contrato, que toda hoja crafteada necesita para no fallar por otra
 * razón: sin ellos, cada caso detectaría también la ausencia de los bloques.
 */
const contractBlocks = (body: string): string => `
	${body}
	@media ${NO_PREFERENCE_QUERY} {
		.chatbox__typing-dot {
			animation: chatbox-typing-bounce 1s infinite;
		}
	}
	@media ${REDUCED_MOTION_QUERY} {
		.chatbox__conversation {
			scroll-behavior: auto;
		}
	}
`;

/** Las violaciones de una hoja crafteada. */
const violationsOf = (css: string): string[] =>
	findMotionViolations(postcss.parse(css)).map((violation) => violation.reason);

describe("RF-F44 — la hoja de estilos respeta el contrato de movimiento", () => {
	it("has no violations", () => {
		expect(findMotionViolations(styles)).toEqual([]);
	});

	it("declares the animation inside the no-preference block", () => {
		// La garantía no depende de una sobrescritura: con movimiento reducido la animación
		// no se declara, así que no hay especificidad que pueda revivirla.
		expect(cssSource).toContain(NO_PREFERENCE_QUERY);
		expect(cssSource).toContain(REDUCED_MOTION_QUERY);
	});

	it("declares the instant scroll on the scroll box", () => {
		expect(cssSource).toContain(SCROLL_BOX_SELECTOR);
		expect(cssSource).toContain("scroll-behavior: auto");
	});

	it("inventories both motion sources", () => {
		expect(MOTION_SOURCES.map((source) => source.id)).toEqual([
			"typing-indicator",
			"smooth-scroll",
		]);
		expect(TYPING_SELECTOR).toBe(".chatbox__typing-dot");
	});
});

describe("RF-F44 — la guarda rechaza lo que el contrato prohíbe", () => {
	it("rejects an animation declared outside the contract", () => {
		expect(
			violationsOf(
				contractBlocks(`
					.chatbox__typing-dot {
						animation: chatbox-typing-bounce 1s infinite;
					}
				`)
			)
		).toEqual([
			"«animation: chatbox-typing-bounce 1s infinite» fuera del bloque «(prefers-reduced-motion: no-preference)»",
		]);
	});

	it("rejects a transition declared outside the contract", () => {
		expect(
			violationsOf(
				contractBlocks(`
					.chatbox__typing-dot {
						transition: opacity 0.2s ease-in-out;
					}
				`)
			)
		).toEqual([
			"«transition: opacity 0.2s ease-in-out» fuera del bloque «(prefers-reduced-motion: no-preference)»",
		]);
	});

	it("rejects keyframes declared outside the contract", () => {
		expect(
			violationsOf(
				contractBlocks(`
					@keyframes chatbox-typing-bounce {
						0% {
							transform: translateY(0);
						}
					}
				`)
			)
		).toEqual([
			"«@keyframes chatbox-typing-bounce» fuera del bloque «(prefers-reduced-motion: no-preference)»",
		]);
	});

	it("rejects a smooth scroll declared in CSS", () => {
		expect(
			violationsOf(
				contractBlocks(`
					.chatbox__conversation {
						scroll-behavior: smooth;
					}
				`)
			)
		).toEqual([
			"«scroll-behavior: smooth» en «.chatbox__conversation»: el scroll lo decide la regla de RF-F44, no el CSS",
		]);
	});

	it("rejects a motion source that is not in the inventory", () => {
		// La guarda es bidireccional: lo declarado tiene que estar inventariado, no solo al
		// revés. Sin esta dirección, una animación nueva se cuela en silencio.
		expect(
			violationsOf(
				contractBlocks(`
					@media ${NO_PREFERENCE_QUERY} {
						.chatbox__badge {
							animation: chatbox-typing-bounce 1s infinite;
						}
					}
				`)
			)
		).toEqual(["la animación de «.chatbox__badge» no está en el inventario de movimiento"]);
	});

	it("rejects a stylesheet without the contract blocks", () => {
		expect(
			violationsOf(`
				.chatbox__typing-dot {
					animation: chatbox-typing-bounce 1s infinite;
				}
			`)
		).toEqual([
			"falta el bloque «(prefers-reduced-motion: no-preference)», que es donde vive la animación",
			"falta el bloque «(prefers-reduced-motion: reduce)», que es el contrato del movimiento reducido",
			"«animation: chatbox-typing-bounce 1s infinite» fuera del bloque «(prefers-reduced-motion: no-preference)»",
			"el bloque «(prefers-reduced-motion: reduce)» no declara «scroll-behavior: auto» en «.chatbox__conversation»",
			"el inventario declara «Indicador de escritura» pero no hay ninguna animación para «.chatbox__typing-dot»",
		]);
	});
});

describe("RF-F44 — el scroll suave solo lo pide la regla del contrato", () => {
	it("keeps the smooth literal out of the rest of the widget", () => {
		// El inventario de textos de RF-F62 permite el literal porque es un valor técnico de
		// CSSOM; esta es la guarda que lo acota a un solo sitio.
		expect(findSmoothScrollOffenders(SOURCE_FILES)).toEqual([]);
	});

	it("rejects a smooth scroll asked for outside the rule", () => {
		expect(
			findSmoothScrollOffenders({
				"src/chat/domain/motion.ts": 'export const scrollBehavior = () => "smooth";',
				"src/components/Chatbox.tsx": 'element.scrollTo({ behavior: "smooth" });',
			})
		).toEqual(["src/components/Chatbox.tsx"]);
	});
});
