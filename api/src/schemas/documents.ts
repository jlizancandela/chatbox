const documentSchema = {
	$id: "document",
	type: "object",
	additionalProperties: false,
	properties: {
		id: { type: "integer", minimum: 1 },
		title: { type: "string", minLength: 1 },
		content: { type: "string", minLength: 1 },
		source: { type: "string", minLength: 1 },
		version: { type: "string", minLength: 1 },
		is_active: { type: "boolean" },
		created_at: { type: "string", format: "date-time" },
	},
	required: [
		"id",
		"title",
		"content",
		"source",
		"version",
		"is_active",
		"created_at",
	],
} as const;

const newDocumentSchema = {
	$id: "newDocument",
	type: "object",
	additionalProperties: false,
	properties: {
		title: { type: "string", minLength: 1 },
		content: { type: "string", minLength: 1 },
		source: { type: "string", minLength: 1 },
		version: { type: "string", minLength: 1 },
	},
	required: ["title", "content", "source", "version"],
} as const;

const documentIdParamsSchema = {
	$id: "documentIdParams",
	type: "object",
	additionalProperties: false,
	properties: {
		id: { type: "integer", minimum: 1 },
	},
	required: ["id"],
} as const;

export {
	documentIdParamsSchema,
	documentSchema,
	newDocumentSchema,
};
