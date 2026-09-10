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
	schema: {
		body: chatSchema,
	},
};

export { chatOptions };
