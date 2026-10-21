/**
 * RF-F42 — el cálculo de contraste que comparten los dos niveles de verificación.
 *
 * Los valores esperados vienen de fuera: los ratios publicados de WCAG 2.x, no de una
 * recomputación de la misma fórmula. Si el cálculo cambiara, estos tests lo notarían.
 */

import { describe, expect, it } from "vitest";
import { contrastRatio, isTransparent, parseColor, relativeLuminance } from "../contrast";

describe("RF-F42 — lectura de colores", () => {
	it("lee un hexadecimal de tres y de seis dígitos", () => {
		expect(parseColor("#fff")).toEqual({ rgb: [255, 255, 255], alpha: 1 });
		expect(parseColor("#00685f")).toEqual({ rgb: [0, 104, 95], alpha: 1 });
	});

	it("lee la notación funcional que devuelve el navegador", () => {
		expect(parseColor("rgb(26, 27, 34)")).toEqual({ rgb: [26, 27, 34], alpha: 1 });
		expect(parseColor("rgba(0, 0, 0, 0)")).toEqual({ rgb: [0, 0, 0], alpha: 0 });
	});

	it("no inventa un color para lo que no es un color", () => {
		expect(parseColor("CanvasText")).toBeNull();
		expect(parseColor("Highlight")).toBeNull();
		expect(parseColor("")).toBeNull();
	});

	it("distingue un color transparente de uno opaco", () => {
		expect(isTransparent("rgba(0, 0, 0, 0)")).toBe(true);
		expect(isTransparent("rgb(255, 255, 255)")).toBe(false);
		expect(isTransparent("Canvas")).toBe(true);
	});
});

describe("RF-F42 — ratio de contraste", () => {
	it("calcula el máximo de WCAG: negro sobre blanco", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
	});

	it("calcula el mínimo de WCAG: un color sobre sí mismo", () => {
		expect(contrastRatio("#00685f", "#00685f")).toBeCloseTo(1, 5);
	});

	it("sitúa el gris de referencia de WCAG justo por encima de 4.5:1", () => {
		// `#767676` sobre blanco es el gris más claro que todavía cumple 4.5:1.
		expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
	});

	it("sitúa el gris de referencia de WCAG justo por encima de 3:1", () => {
		// `#949494` sobre blanco es el gris más claro que todavía cumple 3:1.
		expect(contrastRatio("#949494", "#ffffff")).toBeCloseTo(3.03, 2);
	});

	it("devuelve NaN cuando un color no se puede leer", () => {
		expect(contrastRatio("CanvasText", "#ffffff")).toBeNaN();
	});

	it("calcula la luminancia relativa del blanco y del negro", () => {
		expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
		expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
	});
});
