import type { FastifyInstance } from "fastify";
import documentRepository, { type DocumentChunk } from "../repositories/documents";

type IngestDocumentInput = {
	content: string;
	source: string;
	title: string;
	version: string;
	chunks: DocumentChunk[];
};

function documentService(app: FastifyInstance) {
	const ingestDocument = async ({ content, source, title, version, chunks }: IngestDocumentInput) =>
		app.pg.transact(async (client) => {
			const repository = documentRepository(client);
			const existingDocumentId = await repository.findIdBySourceAndVersion(source, version);

			await repository.deactivateBySource(source);

			if (existingDocumentId) {
				await repository.activateById(existingDocumentId);
				return existingDocumentId;
			}

			const documentId = await repository.insertDocument({
				content,
				source,
				title,
				version,
			});
			await repository.insertChunks(documentId, chunks);

			return documentId;
		});

	const getDocumentChunks = async (documentId: string) =>
		app.pg.transact(async (client) => {
			const repository = documentRepository(client);
			return repository.findChunksByDocumentId(documentId);
		});

	/**
	 * ¿Está ya esta versión del documento?
	 *
	 * La ingesta lo pregunta **antes** de pedir los embeddings: si la respuesta es sí,
	 * el documento se reactiva y no se gasta ni una llamada al proveedor.
	 */
	const hasDocumentVersion = async (source: string, version: string) =>
		app.pg.transact(async (client) => {
			const repository = documentRepository(client);
			const existingId = await repository.findIdBySourceAndVersion(source, version);
			return existingId !== undefined;
		});

	return { getDocumentChunks, hasDocumentVersion, ingestDocument };
}

export default documentService;
