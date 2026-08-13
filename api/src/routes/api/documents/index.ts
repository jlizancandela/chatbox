import type { FastifyPluginAsync } from "fastify";
import { createDocumentsController } from "../../../controllers/documents";
import { createDocumentsRepository } from "../../../repositories/documents";

const documents: FastifyPluginAsync = async (fastify) => {
	const controller = createDocumentsController(
		createDocumentsRepository(fastify),
	);

	fastify.get(
		"/",
		{
			schema: {
				response: {
					200: {
						type: "array",
						items: { $ref: "document#" },
					},
				},
			},
		},
		controller.getAll,
	);

	fastify.get(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
				response: { 200: { $ref: "document#" } },
			},
		},
		controller.getById,
	);

	fastify.post(
		"/",
		{
			schema: {
				body: { $ref: "newDocument#" },
				response: { 201: { $ref: "document#" } },
			},
		},
		controller.create,
	);

	fastify.put(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
				body: { $ref: "newDocument#" },
				response: { 200: { $ref: "document#" } },
			},
		},
		controller.update,
	);

	fastify.delete(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
			},
		},
		controller.remove,
	);
};

export default documents;
