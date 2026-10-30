import assert from "node:assert";
import { test } from "node:test";
import fastify from "fastify";
import db from "../../src/plugins/db";
import { documentEmbeddingsService } from "../../src/services/documentEmbeddings";
import { embeddingConfig } from "../../src/services/embedding.config";
import documentService from "../../src/services/documents";

/**
 * El vector entra y sale de PostgreSQL.
 *
 * El embedding es de mentira —un vector determinista de la dimensión configurada—:
 * lo que se comprueba aquí es el viaje por pgvector, no lo que devuelva Gemini. La
 * dimensión es la de la configuración, y el primer test la contrasta con la del
 * esquema: si las dos se desincronizan, la inserción falla y el esquema se lleva la
 * mano.
 *
 * Este es el único test que necesita una base de datos de verdad. Ni Groq ni Gemini:
 * la red no aparece por ninguna parte.
 */

const vectorOf = (dimension: number): number[] =>
	Array.from({ length: dimension }, (_, index) => (index % 10) / 10);

test("la dimensión configurada es la del esquema", async (t) => {
	const app = fastify();
	await app.register(db);
	await app.ready();
	t.after(() => void app.close());

	const { rows } = await app.pg.query<{ typmod: number }>(
		`SELECT atttypmod AS typmod
		   FROM pg_attribute
		  WHERE attrelid = 'document_chunks'::regclass
		    AND attname = 'embedding'
		    AND NOT attisdropped`,
	);

	assert.equal(rows.length, 1, "no se encontró la columna embedding");
	assert.equal(
		embeddingConfig.geminiVectorDimension,
		rows[0].typmod,
		"la dimensión configurada tiene que ser la de la columna embedding",
	);
});

test("un vector entra y sale de PostgreSQL", async (t) => {
	const app = fastify();
	await app.register(db);
	await app.ready();
	t.after(() => void app.close());

	const dimension = embeddingConfig.geminiVectorDimension;
	const service = documentEmbeddingsService(async () => ({
		embeddings: [{ values: vectorOf(dimension) }],
	}));

	const content = "Test vector insert and read via documentService.";
	const chunks = [content];
	const embeddedChunks = await service.getDocumentEmbeddings(
		"test-document-service.txt",
		chunks,
	);

	for (const embeddedChunk of embeddedChunks) {
		const embeddingArray = JSON.parse(embeddedChunk.embedding);
		assert.strictEqual(
			embeddingArray?.length,
			dimension,
			`Expected ${dimension} dimensions, got ${embeddingArray?.length}`,
		);
	}

	const { ingestDocument, getDocumentChunks } = documentService(app);
	const documentId = await ingestDocument({
		content,
		source: "test-document-service.txt",
		title: "Test Document",
		version: "1.0",
		chunks: embeddedChunks,
	});

	try {
		const dbChunks = await getDocumentChunks(documentId);

		assert.ok(dbChunks.length > 0, "Expected at least one chunk in document_chunks");

		const retrieved = JSON.parse(dbChunks[0].embedding);
		assert.strictEqual(
			retrieved.length,
			dimension,
			`Expected ${dimension} dimensions, got ${retrieved.length}`,
		);
		assert.deepStrictEqual(retrieved, JSON.parse(embeddedChunks[0].embedding));
	} finally {
		await app.pg.query("DELETE FROM documents WHERE id = $1", [documentId]);
	}
});
