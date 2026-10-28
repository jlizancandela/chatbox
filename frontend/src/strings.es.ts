/**
 * Todo el texto de la interfaz del widget, en un único sitio (RF-F62).
 *
 * `strings.es.ts` es un módulo interno: no se expone como prop ni como contrato
 * público. El sitio host ajusta contenido con las props del componente; los textos
 * del widget se cambian aquí.
 *
 * Conjuntos cerrados (rol del autor) y pares etiqueta/aria-label se modelan como
 * registros.
 * La única función es el contador de caracteres, la única interpolación real.
 */

export const strings = {
	header: {
		defaultTitle: "Asistente de Jorge",
		badge: "IA",
		scopeNotice: "Responde solo con información del CV y GitHub de Jorge. Puede equivocarse.",
	},
	emptyState: {
		prompt: "¿En qué te gustaría saber más sobre Jorge?",
		suggestions: [
			"¿Qué experiencia tiene Jorge?",
			"¿Qué stack tecnológico usa Jorge?",
			"¿Cómo puedo contactar con Jorge?",
		],
	},
	input: {
		label: "Escribe tu pregunta",
		placeholder: "Pregunta sobre la experiencia de Jorge",
		contactLink: "Contactar con Jorge",
		send: { label: "Enviar", ariaLabel: "Enviar pregunta" },
		stop: { label: "Detener", ariaLabel: "Detener respuesta" },
		chars: (current: number, max: number): string => `${current}/${max}`,
	},
	messages: {
		author: { user: "Tú", assistant: "Asistente" },
		writing: "El asistente está escribiendo",
		stopped: "Respuesta detenida",
		listLabel: "Mensajes",
		/**
		 * La línea de fuentes. Es una interpolación real como el contador de caracteres: el
		 * texto es fijo y lo que cambia son los títulos de los documentos.
		 */
		sources: (titles: readonly string[]): string => `Fuentes: ${titles.join(", ")}`,
	},
	actions: {
		scrollToEnd: "Ir al final",
		retry: "Reintentar",
		newConversation: "Nueva conversación",
		confirm: {
			question: "¿Borrar la conversación?",
			accept: "Sí, borrar",
			cancel: "Cancelar",
		},
	},
	notices: {
		noContext:
			"Eso no lo tengo en la información que manejo. Puedes escribirle a Jorge directamente.",
		contextTrimmed: "Los mensajes más antiguos ya no forman parte del contexto.",
	},
	errors: {
		HTTP_400: "No se pudo enviar esa pregunta.",
		HTTP_413: "La conversación es demasiado larga. Empieza una nueva.",
		HTTP_429: "Has alcanzado el límite de preguntas. Inténtalo más tarde.",
		HTTP_SERVER: "Algo ha fallado. Inténtalo de nuevo.",
		NETWORK_ERROR: "No se pudo conectar. Comprueba tu conexión.",
		STREAM_ERROR: "No he podido completar la respuesta.",
		INCOMPLETE_STREAM: "La respuesta se interrumpió.",
		TIMEOUT: "No se pudo conectar. Comprueba tu conexión.",
		QUESTION_INVALID: "No se pudo enviar esa pregunta.",
	},
	a11y: {
		conversationLabel: "Conversación",
		emptyStateNavLabel: "Preguntas sugeridas",
	},
} as const;
