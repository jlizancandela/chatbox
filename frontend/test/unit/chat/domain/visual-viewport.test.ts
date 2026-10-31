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
	coveredByKeyboard,
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

describe("RF-F51 — lo que tapa el teclado", () => {
	it("es la parte del borde inferior que queda bajo el teclado", () => {
		expect(coveredByKeyboard(LAYOUT_HEIGHT, visibleArea(500, 0))).toBe(KEYBOARD);
	});

	it("es cero si el pie no llega al teclado", () => {
		expect(coveredByKeyboard(400, visibleArea(500, 0))).toBe(0);
	});
});

describe("RF-F51 — la franja que el widget reserva", () => {
	it("reserva lo que tapa el teclado", () => {
		expect(reservedInset(LAYOUT_HEIGHT, 0, visibleArea(500, 0))).toBe(KEYBOARD);
	});

	it("no reserva nada sin teclado", () => {
		expect(reservedInset(LAYOUT_HEIGHT, 0, visibleArea(LAYOUT_HEIGHT, 0))).toBe(0);
	});

	it("no reserva nada si el pie queda por encima del teclado", () => {
		// Un widget embebido en una página: el navegador lo desplaza al enfocar el
		// campo y su pie queda arriba del teclado. Reservar de más solo encogería el hilo.
		expect(reservedInset(400, 0, visibleArea(500, 0))).toBe(0);
	});

	it("descuenta lo que ya ha reservado", () => {
		// La reserva vive en el padding de la raíz, así que el borde inferior de su caja
		// de contenido —donde acaba el pie— es el de la caja menos lo reservado. Sin
		// restarlo, la medida incluiría el efecto de la propia reserva y la caja crecería
		// en cada medida.
		expect(reservedInset(LAYOUT_HEIGHT, 0, visibleArea(500, 0))).toBe(KEYBOARD);
		// Con la reserva ya aplicada, el pie está donde tocaría sin ella: no hay que
		// reservar más.
		expect(reservedInset(LAYOUT_HEIGHT, KEYBOARD, visibleArea(500, 0))).toBe(0);
	});

	it("reserva lo que la caja se sale de debajo de la pantalla", () => {
		// Una caja que se sale de la pantalla reserva también lo que sobra: el pie tiene
		// que quedar en el borde de la zona visible, ni un píxel más abajo.
		expect(reservedInset(LAYOUT_HEIGHT + 40, 0, visibleArea(500, 0))).toBe(KEYBOARD + 40);
	});

	it("no crece con la reserva: la medida ya la descuenta", () => {
		// Un sitio host que le da una altura automática hace crecer la caja con cada
		// medida. Como la medida descuenta lo reservado, la reserva no crece.
		const area = visibleArea(500, 0);
		const first = reservedInset(LAYOUT_HEIGHT + 400, 0, area);
		const second = reservedInset(LAYOUT_HEIGHT + 400 + first, first, area);
		expect(second).toBe(first);
	});

	it("mide el teclado contra el viewport visual, no contra el de layout", () => {
		// El teclado virtual encoge el viewport visual y deja el de layout como estaba:
		// si se midiera contra `innerHeight`, la franja saldría cero y el teclado taparía
		// el campo de texto.
		const area = visibleArea(LAYOUT_HEIGHT - KEYBOARD, 0);
		expect(reservedInset(LAYOUT_HEIGHT, 0, area)).toBe(KEYBOARD);
	});

	it("cuenta el desplazamiento del viewport visual", () => {
		// Con el viewport visual desplazado, el borde inferior de la zona visible también
		// lo está: el pie tiene que quedar por encima de ese borde, no del de arriba. El
		// teclado sigue tapando 300 px, así que el viewport visual encoge 300 px más
		// abajo de donde estaba.
		const area = visibleArea(LAYOUT_HEIGHT - 120 - KEYBOARD, 120);
		expect(area.bottom).toBe(LAYOUT_HEIGHT - KEYBOARD);
		expect(reservedInset(LAYOUT_HEIGHT, 0, area)).toBe(KEYBOARD);
	});
});
