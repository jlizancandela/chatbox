import type { FastifyInstance } from "fastify";
import documentRepository, {
	type DocumentChunk,
} from "../repositories/documents";

type IngestDocumentInput = {
	content: string;
	source: string;
	title: string;
	version: string;
	chunks: DocumentChunk[];
};

function documentService(app: FastifyInstance) {
	const ingestDocument = async ({
		content,
		source,
		title,
		version,
		chunks,
	}: IngestDocumentInput) =>
		app.pg.transact(async (client) => {
			const repository = documentRepository(client);
			const existingDocumentId = await repository.findIdBySourceAndVersion(
				source,
				version,
			);

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

	return { getDocumentChunks, ingestDocument };
}

export default documentService;
