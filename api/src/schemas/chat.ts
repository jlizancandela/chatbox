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
	},
};

const chatOptions = {
	bodyLimit: CHAT_BODY_LIMIT_BYTES,
	schema: {
		body: chatSchema,
	},
};

export { CHAT_BODY_LIMIT_BYTES, chatOptions };
