import assert from "node:assert";
import { test } from "node:test";
import { RecursiveChunker } from "@chonkiejs/core";
import fastify from "fastify";
import db from "../../src/plugins/db";
import { documentEmbeddingsService } from "../../src/services/documentEmbeddings";
import documentService from "../../src/services/documents";

test("Must generate an 768-dimensional embedding", async () => {
	const service = documentEmbeddingsService();

	const chunker = await RecursiveChunker.create({
		chunkSize: 512,
	});

	const content = "This is a test document to generate embeddings.";
	const chunks = await chunker.chunk(content);

	const embeddedChunks = await service.getDocumentEmbeddings(
		"test-document.txt",
		chunks,
	);

	for (const embeddedChunk of embeddedChunks) {
		const embeddingArray = JSON.parse(embeddedChunk.embedding);
		assert.strictEqual(
			embeddingArray?.length,
			768,
			`Expected embedding dimension to be 768, but got ${embeddingArray?.length}`,
		);
	}
});

test("Must insert and read a 768-dimensional vector via documentService", async () => {
	const app = fastify();
	await app.register(db);
	await app.ready();

	try {
		const embeddingsService = documentEmbeddingsService();
		const chunker = await RecursiveChunker.create({ chunkSize: 512 });
		const chunks = await chunker.chunk("Test vector insert and read via documentService.");
		const embeddedChunks = await embeddingsService.getDocumentEmbeddings(
			"test-document-service.txt",
			chunks,
		);

		const { ingestDocument, getDocumentChunks } = documentService(app);
		const documentId = await ingestDocument({
			content: "Test vector insert and read via documentService.",
			source: "test-document-service.txt",
			title: "Test Document",
			version: "1.0",
			chunks: embeddedChunks,
		});

		const dbChunks = await getDocumentChunks(documentId);

		assert.ok(dbChunks.length > 0, "Expected at least one chunk in document_chunks");

		const retrieved = JSON.parse(dbChunks[0].embedding);
		assert.strictEqual(
			retrieved.length,
			768,
			`Expected 768 dimensions, got ${retrieved.length}`,
		);
		assert.deepStrictEqual(retrieved, JSON.parse(embeddedChunks[0].embedding));

		await app.pg.query("DELETE FROM documents WHERE id = $1", [documentId]);
	} finally {
		await app.close();
	}
});
