/**
 * Regla de movimiento del widget (RF-F44).
 *
 * La preferencia vive en el sistema operativo, no en el widget: el sitio host no la hereda
 * ni puede bajarla. Aquí solo vive la regla que la traduce a una decisión concreta —cómo se
 * desplaza la conversación—, para que se pueda probar sin DOM.
 *
 * La opción `behavior` de `scrollTo()` gana sobre la propiedad CSS `scroll-behavior`, así que
 * la decisión se toma en JS. El contrato del CSS declara `scroll-behavior: auto` en la caja
 * de scroll, y de ahí que `"auto"` signifique aquí "salto instantáneo".
 */

/** La consulta de la preferencia del sistema operativo. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * El comportamiento de scroll del widget: suave, salvo que la persona pida menos movimiento.
 *
 * `"auto"` no significa "instantáneo": delega en el `scroll-behavior` computado del
 * elemento. `"instant"` daría la misma garantía sin depender del CSS, pero no lo
 * garantizan todas las versiones de Safari y un valor inválido lanza `TypeError` — y el
 * widget se embebe en sitios que no controla.
 */
export const scrollBehavior = (reduceMotion: boolean): ScrollBehavior =>
	reduceMotion ? "auto" : "smooth";
