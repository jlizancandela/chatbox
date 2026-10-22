/**
 * RF-F44 — la regla pura de scroll (issue #100).
 *
 * Nivel de verificación: **mecanismo**. La regla traduce "la persona pide menos movimiento"
 * y "para qué se desplaza" a un comportamiento de scroll, y no necesita DOM para eso: se
 * puede probar sola.
 */

import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY, scrollBehavior } from "../../../../src/chat/domain/motion";

describe("RF-F44 — la regla de scroll del widget", () => {
	it("asks for a smooth jump when nobody asked for less movement", () => {
		expect(scrollBehavior(false, "salto")).toBe("smooth");
	});

	it("asks for an instant jump when the person asked for less movement", () => {
		// `"auto"` no significa "instantáneo": delega en el `scroll-behavior` computado, y
		// el contrato del CSS declara `auto` en la caja de scroll.
		expect(scrollBehavior(true, "salto")).toBe("auto");
	});

	it("always follows the thread without animating", () => {
		// El seguimiento se actualiza con cada token: una animación se reinicia en cada
		// actualización y nunca llega, así que el hilo se quedaría a mitad de la respuesta.
		expect(scrollBehavior(false, "seguimiento")).toBe("auto");
		expect(scrollBehavior(true, "seguimiento")).toBe("auto");
	});

	it("reads the preference of the operating system", () => {
		expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
	});
});
