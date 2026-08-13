import type { FastifyInstance } from "fastify";

interface Document {
	id: number;
	title: string;
	content: string;
	source: string;
	version: string;
	created_at: Date;
}

interface NewDocument {
	title: string;
	content: string;
	source: string;
	version: string;
}

const createDocumentsRepository = (fastify: FastifyInstance) => {
	return {
		async getDocumentById(id: number) {
			return fastify.pg.query("SELECT * FROM documents WHERE id = $1", [id]);
		},
		async createDocument(document: NewDocument) {
			return fastify.pg.query(
				"INSERT INTO documents (title, content, source, version) VALUES ($1, $2, $3, $4) RETURNING *",
				[document.title, document.content, document.source, document.version],
			);
		},
		async updateDocument(id: number, document: NewDocument) {
			return fastify.pg.query(
				"UPDATE documents SET title = $1, content = $2, source = $3, version = $4 WHERE id = $5 RETURNING *",
				[document.title, document.content, document.source, document.version, id],
			);
		},
		async deleteDocument(id: number) {
			return fastify.pg.query("DELETE FROM documents WHERE id = $1", [id]);
		},
		async getAllDocuments() {
			return fastify.pg.query("SELECT * FROM documents");
		},
	};
};

export { createDocumentsRepository, type Document, type NewDocument };
