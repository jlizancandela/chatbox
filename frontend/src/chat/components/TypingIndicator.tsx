/**
 * El indicador de escritura (RF-F44): los tres puntos que marcan que la respuesta está en
 * camino.
 *
 * Vive en la capa de renderizado del chat porque aparece en dos sitios: en la burbuja del
 * asistente vacío y, mientras el markdown se carga, en la burbuja que ya tiene el texto pero
 * todavía no lo puede pintar.
 *
 * Es decorativo (`aria-hidden`): el aviso "El asistente está escribiendo" lo anuncia la
 * región de estado, y el texto de la respuesta lo anuncia su desenlace.
 */
export function TypingIndicator() {
	return (
		<span class="chatbox__typing" aria-hidden="true">
			<span class="chatbox__typing-dot" />
			<span class="chatbox__typing-dot" />
			<span class="chatbox__typing-dot" />
		</span>
	);
}
