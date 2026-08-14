import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RecursiveChunker } from "@chonkiejs/core";
import { GoogleGenAI } from "@google/genai";
import fastify from "fastify";
import pgvector from "pgvector/pg";
import db from "../plugins/db";

async function main() {
	const app = fastify();
	const genAI = new GoogleGenAI({
		apiKey: process.env.GEMINI_API_KEY || "",
	});
	try {
		await app.register(db);
		await app.ready();
		const dir = path.join(process.cwd(), "ingest");
		const files = await readdir(dir);
		const chunker = await RecursiveChunker.create({
			chunkSize: 512,
		});

		for (const file of files) {
			const filePath = path.join(dir, file);
			const content = await readFile(filePath, "utf-8");
			const chunks = await chunker.chunk(content);
			const embeddedChunks: {
				chunkIndex: number;
				text: string;
				embedding: number[];
			}[] = [];

			for (const [chunkIndex, chunk] of chunks.entries()) {
				const response = await genAI.models.embedContent({
					model: "gemini-embedding-001",
					contents: chunk.text,
					config: {
						outputDimensionality: 768,
					},
				});
				const embedding = response.embeddings?.[0]?.values;
				if (!embedding) {
					throw new Error(
						`No embedding generated for chunk ${chunkIndex} of file: ${file}`,
					);
				}
				embeddedChunks.push({ chunkIndex, text: chunk.text, embedding });
			}

			await app.pg.transact(async (client) => {
				const version = createHash("sha256").update(content).digest("hex");

				const result = await client.query<{ id: string }>(
					`INSERT INTO documents (source, title, version, content)
					 VALUES ($1, $2, $3, $4)
					 RETURNING id`,
					[file, path.parse(file).name, version, content],
				);
				const documentId = result.rows[0]?.id;
				if (!documentId) {
					throw new Error(`No document ID returned for file: ${file}`);
				}

				for (const chunk of embeddedChunks) {
					await client.query(
						`INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
						 VALUES ($1, $2, $3, $4)`,
						[
							documentId,
							chunk.chunkIndex,
							chunk.text,
							pgvector.toSql(chunk.embedding),
						],
					);
				}
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
