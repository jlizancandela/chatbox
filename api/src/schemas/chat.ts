const CHAT_BODY_LIMIT_BYTES = 16 * 1024;

/**
 * El esquema se construye con el límite de historial configurado.
 *
 * El recorte del servicio y la validación de la ruta tienen que medir lo mismo: con
 * un `maxLength` fijo, un mensaje por encima de `HISTORY_MAX_MESSAGE_CHARS` pasaba
 * la validación y se truncaba en silencio. RF-20a pide rechazarlo con `400`.
 */
const createChatSchema = (historyMaxChars: number) => ({
	type: "object",
	required: ["question"],
	additionalProperties: false,
	properties: {
		question: {
			type: "string",
			minLength: 1,
		},
		history: {
			type: "array",
			items: {
				type: "object",
				required: ["role", "content"],
				additionalProperties: false,
				properties: {
					role: { type: "string", enum: ["user", "assistant"] },
					content: {
						type: "string",
						maxLength: historyMaxChars,
					},
				},
			},
		},
	},
});

const createChatOptions = (historyMaxChars: number) => ({
	bodyLimit: CHAT_BODY_LIMIT_BYTES,
	schema: {
		body: createChatSchema(historyMaxChars),
	},
});

export { CHAT_BODY_LIMIT_BYTES, createChatOptions };
