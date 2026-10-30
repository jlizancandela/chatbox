import assert from "node:assert";
import { test } from "node:test";
import { embeddingService } from "../../src/services/embedding";
import {
	EMBEDDING_DIMENSION,
	EMBEDDING_MODEL_REVISION,
	embeddingSignature,
} from "../../src/services/embedding.config";
import { vectorOf } from "../vector";

const decode = (sqlEmbedding: string): number[] => JSON.parse(sqlEmbedding);

test("el embedding de un documento lleva su título como prefijo", async () => {
	let captured: string | undefined;

	const { embedText } = embeddingService(async (text) => {
		captured = text;
		return vectorOf(EMBEDDING_DIMENSION);
	});

	await embedText("Jorge usa React", {
		purpose: "document",
		title: "Currículum",
	});

	assert.strictEqual(captured, "title: Currículum | text: Jorge usa React");
});

test("el embedding de un documento sin título usa el prefijo neutro", async () => {
	let captured: string | undefined;

	const { embedText } = embeddingService(async (text) => {
		captured = text;
		return vectorOf(EMBEDDING_DIMENSION);
	});

	await embedText("Jorge usa React", { purpose: "document" });

	assert.strictEqual(captured, "title: none | text: Jorge usa React");
});

test("el embedding de una pregunta usa el prefijo de consulta", async () => {
	let captured: string | undefined;

	const { embedText } = embeddingService(async (text) => {
		captured = text;
		return vectorOf(EMBEDDING_DIMENSION);
	});

	await embedText("¿Qué stack usa?", { purpose: "query" });

	assert.strictEqual(captured, "task: search result | query: ¿Qué stack usa?");
});

test("el vector se normaliza L2 antes de serializarlo", async () => {
	const values = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
	values[0] = 3;
	values[1] = 4;

	const { embedText } = embeddingService(async () => values);
	const embedding = decode(await embedText("Jorge usa React", { purpose: "document" }));

	assert.strictEqual(embedding.length, EMBEDDING_DIMENSION);
	assert.ok(Math.abs(embedding[0] - 0.6) < 1e-9);
	assert.ok(Math.abs(embedding[1] - 0.8) < 1e-9);

	const norm = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
	assert.ok(Math.abs(norm - 1) < 1e-9, "el vector tiene que quedar unitario");
});

test("un vector de dimensión distinta a la del esquema es un error", async () => {
	const { embedText } = embeddingService(async () => [0.1, 0.2, 0.3]);

	await assert.rejects(
		() => embedText("Jorge usa React", { purpose: "document" }),
		/3 dimensions; the schema expects 768/
	);
});

test("un vector nulo no se puede normalizar", async () => {
	const { embedText } = embeddingService(async () =>
		Array.from({ length: EMBEDDING_DIMENSION }, () => 0)
	);

	await assert.rejects(
		() => embedText("Jorge usa React", { purpose: "document" }),
		/zero or non-finite vector/
	);
});

test("la firma de embeddings identifica el modelo y el prefijo del documento", () => {
	assert.ok(
		embeddingSignature.includes("onnx-community/embeddinggemma-300m-ONNX"),
		"cambiar de modelo debe invalidar el corpus"
	);
	assert.ok(
		embeddingSignature.includes(EMBEDDING_MODEL_REVISION),
		"republicar los pesos en otra revisión debe invalidar el corpus"
	);
	assert.ok(embeddingSignature.includes("q4"), "cambiar de cuantización debe invalidar el corpus");
	assert.ok(
		embeddingSignature.includes("title: none | text: "),
		"cambiar el prefijo del documento debe invalidar el corpus"
	);
	assert.ok(
		!embeddingSignature.includes("task: search result"),
		"el prefijo de la consulta no cambia los vectores guardados"
	);
});
