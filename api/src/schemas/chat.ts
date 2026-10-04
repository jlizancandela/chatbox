const CHAT_BODY_LIMIT_BYTES = 16 * 1024;

const chatSchema = {
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
						maxLength: 2000,
					},
				},
			},
		},
	},
};

const chatOptions = {
	bodyLimit: CHAT_BODY_LIMIT_BYTES,
	schema: {
		body: chatSchema,
	},
};

export { CHAT_BODY_LIMIT_BYTES, chatOptions };
