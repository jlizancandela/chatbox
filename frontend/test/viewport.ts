/**
 * Contrato de viewport móvil del widget (RF-F50).
 *
 * Fuente única del suelo de tamaño de fuente, de la tabla de safe areas y de la regla de
 * altura, compartida por los dos niveles de verificación —mecanismo en jsdom y resolución en
 * Chromium— para que no pueda haber dos definiciones de «altura dinámica» que diverjan. No es
 * código de producción: vive con los tests.
 */

import type { Root } from "postcss";
import { declarationsOf, ruleFor, rulesWithSelector } from "./css-declarations";

/**
 * El suelo de tamaño de fuente del campo de texto, en px CSS absolutos (RF-F50).
 *
 * iOS Safari amplía la página al enfocar un campo de texto de menos de 16 px, y el
 * desplazamiento que provoca deja la conversación fuera de la vista.
 */
export const FONT_SIZE_FLOOR_PX = 16;

/** La raíz del widget. */
export const ROOT_SELECTOR = ".chatbox";

/**
 * Los patrones con los que el campo de texto puede aparecer en un selector CSS.
 *
 * La guarda mira los tres porque los tres existen: la etiqueta (`textarea`), el id que le
 * pone el widget (`chatbox-question`) y la identidad del contrato de objetivos táctiles
 * (`question-field`). Buscar solo uno dejaría fuera a los otros dos: una regla que apuntara
 * al campo por su id entraría sin vigilar.
 *
 * Son patrones y no trozos de texto: una clase que se llamara `chatbox__textarea` no es el
 * campo de texto, y una guarda que la tomara por el campo avisaría de algo que no es.
 */
export const FIELD_SELECTOR_PATTERNS = [
	/(^|[\s,>+~(])textarea(?![\w-])/,
	/#chatbox-question(?![\w-])/,
	/\[data-chatbox-control=["']?question-field["']?\]/,
];

/**
 * Si un selector apunta al campo de texto.
 *
 * Un selector puede apuntar al campo y a otra cosa a la vez —`.chatbox textarea`—: basta
 * con que mentione una de las tres formas.
 */
export const targetsField = (selectors: string[]): boolean =>
	selectors.some((selector) => FIELD_SELECTOR_PATTERNS.some((pattern) => pattern.test(selector)));

/**
 * El interlineado del campo de texto, como múltiplo de su tamaño de fuente.
 *
 * Con el Stitch, 22 px sobre 16 px. Sin unidad en el CSS: un interlineado en px absolutos
 * contradiría al tamaño de fuente que la persona eligió en su navegador (RF-F50).
 */
export const LINE_HEIGHT_RATIO = 1.375;

/** La unidad del viewport dinámico: la que acompaña a la barra del navegador. */
export const DYNAMIC_VIEWPORT_UNIT = "dvh";

/**
 * Las unidades de viewport que el contrato rechaza.
 *
 * `vh` mide el viewport con la barra del navegador desplegada: en móvil, el pie del widget
 * quedaría por debajo de la pantalla. `lvh` es el viewport más alto —el mismo problema— y
 * `svh` el más bajo: el widget no llenaría la pantalla cuando la barra se recoge. Solo
 * `dvh` sigue a la barra.
 */
const REJECTED_VIEWPORT_UNITS = ["vh", "lvh", "svh"];

export type SafeAreaEdge = "top" | "right" | "bottom" | "left";

export type SafeArea = {
	/** La región del widget que toca el borde de la pantalla. */
	region: string;
	/** El borde de la pantalla. */
	edge: SafeAreaEdge;
	/** El padding que la región declara cuando no hay safe area. */
	base: string;
};

/**
 * Las safe areas del widget: qué región se separa de qué borde y con qué padding base.
 *
 * La safe area se **suma** al espaciado propio del widget, nunca lo sustituye: un notch o
 * el indicador de inicio empujan el contenido, pero el widget no pierde su propio espaciado.
 */
export const SAFE_AREAS: SafeArea[] = [
	{ region: ".chatbox__header", edge: "top", base: "0.75rem" },
	{ region: ".chatbox__header", edge: "left", base: "1rem" },
	{ region: ".chatbox__header", edge: "right", base: "1rem" },
	{ region: ".chatbox__conversation", edge: "left", base: "1rem" },
	{ region: ".chatbox__conversation", edge: "right", base: "1rem" },
	{ region: ".chatbox__footer", edge: "bottom", base: "0.75rem" },
	{ region: ".chatbox__footer", edge: "left", base: "1rem" },
	{ region: ".chatbox__footer", edge: "right", base: "1rem" },
];

/** Una razón por la que la hoja de estilos viola el contrato. */
export type Violation = { reason: string };

/** Las unidades que aparecen en un valor CSS. */
const unitsIn = (value: string): string[] =>
	[...value.matchAll(/(-?\d*\.?\d+)([a-z%]*)/gi)].map((match) => (match[2] ?? "").toLowerCase());

export type FontSizeDeclaration = {
	/** El suelo absoluto que garantiza, en px. */
	floor: number;
	/** Si la declaración deja sitio al tamaño de fuente que eligió la persona. */
	respectsUserSize: boolean;
};

/**
 * El suelo de tamaño de fuente que declara una propiedad, si lo declara.
 *
 * La forma que el contrato exige es `max(<tamaño del host>, 16px)`: un suelo absoluto que
 * no depende de la raíz del sitio host —con una raíz de 14 px, `1rem` a secas vale 14 px y
 * iOS Safari amplía la página al enfocar el campo— y, a la vez, deja sitio al tamaño de
 * fuente que la persona eligió en su navegador, que el `rem` sí recoge.
 *
 * `null` cuando la declaración no tiene esa forma.
 */
export const parseFontSize = (value: string): FontSizeDeclaration | null => {
	const max = /^max\((.+)\)$/i.exec(value.trim());
	if (!max) return null;

	const arguments_ = max[1].split(",").map((argument) => argument.trim());
	const absolute = arguments_.filter((argument) => /^(-?\d*\.?\d+)px$/i.test(argument));
	// El término relativo tiene que ser el tamaño de la raíz: `0.5rem` no respetaría el
	// tamaño que la persona eligió, porque nunca llegaría a valer más que el suelo.
	const relative = arguments_.filter((argument) => /^1rem$/i.test(argument.trim()));
	if (absolute.length === 0 || relative.length === 0) return null;

	return {
		floor: Math.max(...absolute.map((argument) => Number.parseFloat(argument))),
		respectsUserSize: relative.length > 0,
	};
};

export type SafeAreaPadding = {
	/** El padding propio del widget, al que se le suma el inset. */
	base: string;
	/** El borde de la pantalla que lee el inset. */
	inset: string;
	/** El valor de reserva del inset: sin él, la declaración puede quedar inválida. */
	fallback: string | undefined;
};

/**
 * El padding que declara una región para un borde, si es el que exige el contrato.
 *
 * `max(<padding base>, env(safe-area-inset-<edge>, <reserva>))`: la safe area se suma al
 * espaciado propio del widget. El borde se lee del propio valor y no de un parámetro: la
 * declaración dice de qué borde habla.
 */
export const parseSafeAreaPadding = (value: string): SafeAreaPadding | null => {
	const match = /^max\((.+?),\s*env\(safe-area-inset-(\w+)(?:,\s*([^)]+))?\)\)$/i.exec(
		value.trim()
	);
	if (!match) return null;
	return {
		base: match[1].trim(),
		inset: match[2].toLowerCase(),
		fallback: match[3]?.trim(),
	};
};

const EDGE_POSITION: Record<SafeAreaEdge, number> = { top: 0, right: 1, bottom: 2, left: 3 };

/** El valor del shorthand `padding` que corresponde a un borde. */
const edgeOfShorthand = (shorthand: string, edge: SafeAreaEdge): string => {
	const parts = shorthand.trim().split(/\s+/);
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return edge === "top" || edge === "bottom" ? parts[0] : parts[1];
	if (parts.length === 3) {
		if (edge === "top") return parts[0];
		return edge === "bottom" ? parts[2] : parts[1];
	}
	return parts[EDGE_POSITION[edge]];
};

/** Un valor de padding y de dónde sale: del atajo o del `longhand`. */
type PaddingEntry = { value: string; fromShorthand: boolean };

/**
 * Los valores de padding que rigen para una región y un borde, en orden de cascada.
 *
 * Se recogen **todas** las reglas que apuntan a la región, no solo la primera: una regla
 * posterior que volviera a declarar el padding ganaría por orden de cascada y dejaría el
 * widget sin safe area sin que nadie se enterara.
 */
const paddingEntries = (root: Root, region: string, edge: SafeAreaEdge): PaddingEntry[] => {
	const entries: PaddingEntry[] = [];

	for (const rule of rulesWithSelector(root, region)) {
		for (const node of rule.nodes) {
			if (node.type !== "decl") continue;
			const prop = node.prop.toLowerCase();
			if (prop === `padding-${edge}`) {
				entries.push({ value: node.value, fromShorthand: false });
				continue;
			}
			if (prop === "padding") {
				entries.push({ value: edgeOfShorthand(node.value, edge), fromShorthand: true });
			}
		}
	}

	return entries;
};

/** Las propiedades CSS que declaran una altura. */
const HEIGHT_PROPERTIES = ["height", "max-height", "min-height"];

/** Las violaciones de la regla de altura. */
const heightViolations = (root: Root): Violation[] => {
	const violations: Violation[] = [];
	const rootRule = ruleFor(root, ROOT_SELECTOR);
	const cap = rootRule ? declarationsOf(rootRule)["max-height"] : undefined;

	if (cap === undefined) {
		violations.push({
			reason: `«${ROOT_SELECTOR}» no declara el tope de altura («max-height»)`,
		});
	} else if (!unitsIn(cap).includes(DYNAMIC_VIEWPORT_UNIT)) {
		violations.push({
			reason: `el tope de altura de «${ROOT_SELECTOR}» no usa la unidad «${DYNAMIC_VIEWPORT_UNIT}»: «${cap}»`,
		});
	}

	root.walkDecls((declaration) => {
		if (!HEIGHT_PROPERTIES.includes(declaration.prop.toLowerCase())) return;
		for (const unit of unitsIn(declaration.value)) {
			if (!REJECTED_VIEWPORT_UNITS.includes(unit)) continue;
			violations.push({
				reason: `«${declaration.prop}: ${declaration.value}» usa la unidad «${unit}», que no acompaña a la barra del navegador`,
			});
		}
	});

	return violations;
};

/** Las violaciones de la regla de safe areas. */
const safeAreaViolations = (root: Root): Violation[] => {
	const violations: Violation[] = [];

	for (const area of SAFE_AREAS) {
		if (rulesWithSelector(root, area.region).length === 0) {
			violations.push({ reason: `falta la regla «${area.region}»` });
			continue;
		}

		const entries = paddingEntries(root, area.region, area.edge);
		if (entries.length === 0) {
			violations.push({
				reason: `«${area.region}» no declara el padding del borde «${area.edge}»`,
			});
			continue;
		}

		const effective = entries[entries.length - 1];
		const parsed = parseSafeAreaPadding(effective.value);
		if (!parsed) {
			violations.push({
				reason: `el padding «${area.edge}» de «${area.region}» no suma la safe area: «${effective.value}»`,
			});
			continue;
		}
		if (parsed.inset !== area.edge) {
			violations.push({
				reason: `el padding «${area.edge}» de «${area.region}» lee la safe area de «${parsed.inset}»`,
			});
			continue;
		}
		if (parsed.fallback === undefined) {
			violations.push({
				reason: `el inset de «${area.region}» no declara un valor de reserva: sin él, una declaración inválida deja el borde sin padding`,
			});
			continue;
		}
		if (parsed.base !== area.base) {
			violations.push({
				reason: `el padding «${area.edge}» de «${area.region}» parte de «${parsed.base}» y el contrato declara «${area.base}»`,
			});
			continue;
		}

		const own = entries.filter((entry) => entry.fromShorthand).pop();
		if (own === undefined) {
			violations.push({
				reason: `«${area.region}» no declara el padding base del borde «${area.edge}»`,
			});
			continue;
		}
		if (own.value !== area.base) {
			violations.push({
				reason: `el padding base del borde «${area.edge}» de «${area.region}» es «${own.value}» y el contrato declara «${area.base}»`,
			});
		}
	}

	return violations;
};

/**
 * Las declaraciones que fijan el tamaño de fuente del campo de texto.
 *
 * El atajo `font` cuenta: fija también el tamaño, y `font: inherit` le traería al campo el
 * tamaño del widget —14 px— sin suelo ninguno.
 */
const fontSizeDeclarations = (root: Root): { selector: string; prop: string; value: string }[] => {
	const found: { selector: string; prop: string; value: string }[] = [];

	root.walkRules((rule) => {
		if (!targetsField(rule.selectors)) return;
		for (const node of rule.nodes) {
			if (node.type !== "decl") continue;
			const prop = node.prop.toLowerCase();
			if (prop !== "font-size" && prop !== "font") continue;
			found.push({ selector: rule.selector, prop: node.prop, value: node.value });
		}
	});

	return found;
};

/**
 * Las violaciones de la regla del interlineado.
 *
 * El interlineado del campo tiene que acompañar a su tamaño de fuente: en px absolutos
 * contradice al tamaño que la persona eligió en su navegador. El que hereda el widget —20 px,
 * absolutos— también lo contradice, y por eso el campo declara el suyo.
 */
const lineHeightViolations = (root: Root): Violation[] => {
	const violations: Violation[] = [];

	root.walkRules((rule) => {
		if (!targetsField(rule.selectors)) return;
		for (const node of rule.nodes) {
			if (node.type !== "decl") continue;
			if (node.prop.toLowerCase() !== "line-height") continue;
			if (!/\d(px|pt|pc)\b/i.test(node.value)) continue;
			violations.push({
				reason: `«${rule.selector} { line-height: ${node.value} }» fija el interlineado en una unidad absoluta: no acompaña al tamaño de fuente`,
			});
		}
	});

	return violations;
};

/** Las violaciones de la regla del suelo de tamaño de fuente. */
const fontSizeViolations = (root: Root): Violation[] => {
	const violations: Violation[] = [];
	const declarations = fontSizeDeclarations(root);

	if (declarations.length === 0) {
		violations.push({ reason: "el campo de texto no declara su tamaño de fuente" });
		return violations;
	}

	if (declarations.length > 1) {
		const listed = declarations
			.map((declaration) => `${declaration.selector} { ${declaration.prop}: ${declaration.value} }`)
			.join(", ");
		violations.push({
			reason: `el tamaño del campo de texto lo declara más de una declaración: ${listed}`,
		});
		return violations;
	}

	const [only] = declarations;
	const parsed = parseFontSize(only.value);
	if (parsed === null) {
		violations.push({
			reason: `«${only.prop}: ${only.value}» no es un suelo con la forma «max(<tamaño del host>, ${FONT_SIZE_FLOOR_PX}px)»`,
		});
		return violations;
	}
	if (parsed.floor < FONT_SIZE_FLOOR_PX) {
		violations.push({
			reason: `«${only.prop}: ${only.value}» garantiza ${parsed.floor} px y el suelo es ${FONT_SIZE_FLOOR_PX} px`,
		});
	}

	return violations;
};

/**
 * Las violaciones del contrato de viewport móvil en una hoja de estilos.
 *
 * Función pura sobre el árbol ya parseado: la guarda la usa contra la hoja real del widget
 * —parseada una sola vez, por el módulo que la comparte con el resto de verificaciones— y el
 * test la usa contra hojas escritas a mano. Un verificador que nunca rechaza no protege
 * nada, así que cada regla tiene su entrada que la hace morder.
 */
export const findViewportViolations = (root: Root): Violation[] => [
	...heightViolations(root),
	...safeAreaViolations(root),
	...fontSizeViolations(root),
	...lineHeightViolations(root),
];
