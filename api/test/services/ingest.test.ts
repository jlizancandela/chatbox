import assert from "node:assert";
import { test } from "node:test";
import type { DocumentChunk } from "../../src/repositories/documents";
import { type IngestDeps, ingestFile } from "../../src/services/ingest";

/**
 * La ingesta, con PostgreSQL y el modelo de mentira.
 *
 * Lo que se comprueba aquí es la decisión que cuesta dinero: si la versión ya está, no
 * se pide ni un embedding.
 */

const CONTENT = "Jorge Lizán Candela desarrolla en TypeScript y Preact.";

const fakeDeps = ({ hasVersion }: { hasVersion: boolean }) => {
	const calls = {
		embeddings: 0,
		ingested: [] as {
			source: string;
			title: string;
			version: string;
			chunks: DocumentChunk[];
		}[],
	};

	const deps: IngestDeps = {
		read: async () => CONTENT,
		hasVersion: async () => hasVersion,
		embed: async (_content, chunks) => {
			calls.embeddings++;
			return chunks.map((text, chunkIndex) => ({
				chunkIndex,
				text,
				embedding: "[0.1]",
			}));
		},
		ingest: async (input) => {
			calls.ingested.push(input);
			return "1";
		},
	};

	return { deps, calls };
};

test("una versión que ya está no pide embeddings", async () => {
	const { deps, calls } = fakeDeps({ hasVersion: true });

	const result = await ingestFile(deps, "curriculum-jorge-lizan.md");

	assert.strictEqual(result.reused, true);
	assert.strictEqual(
		calls.embeddings,
		0,
		"con la misma versión no debe llamarse al proveedor de embeddings"
	);

	const [ingested] = calls.ingested;
	assert.ok(ingested, "esperaba una ingesta");
	assert.deepStrictEqual(
		ingested.chunks,
		[],
		"reactiva el documento sin fragmentos: los que tenía siguen en la base de datos"
	);
	assert.strictEqual(ingested.title, "Currículum");
	assert.ok(ingested.version.length > 0, "esperaba una versión calculada");
});

test("una versión nueva embebe y guarda los fragmentos", async () => {
	const { deps, calls } = fakeDeps({ hasVersion: false });

	const result = await ingestFile(deps, "curriculum-jorge-lizan.md");

	assert.strictEqual(result.reused, false);
	assert.strictEqual(calls.embeddings, 1, "debe embeber una vez");

	const [ingested] = calls.ingested;
	assert.ok(ingested, "esperaba una ingesta");
	assert.ok(ingested.chunks.length > 0, "debe guardar los fragmentos embebidos");
	assert.strictEqual(ingested.chunks.length, result.chunks);
});
