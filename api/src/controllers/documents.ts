import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	DocumentsRepository,
	NewDocument,
} from "../repositories/documents";

interface DocumentParams {
	id: number;
}

const createDocumentsController = (repository: DocumentsRepository) => ({
	getAll: async () => {
		const result = await repository.getAllDocuments();
		return result.rows;
	},

	getById: async (
		request: FastifyRequest<{ Params: DocumentParams }>,
		reply: FastifyReply,
	) => {
		const result = await repository.getDocumentById(request.params.id);
		const document = result.rows[0];

		if (!document) {
			return reply.code(404).send({
				error: {
					code: "DOCUMENT_NOT_FOUND",
					message: "Document not found",
				},
			});
		}

		return document;
	},

	create: async (
		request: FastifyRequest<{ Body: NewDocument }>,
		reply: FastifyReply,
	) => {
		const result = await repository.createDocument(request.body);
		return reply.code(201).send(result.rows[0]);
	},

	update: async (
		request: FastifyRequest<{ Params: DocumentParams; Body: NewDocument }>,
		reply: FastifyReply,
	) => {
		const result = await repository.updateDocument(
			request.params.id,
			request.body,
		);
		const document = result.rows[0];

		if (!document) {
			return reply.code(404).send({
				error: {
					code: "DOCUMENT_NOT_FOUND",
					message: "Document not found",
				},
			});
		}

		return document;
	},

	remove: async (
		request: FastifyRequest<{ Params: DocumentParams }>,
		reply: FastifyReply,
	) => {
		const result = await repository.deleteDocument(request.params.id);

		if (result.rowCount === 0) {
			return reply.code(404).send({
				error: {
					code: "DOCUMENT_NOT_FOUND",
					message: "Document not found",
				},
			});
		}

		return reply.code(204).send();
	},
});

export { createDocumentsController };
