import {
	documentPrompt,
	EMBEDDING_DTYPE,
	EMBEDDING_MODEL_ID,
	embeddingCacheDir,
} from "../services/embedding.config";
import { downloadEmbeddingModel } from "../services/embeddingModel";

/**
 * Prepara el modelo para que el proceso no tenga que descargarlo.
 *
 * La imagen lo ejecuta al construir: los pesos viajan dentro y el arranque no depende
 * de la red. En desarrollo se ejecuta una vez con `pnpm embeddings:fetch`.
 */
async function main() {
	console.log(`==> Descargando ${EMBEDDING_MODEL_ID} (${EMBEDDING_DTYPE}) en ${embeddingCacheDir}`);

	const embed = await downloadEmbeddingModel();
	const vector = await embed(`${documentPrompt()}warm-up`);

	console.log(`==> Modelo listo: ${vector.length} dimensiones`);
}

main().catch((error) => {
	console.error("Fatal:", error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
