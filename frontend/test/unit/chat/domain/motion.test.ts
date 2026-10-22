/**
 * RF-F44 — la regla pura de scroll (issue #100).
 *
 * Nivel de verificación: **mecanismo**. La regla traduce "la persona pide menos movimiento"
 * a un comportamiento de scroll, y no necesita DOM para eso: se puede probar sola.
 */

import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY, scrollBehavior } from "../../../../src/chat/domain/motion";

describe("RF-F44 — la regla de scroll del widget", () => {
	it("asks for a smooth scroll when nobody asked for less movement", () => {
		expect(scrollBehavior(false)).toBe("smooth");
	});

	it("asks for an instant scroll when the person asked for less movement", () => {
		// `"auto"` no significa "instantáneo": delega en el `scroll-behavior` computado, y
		// el contrato del CSS declara `auto` en la caja de scroll.
		expect(scrollBehavior(true)).toBe("auto");
	});

	it("reads the preference of the operating system", () => {
		expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
	});
});
