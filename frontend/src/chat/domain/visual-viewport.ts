/**
 * Regla del teclado virtual (RF-F51).
 *
 * El navegador tiene dos viewports. El **de layout** es el que coloca el contenido y el que
 * miden las unidades `vh` y `dvh`; el **visual** es la parte de ese que está en la pantalla.
 * El teclado virtual encoge **el visual** y deja el de layout como estaba: por eso `dvh` no
 * baja cuando se abre el teclado, y por eso hace falta `visualViewport`.
 *
 * Las reglas viven aquí, puras, para que se puedan probar sin DOM y para que el test de
 * navegador derive de ellas su precondición en vez de adivinarla.
 */

/** La banda de la pantalla que se ve, en coordenadas del viewport de layout. */
export type VisibleArea = {
	/** El borde superior de la zona visible. */
	top: number;
	/** El borde inferior de la zona visible. */
	bottom: number;
};

/**
 * La zona visible, tal y como la publica `window.visualViewport`.
 *
 * `offsetTop` es el borde superior del viewport visual respecto del de layout, y `height` su
 * alto: los dos juntos dan la banda que está en la pantalla. El borde inferior es donde
 * empieza el teclado.
 */
export const visibleArea = (visualHeight: number, visualOffsetTop: number): VisibleArea => ({
	top: visualOffsetTop,
	bottom: visualOffsetTop + visualHeight,
});

/**
 * La franja del viewport de layout que el teclado virtual tapa.
 *
 * Todo lo que queda por debajo de la zona visible está bajo el teclado.
 */
export const keyboardStrip = (layoutHeight: number, area: VisibleArea): number =>
	Math.max(0, layoutHeight - area.bottom);

/**
 * La tolerancia con la que se acepta que el borde inferior del widget está en el borde
 * inferior de la pantalla.
 *
 * Un píxel: lo que separa a «toca el borde» de «lo que el navegador ha redondeado».
 */
export const ANCHOR_TOLERANCE_PX = 1;

/**
 * ¿Está la caja del widget anclada al borde inferior de la pantalla?
 *
 * Es la condición de la regla: un widget anclado abajo —un cajón a pantalla completa o un
 * panel flotante— es el que el teclado tapa, porque el navegador no lo puede desplazar al
 * enfocar el campo. Un widget embebido en una página no lo está, y el navegador lo
 * desplaza por su cuenta.
 */
export const isBottomAnchored = (widgetBottom: number, layoutHeight: number): boolean =>
	widgetBottom >= layoutHeight - ANCHOR_TOLERANCE_PX;

/**
 * La parte del borde inferior del widget que el teclado tapa.
 */
export const coveredByKeyboard = (widgetBottom: number, area: VisibleArea): number =>
	Math.max(0, widgetBottom - area.bottom);

/**
 * La franja que el widget tiene que reservar para que su pie —donde vive el campo de
 * texto— quede por encima del teclado.
 *
 * Es exactamente la parte del widget que queda bajo el teclado, y solo si el widget está
 * anclado abajo: en ese caso es el navegador el que no lo puede desplazar al enfocar el
 * campo. Un widget embebido en una página no reserva nada: el navegador ya lo desplaza, y
 * reservar franja de más solo encogería el hilo.
 *
 * Límite declarado: el widget reserva espacio **debajo** de su contenido, así que su caja
 * tiene que medir lo que el sitio host le da (RF-F50). Un host que le dé una altura
 * automática hace que la caja crezca al abrir el teclado —con el tope de `100dvh` como
 * límite—; el campo tampoco se libra, pero la conversación se sigue debajo de la caja.
 */
export const reservedInset = (
	widgetBottom: number,
	layoutHeight: number,
	area: VisibleArea
): number => {
	if (!isBottomAnchored(widgetBottom, layoutHeight)) return 0;
	return coveredByKeyboard(widgetBottom, area);
};
