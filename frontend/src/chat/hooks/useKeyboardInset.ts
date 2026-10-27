import { useEffect, useState } from "preact/hooks";
import { keyboardStrip, reservedInset, visibleArea } from "../domain/visual-viewport";

/**
 * Mide la franja que tapa el teclado virtual y la publica en el widget (RF-F51).
 *
 * La medida sale de `window.visualViewport`: el teclado virtual encoge el viewport visual y
 * deja el de layout como estaba, así que `innerHeight` —y con él `dvh`— no se enteran. El
 * `visualViewport` sí: su `height` mengua y su `offsetTop` dice dónde está el borde
 * superior de lo que se ve.
 *
 * El hook devuelve el inset en píxeles para que el componente pueda reaccionar a él —el
 * hilo vuelve al final cuando el hilo pierde su final—, y el CSS lo aplica como una
 * variable en la raíz del widget.
 */
export function useKeyboardInset(root: { current: HTMLElement | null }): number {
	const [inset, setInset] = useState(0);

	useEffect(() => {
		const element = root.current;
		if (!element) return;

		// La ventana se guarda aquí: la limpieza puede correr cuando el entorno ya no
		// existe, y leer el global otra vez lanzaría.
		const view = window;
		const viewport = view.visualViewport;

		/**
		 * La altura del viewport de layout: la de su bloque contenedor inicial.
		 *
		 * No es `innerHeight`: esa incluye la barra de desplazamiento horizontal, y el
		 * `visualViewport` no. Con una barra horizontal, `innerHeight` daría una franja
		 * de teclado fantasma y el widget reservaría sitio sin que haya teclado.
		 */
		const layoutHeight = (): number => document.documentElement.clientHeight;

		const measure = (): void => {
			if (!viewport) return;
			const area = visibleArea(viewport.height, viewport.offsetTop);
			// Sin teclado no hay nada que reservar, y el widget no se ha movido: no hace
			// falta ni medir la caja.
			if (keyboardStrip(layoutHeight(), area) === 0) {
				setInset(0);
				return;
			}
			setInset(reservedInset(element.getBoundingClientRect().bottom, layoutHeight(), area));
		};

		measure();

		// El teclado abre y cierra: el `resize` del viewport visual es el aviso. El `scroll`
		// también, porque el navegador desplaza la página al enfocar el campo. Y el
		// `resize` de la ventana, porque la barra del navegador cambia el viewport visual.
		viewport?.addEventListener("resize", measure);
		viewport?.addEventListener("scroll", measure);
		view.addEventListener("resize", measure);
		view.addEventListener("scroll", measure);

		return () => {
			viewport?.removeEventListener("resize", measure);
			viewport?.removeEventListener("scroll", measure);
			view.removeEventListener("resize", measure);
			view.removeEventListener("scroll", measure);
		};
	}, [root]);

	return inset;
}
