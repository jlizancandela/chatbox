import assert from "node:assert";
import { test } from "node:test";
import fastify from "fastify";
import { fakeGroq } from "../helper";
import db from "../../src/plugins/db";
import { chatService } from "../../src/services/chat";
import { documentEmbeddingsService } from "../../src/services/documentEmbeddings";
import { embeddingService } from "../../src/services/embedding";
import { EMBEDDING_DIMENSION } from "../../src/services/embedding.config";
import documentService from "../../src/services/documents";

/**
 * La recuperación de punta a punta, con un embedder determinista.
 *
 * No mide la calidad del modelo: comprueba que el vector de la pregunta viaja hasta
 * pgvector y que el fragmento correcto vuelve el primero. El embedder de mentira
 * enciende una dimensión por palabra clave, así que el ranking es predecible y el
 * test no depende de la red ni de los pesos.
 */

const KEYWORDS = ["reservas", "wordpress"];

const keywordEmbedder = () => async (text: string): Promise<number[]> => {
	const values = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
	values[EMBEDDING_DIMENSION - 1] = 0.01;

	for (const [index, keyword] of KEYWORDS.entries()) {
		if (text.toLowerCase().includes(keyword)) {
			values[index] = 1;
		}
	}

	return values;
};

const SOURCE = "test-retrieval.txt";

test("una pregunta del corpus devuelve el fragmento correcto como primero", async (t) => {
	const app = fastify();
	await app.register(db);
	await app.ready();
	t.after(() => void app.close());

	const embedContent = keywordEmbedder();
	const documents = documentService(app);
	const embeddings = documentEmbeddingsService(embedContent);

	const corpus = [
		{ index: 0, text: "El proyecto de reservas usa PHP y MySQL." },
		{ index: 1, text: "El sitio de WordPress usa Elementor." },
	];

	const documentId = await documents.ingestDocument({
		content: corpus.map((chunk) => chunk.text).join("\n"),
		source: SOURCE,
		title: "Corpus de prueba",
		version: "1.0",
		chunks: await embeddings.getDocumentEmbeddings(
			SOURCE,
			corpus.map((chunk) => chunk.text),
			"Corpus de prueba",
		),
	});

	try {
		const { retrieve } = chatService({
			pg: app.pg,
			groqClient: fakeGroq([]).client,
			modelDefault: "test-model",
			embedText: embeddingService(embedContent).embedText,
		});

		const sources = await retrieve("¿Qué proyecto de reservas hay?");

		assert.ok(sources.length > 0, "esperaba al menos un fragmento");
		assert.strictEqual(
			sources[0].content,
			corpus[0].text,
			"el fragmento de reservas tiene que quedar primero",
		);
	} finally {
		await app.pg.query("DELETE FROM documents WHERE id = $1", [documentId]);
	}
});
