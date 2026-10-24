import assert from "node:assert";
import { test } from "node:test";
import {
	computeDocumentVersion,
	resolveDisplayTitle,
} from "../../src/services/documentIdentity";

const base = {
	content: "Jorge Lizán Candela desarrolla en React.",
	title: "Currículum",
	embeddingSignature: "gemini-embedding-001:768",
};

test("la versión es la misma para la misma entrada", () => {
	assert.strictEqual(
		computeDocumentVersion(base),
		computeDocumentVersion(base),
	);
});

test("cambiar el contenido cambia la versión", () => {
	assert.notStrictEqual(
		computeDocumentVersion(base),
		computeDocumentVersion({ ...base, content: "Otro contenido." }),
	);
});

test("cambiar el título cambia la versión", () => {
	assert.notStrictEqual(
		computeDocumentVersion(base),
		computeDocumentVersion({ ...base, title: "Informe de GitHub" }),
	);
});

test("cambiar la firma de embeddings cambia la versión", () => {
	assert.notStrictEqual(
		computeDocumentVersion(base),
		computeDocumentVersion({
			...base,
			embeddingSignature: "gemini-embedding-001:768:RETRIEVAL_DOCUMENT",
		}),
	);
});

test("el título visible sale del mapa cuando el documento está en él", () => {
	assert.strictEqual(
		resolveDisplayTitle("curriculum-jorge-lizan.md", "curriculum-jorge-lizan"),
		"Currículum",
	);
	assert.strictEqual(
		resolveDisplayTitle("informe-github-jlizancandela.md", "informe-github-jlizancandela"),
		"Informe de GitHub",
	);
});

test("el título visible cae al nombre del archivo cuando no hay mapeo", () => {
	assert.strictEqual(
		resolveDisplayTitle("otro-documento.md", "otro-documento"),
		"otro-documento",
	);
});
