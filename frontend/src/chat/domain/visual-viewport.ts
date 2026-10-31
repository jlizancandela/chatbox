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
 * Todo lo que queda por debajo de la zona visible está bajo el teclado. Es también el tope
 * de lo que se puede reservar: por mucho que el widget se salga de debajo de la pantalla, el
 * teclado no tapa más que eso.
 */
export const keyboardStrip = (layoutHeight: number, area: VisibleArea): number =>
	Math.max(0, layoutHeight - area.bottom);

/**
 * La parte del borde inferior del widget que el teclado tapa.
 */
export const coveredByKeyboard = (bottom: number, area: VisibleArea): number =>
	Math.max(0, bottom - area.bottom);

/**
 * La franja que el widget tiene que reservar para que su pie —donde vive el campo de
 * texto— quede por encima del teclado.
 *
 * Tres cosas entran aquí, y las tres importan:
 *
 * - **`bottom` es el borde inferior de la caja del widget**, y `applied` lo que ya se ha
 *   reservado. La reserva vive en el padding de la raíz, así que el borde inferior de su
 *   caja de contenido —donde acaba el pie— es `bottom - applied`. Sin restarlo, la medida
 *   incluiría el efecto de la propia reserva y no se estabilizaría: la caja crecería en
 *   cada medida y la reserva con ella.
 * - **La zona visible es la del viewport visual**, con su desplazamiento: el borde
 *   inferior de lo que se ve no es el de la caja, sino el que publica el `visualViewport`.
 * - **No hay tope.** La reserva es la que hace falta para que el pie quede en el borde de
 *   la zona visible, ni más ni menos: un tope dejaría un hueco entre el pie y el teclado.
 *   Lo que evita que la reserva crezca sin control es la medida, que ya descuenta lo
 *   reservado.
 */
export const reservedInset = (bottom: number, applied: number, area: VisibleArea): number => {
	const contentBottom = bottom - applied;
	return coveredByKeyboard(contentBottom, area);
};
