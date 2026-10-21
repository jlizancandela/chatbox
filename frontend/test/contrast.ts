/**
 * Cálculo del ratio de contraste WCAG 2.x.
 *
 * Compartido por los dos niveles de verificación de RF-F42 —mecanismo en jsdom y resolución
 * en Chromium— para que no pueda haber dos implementaciones que divergan. No es código de
 * producción: vive con el `setup.ts` de los tests.
 */

export type Rgb = readonly [number, number, number];

export type Color = { rgb: Rgb; alpha: number };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_FUNCTION = /^rgba?\(([^)]*)\)$/i;

/**
 * Lee un color CSS en hexadecimal o en notación funcional. Devuelve `null` para lo que no
 * entiende: los colores de sistema (`CanvasText`, `Highlight`, …) no son computables y su
 * contraste es cosa del sistema, no del widget.
 */
export const parseColor = (value: string): Color | null => {
	const input = value.trim();

	const hex = input.match(HEX);
	if (hex) {
		const digits =
			hex[1].length === 3
				? hex[1]
						.split("")
						.map((char) => char + char)
						.join("")
				: hex[1];
		return {
			rgb: [
				Number.parseInt(digits.slice(0, 2), 16),
				Number.parseInt(digits.slice(2, 4), 16),
				Number.parseInt(digits.slice(4, 6), 16),
			],
			alpha: 1,
		};
	}

	const functional = input.match(RGB_FUNCTION);
	if (!functional) return null;
	const parts = functional[1]
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map((part) => Number(part));
	if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;

	return { rgb: [parts[0], parts[1], parts[2]], alpha: parts.length > 3 ? parts[3] : 1 };
};

/** Luminancia relativa WCAG 2.x de un color. */
export const relativeLuminance = (rgb: Rgb): number => {
	const [r, g, b] = rgb.map((component) => {
		const channel = component / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Ratio de contraste WCAG 2.x entre dos colores, de 1 a 21. Devuelve `NaN` si alguno de los
 * dos no se puede leer: un ratio inventado sería peor que un ratio ausente.
 */
export const contrastRatio = (foreground: string, background: string): number => {
	const first = parseColor(foreground);
	const second = parseColor(background);
	if (!first || !second) return Number.NaN;
	const a = relativeLuminance(first.rgb);
	const b = relativeLuminance(second.rgb);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** `true` si el color no pinta nada debajo: no es un fondo válido para medir contraste. */
export const isTransparent = (value: string): boolean => {
	const color = parseColor(value);
	if (!color) return true;
	return color.alpha === 0;
};
