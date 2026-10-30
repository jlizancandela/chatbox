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
		/**
		 * El botón de contraer el chat (RF-F64). Es un botón solo-icono: su nombre visible no
		 * existe, así que el nombre accesible va declarado (RF-F45).
		 */
		collapse: { ariaLabel: "Contraer el chat" },
		confirm: {
			question: "¿Borrar la conversación?",
			accept: "Sí, borrar",
			cancel: "Cancelar",
		},
	},
	/**
	 * El lanzador: el control circular que abre el widget en su estado contraído (RF-F64).
	 * Como el botón de contraer, es solo-icono y declara su nombre accesible.
	 */
	launcher: {
		open: { ariaLabel: "Abrir el asistente de Jorge" },
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
		/**
		 * Cuota agotada del proveedor (#144). No es un fallo: el chat está ocupado y volver
		 * más tarde sirve. No promete una hora concreta porque el reintento no la garantiza.
		 */
		QUOTA_EXHAUSTED: "El asistente está ocupado ahora mismo. Vuelve a intentarlo más tarde.",
		/**
		 * Presupuesto de la conversación agotado (#148). No es un fallo del servicio: es el
		 * tope de esta conversación, y ofrece la salida —empezar una nueva—.
		 */
		SESSION_BUDGET_EXCEEDED:
			"Esta conversación ha llegado a su límite. Empieza una nueva para seguir preguntando.",
		INCOMPLETE_STREAM: "La respuesta se interrumpió.",
		TIMEOUT: "No se pudo conectar. Comprueba tu conexión.",
		QUESTION_INVALID: "No se pudo enviar esa pregunta.",
	},
	a11y: {
		conversationLabel: "Conversación",
		emptyStateNavLabel: "Preguntas sugeridas",
	},
} as const;
