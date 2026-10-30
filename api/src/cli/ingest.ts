import { readFile } from "node:fs/promises";
import path from "node:path";
import fastify from "fastify";
import db from "../plugins/db";
import { documentEmbeddingsService } from "../services/documentEmbeddings";
import documentService from "../services/documents";
import { type IngestDeps, ingestFile } from "../services/ingest";

/**
 * El comando de ingesta: lee los nombres que recibe, los busca en `ingest/` y deja el
 * corpus en la base de datos.
 *
 * La lógica vive en `services/ingest.ts`, con sus dependencias inyectadas, para poder
 * probarla sin PostgreSQL y sin modelo. Aquí solo se cablea lo de verdad.
 */
async function main() {
	const app = fastify();

	try {
		await app.register(db);
		await app.ready();

		const { ingestDocument, hasDocumentVersion } = documentService(app);
		const { getDocumentEmbeddings } = documentEmbeddingsService();
		const dir = path.join(process.cwd(), "ingest");

		const deps: IngestDeps = {
			read: (source) => readFile(path.join(dir, source), "utf-8"),
			hasVersion: hasDocumentVersion,
			embed: (content, chunks, title) => getDocumentEmbeddings(content, chunks, title),
			ingest: ingestDocument,
		};

		let processedFiles = 0;
		let totalChunks = 0;
		let reusedFiles = 0;
		const errors: { file: string; error: unknown }[] = [];

		for (const source of process.argv.slice(2)) {
			try {
				const result = await ingestFile(deps, source);
				processedFiles++;
				totalChunks += result.chunks;
				if (result.reused) reusedFiles++;

				console.log(
					result.reused ? `✓ ${source} — sin cambios` : `✓ ${source} — ${result.chunks} chunks`
				);
			} catch (error) {
				errors.push({ file: source, error });
				console.error(`✗ ${source} — ${error instanceof Error ? error.message : error}`);
			}
		}

		console.log(
			`\nDone. ${processedFiles} files, ${totalChunks} chunks, ${reusedFiles} unchanged, ${errors.length} errors.`
		);

		if (errors.length > 0) {
			process.exitCode = 1;
		}
	} catch (error) {
		console.error("Fatal:", error instanceof Error ? error.message : error);
		process.exitCode = 1;
	} finally {
		await app.close();
	}
}

main();
