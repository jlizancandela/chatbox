/**
 * El ícono de los controles solo-icono del widget (RF-F64).
 *
 * Vive en un componente propio porque sus atributos son **críticos para la
 * accesibilidad**: un SVG decorativo tiene que quedar fuera del árbol de accesibilidad
 * (`aria-hidden`) y fuera del orden de tabulación (`focusable`). Basta que uno de los dos
 * controles se quede sin ellos para que el ícono se cuele en el nombre accesible de su
 * botón, y el nombre es lo que anuncia un lector de pantalla.
 */
export function Icon({ path }: { path: string }) {
	return (
		<svg class="chatbox__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d={path} />
		</svg>
	);
}
