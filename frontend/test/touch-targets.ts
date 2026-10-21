/**
 * Contrato de objetivos táctiles del widget (RF-F43, issue #98).
 *
 * Fuente única del umbral y del inventario, compartida por los dos niveles de verificación
 * —mecanismo en jsdom y resolución en Chromium— para que no pueda haber dos definiciones de
 * «control inventariado» que diverjan. No es código de producción: vive con los tests.
 */

/** El suelo de RF-F43, en px CSS absolutos. */
export const TOUCH_TARGET_PX = 44;

/** El atributo con el que un control declara su identidad en el markup. */
export const CONTROL_ATTRIBUTE = "data-chatbox-control";

/** La regla que fija el suelo de todos los botones del widget. */
export const FLOOR_SELECTOR = ".chatbox button";

/**
 * Los estados del widget en los que se mide. Conjunto cerrado a propósito: `WidgetState` es
 * una unión de este array, así que un escenario con un estado mal escrito no compila.
 */
export const WIDGET_STATES = [
	"vacío",
	"campo lleno",
	"turno en curso",
	"confirmación abierta",
	"desplazado",
	"viewport estrecho",
] as const;

export type WidgetState = (typeof WIDGET_STATES)[number];

export type Control = {
	/** Identidad: el valor de `CONTROL_ATTRIBUTE` con el que el control se declara. */
	id: string;
	/** Cómo lo llama la gente, para que un informe se lea sin abrir el inventario. */
	name: string;
	/**
	 * Estados en los que el control está **activo** y se mide.
	 *
	 * No «en los que aparece»: un control deshabilitado aparece y no se mide (exención de
	 * WCAG 2.5.8). Cada control que la suite de navegador encuentra activo tiene que declarar
	 * el estado en el que lo ha encontrado, y el aserto lo comprueba al medir.
	 */
	states: WidgetState[];
};

/** Los controles que el widget mide en cada estado en que aparecen. */
export const CONTROLS: Control[] = [
	{ id: "send", name: "Enviar / Detener", states: ["campo lleno", "turno en curso"] },
	{
		id: "new-conversation",
		name: "Nueva conversación",
		states: ["vacío", "campo lleno", "turno en curso", "desplazado", "viewport estrecho"],
	},
	{ id: "confirm-accept", name: "Aceptar", states: ["confirmación abierta"] },
	{ id: "confirm-cancel", name: "Cancelar", states: ["confirmación abierta"] },
	{
		id: "suggestion",
		name: "Sugerencia",
		states: ["vacío", "campo lleno", "confirmación abierta", "viewport estrecho"],
	},
	{ id: "scroll-to-end", name: "Ir al final", states: ["desplazado"] },
];

export const CONTROL_IDS: ReadonlySet<string> = new Set(CONTROLS.map((control) => control.id));

/**
 * Controles que existen y quedan fuera de la medición, con su motivo.
 *
 * La guarda mira todos los elementos interactivos, incluidos los que el alcance excluye:
 * la exclusión se declara aquí, con su motivo, en vez de desaparecer del detector. Un
 * elemento que sale del contrato con el motivo escrito sigue dentro de la guarda; uno que
 * se cuela sin declarar, no.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
	"inline-link": "enlace en línea: excepción *inline* de WCAG 2.5.8 (RF-F43)",
	"question-field": "campo de texto: un campo no es un control de activación (RF-F43)",
};

/** Identidades que la guarda acepta: las que se miden y las exentas con su motivo. */
export const KNOWN_IDS: ReadonlySet<string> = new Set([...CONTROL_IDS, ...Object.keys(EXEMPT)]);

export type DeclaredSize = { value: number; unit: string };

const SIZE = /^(-?\d*\.?\d+)([a-z%]*)$/;

/** El tamaño que declara una propiedad CSS, con su unidad. `null` si no se puede leer. */
export function declaredSize(declaration: string | undefined): DeclaredSize | null {
	const match = SIZE.exec((declaration ?? "").trim());
	if (!match) return null;
	return { value: Number(match[1]), unit: match[2] };
}

/**
 * Si una declaración fija el suelo del contrato: 44 px CSS absolutos.
 *
 * Un `2.75rem` no lo fija aunque en la página de test valga exactamente lo mismo que
 * 44 px: depende del `font-size` raíz del sitio host, y con una raíz de 14 px deja el control
 * en 38,5 px. Esa es exactamente la regresión que el navegador de test no puede ver.
 */
export function isFloor(size: DeclaredSize | null): boolean {
	return size !== null && size.value === TOUCH_TARGET_PX && size.unit === "px";
}
