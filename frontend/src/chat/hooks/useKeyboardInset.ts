import { useEffect, useRef, useState } from "preact/hooks";
import { keyboardStrip, reservedInset, visibleArea } from "../domain/visual-viewport";

/**
 * Mide la franja que tapa el teclado virtual y la publica en el widget (RF-F51).
 *
 * La medida sale de `window.visualViewport`: el teclado virtual encoge el viewport visual y
 * deja el de layout como estaba, así que `innerHeight` —y con él `dvh`— no se enteran. El
 * `visualViewport` sí: su `height` mengua y su `offsetTop` dice dónde está el borde
 * superior de lo que se ve.
 *
 * Lo que se mide es el borde inferior de la caja del widget, menos lo que ya se ha
 * reservado: así sale el borde inferior de su caja de contenido, que es donde acaba el pie
 * —donde vive el campo de texto—. Sin restar la reserva, la medida incluiría el efecto de
 * la propia reserva y no se estabilizaría: la caja crecería en cada medida, y la reserva
 * con ella.
 *
 * El hook devuelve el inset en píxeles para que el componente pueda reaccionar a él —el
 * hilo vuelve al final cuando el hilo pierde su final—, y el CSS lo aplica como una
 * variable en la raíz del widget.
 *
 * Con `enabled` a falso no se mide nada: contraído el widget no tiene panel, así que no
 * hay campo que tapar y la reserva solo estorbaría —el círculo se quedaría sin caja de
 * contenido— (RF-F64).
 */
export function useKeyboardInset(root: { current: HTMLElement | null }, enabled = true): number {
	const [inset, setInset] = useState(0);
	/** Lo último publicado: la medida siguiente tiene que descontarlo. */
	const applied = useRef(0);

	useEffect(() => {
		if (!enabled) {
			applied.current = 0;
			setInset(0);
			return;
		}

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
				applied.current = 0;
				setInset(0);
				return;
			}
			const next = reservedInset(element.getBoundingClientRect().bottom, applied.current, area);
			applied.current = next;
			setInset(next);
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
			view.removeEventListener?.("resize", measure);
			view.removeEventListener?.("scroll", measure);
		};
	}, [root, enabled]);

	return inset;
}
