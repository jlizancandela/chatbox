/**
 * RF-F48 — la regla pura del umbral de seguimiento (issue #108).
 *
 * Nivel de verificación: **mecanismo**. La regla decide qué es «apartarse del hilo» y no
 * necesita DOM para eso: se puede probar sola. Que viva en el dominio es lo que permite
 * que el test de navegador derive de ella su precondición en vez de adivinarla.
 */

import { describe, expect, it } from "vitest";
import { followThreshold, isAwayFromEnd } from "../../../../src/chat/domain/scroll";

describe("RF-F48 — el umbral de seguimiento", () => {
	it("son 16 px, los mismos en cualquier widget", () => {
		// La regla no recibe la altura del contenedor: si la recibiera, el umbral se
		// movería solo cuando el widget cambia de alto.
		expect(followThreshold).toBe(16);
	});

	it("ignora el ruido y cuenta el apartarse", () => {
		expect(isAwayFromEnd(0)).toBe(false);
		expect(isAwayFromEnd(15)).toBe(false);
		expect(isAwayFromEnd(16)).toBe(true);
		expect(isAwayFromEnd(30)).toBe(true);
	});
});
