/**
 * RF-F44 — el contrato de movimiento del widget (issue #100).
 *
 * Nivel de verificación: **mecanismo**. Comprueba que la hoja de estilos respeta el
 * contrato —la animación solo existe cuando la persona permite el movimiento y el scroll
 * suave no se declara en el CSS— y que el literal del scroll suave no aparece por el
 * código. El nivel de resolución (`test/browser/motion.spec.ts`) afirma lo que el navegador
 * hace con esa hoja. Ver `docs/decisions/008-movimiento-reducido.md`.
 */

import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY } from "../../src/chat/domain/motion";
import { cssSource } from "../css-layers";
import {
	findMotionViolations,
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

const RULE_MODULE = "src/chat/domain/motion.ts";

describe("RF-F44 — la hoja de estilos respeta el contrato de movimiento", () => {
	it("has no violations", () => {
		expect(findMotionViolations(cssSource)).toEqual([]);
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
		const violations = findMotionViolations(`
			.chatbox__typing-dot {
				animation: chatbox-typing-bounce 1s infinite;
			}
			@media (prefers-reduced-motion: no-preference) {
				.chatbox__typing-dot {
					animation: chatbox-typing-bounce 1s infinite;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.chatbox__conversation {
					scroll-behavior: auto;
				}
			}
		`);

		expect(violations.map((violation) => violation.reason)).toEqual([
			"`animation: chatbox-typing-bounce 1s infinite` fuera del bloque `(prefers-reduced-motion: no-preference)`",
		]);
	});

	it("rejects keyframes declared outside the contract", () => {
		const violations = findMotionViolations(`
			@keyframes chatbox-typing-bounce {
				0% {
					transform: translateY(0);
				}
			}
			@media (prefers-reduced-motion: no-preference) {
				.chatbox__typing-dot {
					animation: chatbox-typing-bounce 1s infinite;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.chatbox__conversation {
					scroll-behavior: auto;
				}
			}
		`);

		expect(violations.map((violation) => violation.reason)).toEqual([
			"`@keyframes chatbox-typing-bounce` fuera del bloque `(prefers-reduced-motion: no-preference)`",
		]);
	});

	it("rejects a smooth scroll declared in CSS", () => {
		const violations = findMotionViolations(`
			.chatbox__conversation {
				scroll-behavior: smooth;
			}
			@media (prefers-reduced-motion: no-preference) {
				.chatbox__typing-dot {
					animation: chatbox-typing-bounce 1s infinite;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.chatbox__conversation {
					scroll-behavior: auto;
				}
			}
		`);

		expect(violations.map((violation) => violation.reason)).toEqual([
			"`scroll-behavior: smooth` en `.chatbox__conversation`: el scroll lo decide la regla de RF-F44, no el CSS",
		]);
	});

	it("rejects a stylesheet without the contract blocks", () => {
		const violations = findMotionViolations(`
			.chatbox__typing-dot {
				animation: chatbox-typing-bounce 1s infinite;
			}
		`);

		expect(violations.map((violation) => violation.reason)).toEqual([
			"falta el bloque `(prefers-reduced-motion: no-preference)`, que es donde vive la animación",
			"falta el bloque `(prefers-reduced-motion: reduce)`, que es el contrato del movimiento reducido",
			"`animation: chatbox-typing-bounce 1s infinite` fuera del bloque `(prefers-reduced-motion: no-preference)`",
			"el bloque `(prefers-reduced-motion: reduce)` no declara `scroll-behavior: auto` en `.chatbox__conversation`",
			"el inventario declara `typing-indicator` pero no hay ninguna animación para `.chatbox__typing-dot`",
		]);
	});

	it("rejects an animation that no source in the inventory claims", () => {
		const violations = findMotionViolations(`
			@media (prefers-reduced-motion: no-preference) {
				.chatbox__otro-elemento {
					animation: chatbox-typing-bounce 1s infinite;
				}
			}
			@media (prefers-reduced-motion: reduce) {
				.chatbox__conversation {
					scroll-behavior: auto;
				}
			}
		`);

		expect(violations.map((violation) => violation.reason)).toEqual([
			"el inventario declara `typing-indicator` pero no hay ninguna animación para `.chatbox__typing-dot`",
		]);
	});
});

describe("RF-F44 — el scroll suave solo lo pide la regla del contrato", () => {
	it("keeps the smooth literal out of the rest of the widget", () => {
		// El inventario de textos de RF-F62 permite el literal porque es un valor técnico de
		// CSSOM; esta es la guarda que lo acota a un solo sitio.
		const offenders = Object.entries(SOURCE_FILES)
			.filter(([path]) => !path.endsWith(RULE_MODULE))
			.filter(([, source]) => /["'`]smooth["'`]/.test(source))
			.map(([path]) => path);

		expect(offenders).toEqual([]);
	});
});
