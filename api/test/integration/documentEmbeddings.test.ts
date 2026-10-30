import assert from "node:assert";
import { test } from "node:test";
import fastify from "fastify";
import db from "../../src/plugins/db";
import { documentEmbeddingsService } from "../../src/services/documentEmbeddings";
import documentService from "../../src/services/documents";
import { EMBEDDING_DIMENSION } from "../../src/services/embedding.config";
import { vectorOf } from "../vector";

/**
 * El vector entra y sale de PostgreSQL.
 *
 * El embedding es de mentira —un vector determinista de la dimensión del esquema—:
 * lo que se comprueba aquí es el viaje por pgvector, no lo que devuelva el modelo. La
 * dimensión se contrasta con la del esquema: si las dos se desincronizan, la inserción
 * falla y el esquema se lleva la mano.
 *
 * Este test y el de recuperación son los únicos que necesitan una base de datos de
 * verdad. Ni Groq ni el modelo de embeddings: la red no aparece por ninguna parte.
 */

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
		    AND NOT attisdropped`
	);

	assert.equal(rows.length, 1, "no se encontró la columna embedding");
	assert.equal(
		EMBEDDING_DIMENSION,
		rows[0].typmod,
		"la dimensión del modelo tiene que ser la de la columna embedding"
	);
});

test("un vector entra y sale de PostgreSQL", async (t) => {
	const app = fastify();
	await app.register(db);
	await app.ready();
	t.after(() => void app.close());

	const dimension = EMBEDDING_DIMENSION;
	const service = documentEmbeddingsService(async () => vectorOf(dimension));

	const content = "Test vector insert and read via documentService.";
	const chunks = [content];
	const embeddedChunks = await service.getDocumentEmbeddings("test-document-service.txt", chunks);

	for (const embeddedChunk of embeddedChunks) {
		const embeddingArray = JSON.parse(embeddedChunk.embedding);
		assert.strictEqual(
			embeddingArray?.length,
			dimension,
			`Expected ${dimension} dimensions, got ${embeddingArray?.length}`
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
			`Expected ${dimension} dimensions, got ${retrieved.length}`
		);

		// pgvector guarda `float4`, así que el viaje redondea: lo que se comprueba es
		// que el vector vuelve, no que conserve la precisión de un `double` de JS.
		const saved = JSON.parse(embeddedChunks[0].embedding);
		for (const [index, value] of retrieved.entries()) {
			assert.ok(
				Math.abs(value - saved[index]) < 1e-6,
				`componente ${index}: ${value} != ${saved[index]}`
			);
		}
	} finally {
		await app.pg.query("DELETE FROM documents WHERE id = $1", [documentId]);
	}
});
