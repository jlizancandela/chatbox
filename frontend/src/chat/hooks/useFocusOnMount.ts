import { useEffect } from "preact/hooks";

/**
 * Enfoca un elemento cuando se monta, y cada vez que `enabled` pasa a ser cierto.
 *
 * El segundo parámetro existe por el estado contraído del widget (RF-F64): el campo de
 * texto no está en el DOM mientras el widget está contraído, así que al abrirse el panel
 * el foco tiene que volver a él, y no solo cuando se monta el componente entero.
 */
export function useFocusOnMount(ref: { current: HTMLElement | null }, enabled = true): void {
	useEffect(() => {
		if (!enabled) return;
		ref.current?.focus();
	}, [enabled]);
}
