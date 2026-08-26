import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
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

		const args = process.argv.slice(2);

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 512,
			chunkOverlap: 50,
		});

		let processedFiles = 0;
		let totalChunks = 0;
		const errors: { file: string; error: unknown }[] = [];

		const reportError = (file: string, error: unknown) => {
			errors.push({ file, error });
			console.error(`✗ ${file} — ${error instanceof Error ? error.message : error}`);
		};

		for (const arg of args) {
			try {
				const filePath = path.join(dir, arg);
				const content = await readFile(filePath, "utf-8");
				const fileName = path.parse(arg).name;
				const chunks = await splitter.splitText(content);
				const version = createHash("sha256").update(content).digest("hex");
				const embeddedChunks = await getDocumentEmbeddings(content, chunks);

				await ingestDocument({
					content,
					source: arg,
					title: fileName,
					version,
					chunks: embeddedChunks,
				});

				processedFiles++;
				totalChunks += chunks.length;
				console.log(`✓ ${arg} — ${chunks.length} chunks`);
			} catch (error) {
				reportError(arg, error);
			}
		}

		console.log(`\nDone. ${processedFiles} files, ${totalChunks} chunks, ${errors.length} errors.`);
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
