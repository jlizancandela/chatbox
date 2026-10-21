/**
 * RF-F42 — el contrato de contraste del widget (issue #96).
 *
 * Nivel de verificación: **mecanismo**. Se parsea la hoja de estilos del widget y se afirma
 * que cada combinación de tinta y fondo alcanza su piso, que ningún token de color puede
 * entrar al widget sin fila en el contrato, y que las capas de accesibilidad ganan al tema
 * que declara el sitio host. El valor resuelto lo verifica la suite de navegador
 * (`test/browser/contrast.spec.ts`). Ver
 * `docs/decisions/006-contrato-y-verificacion-de-contraste.md`.
 */

import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast";
import {
	cssSource,
	mediaRule,
	offsetOf,
	ruleInside,
	ruleWith,
	tokensOf,
	topLevelRule,
} from "../css-layers";

// --- El contrato ------------------------------------------------------------
//
// Un par es una tinta, un fondo y el piso que tienen que alcanzar. Los pisos vienen de
// RF-F42: 4.5:1 para el texto y 3:1 para los componentes visuales y el anillo de foco.

type Pair = { ink: string; background: string; floor: number };

const CONTRACT: Pair[] = [
	{ ink: "text", background: "surface", floor: 4.5 },
	{ ink: "text", background: "surface-subtle", floor: 4.5 },
	{ ink: "text", background: "surface-raised", floor: 4.5 },
	{ ink: "link", background: "surface", floor: 4.5 },
	{ ink: "link", background: "surface-subtle", floor: 4.5 },
	{ ink: "surface", background: "primary", floor: 4.5 },
	{ ink: "surface", background: "accent-container", floor: 4.5 },
	{ ink: "error", background: "surface", floor: 4.5 },
	{ ink: "focus", background: "surface", floor: 3 },
	{ ink: "focus", background: "surface-subtle", floor: 3 },
	{ ink: "focus", background: "surface-raised", floor: 3 },
	{ ink: "border", background: "surface", floor: 3 },
	{ ink: "border", background: "surface-subtle", floor: 3 },
	{ ink: "border", background: "surface-raised", floor: 3 },
	{ ink: "primary", background: "surface-raised", floor: 3 },
];

// --- La guarda ---------------------------------------------------------------

const BACKGROUND_PROPERTIES = new Set(["background", "background-color"]);
const FOREGROUND_PROPERTIES = new Set([
	"color",
	"border",
	"border-color",
	"border-top",
	"border-bottom",
	"border-top-color",
	"border-bottom-color",
	"outline",
	"outline-color",
]);

type Usage = { ink: Set<string>; background: Set<string> };

/**
 * Reparte los tokens de color de la hoja de estilos entre tinta y fondo. Una propiedad que
 * usa un token y no está clasificada es un error: alguien tiene que decidir si pinta texto o
 * superficie antes de que ese color entre en el widget.
 */
const tokenUsage = (source: string): Usage => {
	const usage: Usage = { ink: new Set(), background: new Set() };
	postcss.parse(source).walkDecls((decl) => {
		const tokens = [...decl.value.matchAll(/var\(--chatbox-color-([a-z-]+)\)/g)].map(
			(match) => match[1]
		);
		if (tokens.length === 0) return;
		const target = BACKGROUND_PROPERTIES.has(decl.prop)
			? usage.background
			: FOREGROUND_PROPERTIES.has(decl.prop)
				? usage.ink
				: null;
		if (!target) {
			throw new Error(`Propiedad sin clasificar en el contrato de contraste: ${decl.prop}`);
		}
		for (const token of tokens) target.add(token);
	});
	return usage;
};

/** Lo que impide que el contrato se quede viejo: todo token usado tiene su fila o columna. */
const contractViolations = (usage: Usage): string[] => {
	const violations: string[] = [];
	for (const token of usage.ink) {
		if (!CONTRACT.some((pair) => pair.ink === token)) {
			violations.push(`la tinta "${token}" no tiene fila en el contrato`);
		}
	}
	for (const token of usage.background) {
		if (!CONTRACT.some((pair) => pair.background === token)) {
			violations.push(`el fondo "${token}" no tiene columna en el contrato`);
		}
	}
	return violations;
};

// --- Las capas ---------------------------------------------------------------

const DARK_MEDIA = "(prefers-color-scheme: dark)";
const CONTRAST_LIGHT_MEDIA = "(prefers-contrast: more) and (prefers-color-scheme: light)";
const CONTRAST_MEDIA = "(prefers-contrast: more)";
const FORCED_COLORS_MEDIA = "(forced-colors: active)";

const PALETTES: { name: string; tokens: Record<string, string> }[] = [
	{ name: "claro", tokens: tokensOf(topLevelRule(".chatbox")) },
	{ name: "oscuro", tokens: tokensOf(ruleInside(mediaRule(DARK_MEDIA), ".chatbox")) },
	{
		name: "contraste alto",
		tokens: tokensOf(ruleInside(mediaRule(CONTRAST_LIGHT_MEDIA), ".chatbox")),
	},
];

describe("RF-F42 — el contrato de contraste se cumple en cada paleta", () => {
	for (const palette of PALETTES) {
		for (const pair of CONTRACT) {
			it(`${pair.ink} sobre ${pair.background} alcanza ${pair.floor}:1 (${palette.name})`, () => {
				const ink = palette.tokens[`--chatbox-color-${pair.ink}`];
				const background = palette.tokens[`--chatbox-color-${pair.background}`];
				expect(ink, `falta el token de tinta ${pair.ink}`).toBeDefined();
				expect(background, `falta el token de fondo ${pair.background}`).toBeDefined();
				expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(pair.floor);
			});
		}
	}
});

describe("RF-F42 — la guarda del contrato", () => {
	it("no deja entrar un color sin fila en el contrato", () => {
		expect(contractViolations(tokenUsage(cssSource))).toEqual([]);
	});

	it("obliga a que el token de error se use de verdad", () => {
		// Un token declarado y nunca consumido es una promesa que nadie cumple: el error se
		// pintaría con el color del texto normal y su contraste no se verificaría.
		expect(tokenUsage(cssSource).ink.has("error")).toBe(true);
	});
});

describe("RF-F42 — la guarda muerde", () => {
	it("reporta un token nuevo que no tiene fila en el contrato", () => {
		const usage = tokenUsage(".chatbox { color: var(--chatbox-color-nuevo); }");

		expect(contractViolations(usage)).toEqual(['la tinta "nuevo" no tiene fila en el contrato']);
	});

	it("reporta un fondo nuevo que no tiene columna en el contrato", () => {
		const usage = tokenUsage(".chatbox { background-color: var(--chatbox-color-nueva); }");

		expect(contractViolations(usage)).toEqual(['el fondo "nueva" no tiene columna en el contrato']);
	});

	it("rechaza una propiedad que nadie ha clasificado", () => {
		expect(() =>
			tokenUsage(".chatbox { box-shadow: 0 0 0 1px var(--chatbox-color-border); }")
		).toThrow(/sin clasificar/);
	});
});

describe("RF-F42 — precedencia de las capas de accesibilidad", () => {
	it("la capa de contraste alto solo sustituye tokens en el esquema claro", () => {
		// En oscuro la paleta ya supera todos los pisos: sustituirla por la clara sería
		// empeorar el widget para quien pidió más contraste.
		expect(ruleWith(mediaRule(CONTRAST_MEDIA), ".chatbox")).toBeUndefined();
		expect(ruleWith(mediaRule(CONTRAST_LIGHT_MEDIA), ".chatbox")).toBeDefined();
	});

	it("la capa de contraste alto declara los mismos tokens que la del esquema claro", () => {
		const claro = tokensOf(ruleInside(mediaRule(CONTRAST_LIGHT_MEDIA), ".chatbox"));
		const hostClaro = tokensOf(
			ruleInside(mediaRule(CONTRAST_MEDIA), '[data-theme="light"] .chatbox')
		);

		expect(hostClaro).toEqual(claro);
	});

	it("la capa de contraste alto le gana al tema claro que declara el host", () => {
		const hostLight = topLevelRule('[data-theme="light"] .chatbox');
		const accessibility = ruleInside(mediaRule(CONTRAST_MEDIA), '[data-theme="light"] .chatbox');

		// El mismo selector significa la misma especificidad: entonces gana el que esté
		// más tarde en el código fuente.
		expect(accessibility.selectors).toContain('[data-theme="light"] .chatbox');
		expect(offsetOf(accessibility)).toBeGreaterThan(offsetOf(hostLight));
	});

	it("los colores forzados le ganan al tema que declara el host", () => {
		const forced = ruleInside(mediaRule(FORCED_COLORS_MEDIA), ".chatbox");
		const hostDark = topLevelRule('[data-theme="dark"] .chatbox');
		const hostLight = topLevelRule('[data-theme="light"] .chatbox');

		expect(forced.selectors).toContain('[data-theme="dark"] .chatbox');
		expect(forced.selectors).toContain('[data-theme="light"] .chatbox');
		expect(offsetOf(forced)).toBeGreaterThan(offsetOf(hostDark));
		expect(offsetOf(forced)).toBeGreaterThan(offsetOf(hostLight));
	});
});
