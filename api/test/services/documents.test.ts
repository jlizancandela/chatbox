import assert from "node:assert";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
// Carga la ampliación de tipos de @fastify/postgres: sin ella, `app.pg` no existe.
import "../../src/plugins/db";
import documentService from "../../src/services/documents";

type QueryCall = { text: string; values: unknown[] };

const createFakeApp = (existingId?: string) => {
	const calls: QueryCall[] = [];

	const client = {
		query: async (text: string, values: unknown[] = []) => {
			calls.push({ text, values });

			if (text.includes("SELECT id")) {
				return { rows: existingId ? [{ id: existingId }] : [] };
			}

			if (text.includes("RETURNING id")) {
				return { rows: [{ id: "42" }] };
			}

			return { rows: [] };
		},
	};

	const app = {
		pg: {
			transact: async (fn: (c: typeof client) => unknown) => fn(client),
		},
	} as unknown as FastifyInstance;

	return { app, calls };
};

const document = {
	content: "Jorge Lizán Candela desarrolla en React.",
	source: "curriculum-jorge-lizan.md",
	title: "Currículum",
	chunks: [
		{
			chunkIndex: 0,
			text: "Jorge Lizán Candela desarrolla en React.",
			embedding: "[0.1,0.2]",
		},
	],
};

test("una versión nueva inserta el documento y sus fragmentos", async () => {
	const { app, calls } = createFakeApp();

	const { ingestDocument } = documentService(app);
	const documentId = await ingestDocument({ ...document, version: "version-nueva" });

	assert.strictEqual(documentId, "42");
	assert.ok(
		calls.some((call) => call.text.includes("INSERT INTO documents")),
		"esperaba insertar el documento",
	);
	assert.ok(
		calls.some((call) => call.text.includes("INSERT INTO document_chunks")),
		"esperaba insertar los fragmentos",
	);
});

test("la misma versión reactiva el documento y no vuelve a embeberlo", async () => {
	const { app, calls } = createFakeApp("7");

	const { ingestDocument } = documentService(app);
	const documentId = await ingestDocument({ ...document, version: "version-igual" });

	assert.strictEqual(documentId, "7");
	assert.ok(
		!calls.some((call) => call.text.includes("INSERT INTO documents")),
		"no debe insertar un documento nuevo",
	);
	assert.ok(
		!calls.some((call) => call.text.includes("INSERT INTO document_chunks")),
		"no debe volver a embeber los fragmentos",
	);
	assert.ok(
		calls.some((call) => call.text.includes("SET is_active = TRUE")),
		"debe reactivar el documento existente",
	);
});

test("hasDocumentVersion distingue la versión que ya está de la que no", async () => {
	const conDocumento = createFakeApp("7");
	const sinDocumento = createFakeApp();

	assert.strictEqual(
		await documentService(conDocumento.app).hasDocumentVersion(
			document.source,
			"version-igual",
		),
		true,
		"la versión que existe tiene que encontrarse",
	);
	assert.strictEqual(
		await documentService(sinDocumento.app).hasDocumentVersion(
			document.source,
			"version-nueva",
		),
		false,
		"la versión que no existe no puede darse por buena",
	);
});
