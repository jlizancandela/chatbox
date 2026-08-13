import type { FastifyPluginAsync } from "fastify";
import {
	createDocumentsRepository,
	type NewDocument,
} from "../../../repositories/documents";

interface DocumentParams {
	id: number;
}

const documents: FastifyPluginAsync = async (fastify) => {
	const repository = createDocumentsRepository(fastify);

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
		async () => {
			const result = await repository.getAllDocuments();
			return result.rows;
		},
	);

	fastify.get<{ Params: DocumentParams }>(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
				response: { 200: { $ref: "document#" } },
			},
		},
		async (request, reply) => {
			const result = await repository.getDocumentById(request.params.id);
			const document = result.rows[0];

			if (!document) {
				return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
			}

			return document;
		},
	);

	fastify.post<{ Body: NewDocument }>(
		"/",
		{
			schema: {
				body: { $ref: "newDocument#" },
				response: { 201: { $ref: "document#" } },
			},
		},
		async (request, reply) => {
			const result = await repository.createDocument(request.body);
			return reply.code(201).send(result.rows[0]);
		},
	);

	fastify.put<{ Params: DocumentParams; Body: NewDocument }>(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
				body: { $ref: "newDocument#" },
				response: { 200: { $ref: "document#" } },
			},
		},
		async (request, reply) => {
			const result = await repository.updateDocument(
				request.params.id,
				request.body,
			);
			const document = result.rows[0];

			if (!document) {
				return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
			}

			return document;
		},
	);

	fastify.delete<{ Params: DocumentParams }>(
		"/:id",
		{
			schema: {
				params: { $ref: "documentIdParams#" },
			},
		},
		async (request, reply) => {
			const result = await repository.deleteDocument(request.params.id);

			if (result.rowCount === 0) {
				return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
			}

			return reply.code(204).send();
		},
	);
};

export default documents;
