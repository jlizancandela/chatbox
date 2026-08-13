import type { FastifyInstance } from "fastify";

interface Document {
	id: number;
	title: string;
	content: string;
	source: string;
	version: string;
	is_active: boolean;
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
			const client = await fastify.pg.connect();

			try {
				await client.query("BEGIN");
				await client.query(
					"UPDATE documents SET is_active = FALSE WHERE source = $1 AND is_active = TRUE",
					[document.source],
				);
				const result = await client.query(
					"INSERT INTO documents (title, content, source, version) VALUES ($1, $2, $3, $4) RETURNING *",
					[document.title, document.content, document.source, document.version],
				);
				await client.query("COMMIT");
				return result;
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			} finally {
				client.release();
			}
		},
		async updateDocument(id: number, document: NewDocument) {
			const client = await fastify.pg.connect();

			try {
				await client.query("BEGIN");
				await client.query(
					"UPDATE documents SET is_active = FALSE WHERE source = $1 AND is_active = TRUE AND id <> $2 AND EXISTS (SELECT 1 FROM documents WHERE id = $2)",
					[document.source, id],
				);
				const result = await client.query(
					"UPDATE documents SET title = $1, content = $2, source = $3, version = $4, is_active = TRUE WHERE id = $5 RETURNING *",
					[document.title, document.content, document.source, document.version, id],
				);
				await client.query("COMMIT");
				return result;
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			} finally {
				client.release();
			}
		},
		async deleteDocument(id: number) {
			return fastify.pg.query("DELETE FROM documents WHERE id = $1", [id]);
		},
		async getAllDocuments() {
			return fastify.pg.query("SELECT * FROM documents");
		},
	};
};

type DocumentsRepository = ReturnType<typeof createDocumentsRepository>;

export {
	createDocumentsRepository,
	type Document,
	type DocumentsRepository,
	type NewDocument,
};
