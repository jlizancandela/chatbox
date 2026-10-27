/**
 * RF-F51 — la regla pura del teclado virtual (issue #119).
 *
 * Nivel de verificación: **mecanismo**. La regla decide dónde está la zona que se ve de
 * verdad y cuánta de ella tapa el teclado, y no necesita DOM para eso: se puede probar sola.
 * Que viva en el dominio es lo que permite que el test de navegador derive de ella su
 * precondición en vez de adivinarla.
 */

import { describe, expect, it } from "vitest";
import {
	ANCHOR_TOLERANCE_PX,
	coveredByKeyboard,
	isBottomAnchored,
	keyboardStrip,
	reservedInset,
	visibleArea,
} from "../../../../src/chat/domain/visual-viewport";

/** Una pantalla de 800 px con el teclado tapando los 300 de abajo. */
const LAYOUT_HEIGHT = 800;
const KEYBOARD = 300;

describe("RF-F51 — la zona visible", () => {
	it("va del borde superior visible al inferior", () => {
		const area = visibleArea(500, 0);
		expect(area.top).toBe(0);
		expect(area.bottom).toBe(500);
	});

	it("cuenta el desplazamiento del viewport visual", () => {
		// El viewport visual puede estar desplazado respecto del de layout: su borde
		// superior no es el cero del documento.
		const area = visibleArea(500, 120);
		expect(area.top).toBe(120);
		expect(area.bottom).toBe(620);
	});
});

describe("RF-F51 — la franja que tapa el teclado", () => {
	it("es lo que queda por debajo de la zona visible", () => {
		expect(keyboardStrip(LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(KEYBOARD);
	});

	it("es cero sin teclado", () => {
		expect(keyboardStrip(LAYOUT_HEIGHT, visibleArea(LAYOUT_HEIGHT, 0))).toBe(0);
	});

	it("nunca es negativa", () => {
		// Una zona visible más alta que el viewport de layout no deja franja: no hay
		// teclado que tapar.
		expect(keyboardStrip(LAYOUT_HEIGHT, visibleArea(1000, 0))).toBe(0);
	});
});

describe("RF-F51 — el anclaje inferior", () => {
	it("reconoce una caja que llega al borde inferior de la pantalla", () => {
		expect(isBottomAnchored(LAYOUT_HEIGHT, LAYOUT_HEIGHT)).toBe(true);
	});

	it("tolera el redondeo del navegador", () => {
		expect(isBottomAnchored(LAYOUT_HEIGHT - ANCHOR_TOLERANCE_PX, LAYOUT_HEIGHT)).toBe(true);
	});

	it("no confunde una caja que está por encima con una anclada", () => {
		// Un widget embebido en una página no está anclado: el navegador lo desplaza al
		// enfocar el campo, y reservar franja de más solo encogería el hilo.
		expect(isBottomAnchored(LAYOUT_HEIGHT - 200, LAYOUT_HEIGHT)).toBe(false);
	});
});

describe("RF-F51 — lo que tapa el teclado", () => {
	it("es la parte del borde inferior que queda bajo el teclado", () => {
		expect(coveredByKeyboard(LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(KEYBOARD);
	});

	it("es cero si el widget no llega al teclado", () => {
		expect(coveredByKeyboard(400, visibleArea(500, 0))).toBe(0);
	});
});

describe("RF-F51 — la franja que el widget reserva", () => {
	it("reserva lo que tapa el teclado cuando está anclado abajo", () => {
		expect(reservedInset(LAYOUT_HEIGHT, LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(KEYBOARD);
	});

	it("no reserva nada si el widget no está anclado abajo", () => {
		expect(reservedInset(LAYOUT_HEIGHT - 200, LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(0);
	});

	it("no reserva nada sin teclado", () => {
		expect(reservedInset(LAYOUT_HEIGHT, LAYOUT_HEIGHT, visibleArea(LAYOUT_HEIGHT, 0))).toBe(0);
	});

	it("reserva exactamente lo que queda bajo el teclado", () => {
		// Una caja que se sale de debajo de la pantalla reserva también lo que sobra: el
		// pie tiene que quedar en el borde de la zona visible, ni un píxel más abajo.
		expect(reservedInset(LAYOUT_HEIGHT + 40, LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(
			KEYBOARD + 40
		);
	});

	it("mide el teclado contra el viewport visual, no contra el de layout", () => {
		// El teclado virtual encoge el viewport visual y deja el de layout como estaba:
		// si se midiera contra `innerHeight`, la franja saldría cero y el teclado taparía
		// el campo de texto.
		const area = visibleArea(LAYOUT_HEIGHT - KEYBOARD, 0);
		expect(reservedInset(LAYOUT_HEIGHT, LAYOUT_HEIGHT, area)).toBe(KEYBOARD);
	});
});
