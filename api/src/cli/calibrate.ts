import fastify from "fastify";
import db from "../plugins/db";
import { embeddingService } from "../services/embedding";

async function main() {
	const app = fastify();
	try {
		await app.register(db);
		await app.ready();
		const { embedText } = embeddingService();

		const questions = process.argv.slice(2);
		if (questions.length === 0) {
			console.error('Usage: node dist/cli/calibrate.js "question" [...]');
			process.exitCode = 1;
			return;
		}

		for (const question of questions) {
			const sqlEmbedding = await embedText(question, "calibration");
			const result = await app.pg.query<{
				title: string;
				chunk_index: number;
				l2: number;
				cosine: number;
				snippet: string;
			}>(
				`SELECT d.title,
				        dc.chunk_index,
				        dc.embedding <-> $1 AS l2,
				        dc.embedding <=> $1 AS cosine,
				        left(dc.content, 100) AS snippet
				 FROM document_chunks dc
				 JOIN documents d ON d.id = dc.document_id
				 WHERE d.is_active = TRUE
				 ORDER BY cosine
				 LIMIT 5`,
				[sqlEmbedding],
			);

			console.log(`\nQ: ${question}`);
			for (const row of result.rows) {
				console.log(
					`  cos=${row.cosine.toFixed(4)}  l2=${row.l2.toFixed(4)}  [${row.title}#${row.chunk_index}] ${row.snippet}`,
				);
			}
		}
	} catch (error) {
		console.error("Fatal:", error instanceof Error ? error.message : error);
		process.exitCode = 1;
	} finally {
		await app.close();
	}
}

main();
