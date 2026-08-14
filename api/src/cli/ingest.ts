import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RecursiveChunker } from "@chonkiejs/core";
import fastify from "fastify";
import db from "../plugins/db";
import { documentEmbeddingsService } from "../services/documentEmbeddings";
import documentService from "../services/documents";

async function main() {
	const app = fastify();
	try {
		await app.register(db);
		await app.ready();
		const { ingestDocument } = documentService(app);
		const { getDocumentEmbeddings } = documentEmbeddingsService();
		const dir = path.join(process.cwd(), "ingest");
		const files = await readdir(dir);
		const chunker = await RecursiveChunker.create({
			chunkSize: 512,
		});

		for (const file of files) {
			const filePath = path.join(dir, file);
			const fileName = path.parse(file).name;
			const content = await readFile(filePath, "utf-8");
			const chunks = await chunker.chunk(content);
			const version = createHash("sha256").update(content).digest("hex");
			const embeddedChunks = await getDocumentEmbeddings(file, chunks);

			await ingestDocument({
				content,
				source: file,
				title: fileName,
				version,
				chunks: embeddedChunks,
			});
		}
	} catch (error) {
		console.error("Error reading files:", error);
		process.exitCode = 1;
	} finally {
		await app.close();
	}
}

main();
