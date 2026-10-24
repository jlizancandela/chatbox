import assert from "node:assert";
import { test } from "node:test";
import { embeddingSignature } from "../../src/services/embedding.config";
import {
	embeddingService,
	type EmbedContentParams,
} from "../../src/services/embedding";

test("el embedding de un documento usa el tipo de tarea de documento y lleva su título", async () => {
	let captured: EmbedContentParams | undefined;

	const { embedText } = embeddingService(async (params) => {
		captured = params;
		return { embeddings: [{ values: [0.1, 0.2] }] };
	});

	await embedText("Jorge usa React", { purpose: "document", title: "Currículum" });

	assert.strictEqual(captured?.contents, "Jorge usa React");
	assert.strictEqual(captured?.config.taskType, "RETRIEVAL_DOCUMENT");
	assert.strictEqual(captured?.config.title, "Currículum");
});

test("el embedding de una pregunta usa el tipo de tarea de consulta y no lleva título", async () => {
	let captured: EmbedContentParams | undefined;

	const { embedText } = embeddingService(async (params) => {
		captured = params;
		return { embeddings: [{ values: [0.1, 0.2] }] };
	});

	await embedText("¿Qué stack usa?", { purpose: "query" });

	assert.strictEqual(captured?.config.taskType, "RETRIEVAL_QUERY");
	assert.strictEqual(captured?.config.title, undefined);
});

test("la firma de embeddings incluye el tipo de tarea de documento", () => {
	assert.ok(
		embeddingSignature.includes("RETRIEVAL_DOCUMENT"),
		"cambiar el tipo de tarea debe invalidar el corpus",
	);
});
