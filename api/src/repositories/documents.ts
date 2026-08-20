import type { FastifyInstance } from "fastify";

type TransactionCallback = Parameters<FastifyInstance["pg"]["transact"]>[0];
type TransactionClient = Parameters<TransactionCallback>[0];

export type DocumentChunk = {
	chunkIndex: number;
	text: string;
	embedding: string;
};

type InsertDocumentInput = {
	content: string;
	source: string;
	title: string;
	version: string;
};

function documentRepository(client: TransactionClient) {
	const findIdBySourceAndVersion = async (source: string, version: string) => {
		const result = await client.query<{ id: string }>(
			`SELECT id
			 FROM documents
			 WHERE source = $1 AND version = $2`,
			[source, version],
		);

		return result.rows[0]?.id;
	};

	const deactivateBySource = async (source: string) => {
		await client.query(
			`UPDATE documents
			 SET is_active = FALSE
			 WHERE source = $1 AND is_active = TRUE`,
			[source],
		);
	};

	const activateById = async (id: string) => {
		await client.query("UPDATE documents SET is_active = TRUE WHERE id = $1", [
			id,
		]);
	};

	const insertDocument = async ({
		content,
		source,
		title,
		version,
	}: InsertDocumentInput) => {
		const result = await client.query<{ id: string }>(
			`INSERT INTO documents (source, title, version, content)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
			[source, title, version, content],
		);
		const documentId = result.rows[0]?.id;
		if (!documentId) {
			throw new Error(`No document ID returned for source: ${source}`);
		}

		return documentId;
	};

	const insertChunks = async (documentId: string, chunks: DocumentChunk[]) => {
		for (const chunk of chunks) {
			await client.query(
				`INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
				 VALUES ($1, $2, $3, $4)`,
				[documentId, chunk.chunkIndex, chunk.text, chunk.embedding],
			);
		}
	};

	const findChunksByDocumentId = async (documentId: string) => {
		const result = await client.query<{
			chunk_index: number;
			content: string;
			embedding: string;
		}>(
			`SELECT chunk_index, content, embedding
			 FROM document_chunks
			 WHERE document_id = $1
			 ORDER BY chunk_index`,
			[documentId],
		);

		return result.rows;
	};

	return {
		activateById,
		deactivateBySource,
		findChunksByDocumentId,
		findIdBySourceAndVersion,
		insertChunks,
		insertDocument,
	};
}

export default documentRepository;
