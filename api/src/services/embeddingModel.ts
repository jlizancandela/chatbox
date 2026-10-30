import {
	EMBEDDING_DTYPE,
	EMBEDDING_MODEL_ID,
	EMBEDDING_MODEL_REVISION,
	embeddingCacheDir,
	embeddingModelPath,
} from "./embedding.config";

/**
 * Un texto entra, un vector sale.
 *
 * Es lo único que la API sabe del modelo: el resto —prefijos, normalización, formato
 * de pgvector— vive en `embedding.ts`, y así el día que cambie el modelo cambia un
 * fichero y no la recuperación entera.
 */
export type LocalEmbeddingFn = (text: string) => Promise<number[]>;

type SentenceEmbeddingOutput = {
	sentence_embedding?: {
		tolist: () => number[][];
	};
};

/**
 * Carga EmbeddingGemma en el proceso.
 *
 * `allowRemoteModels` distingue los dos únicos usos posibles: la imagen y la máquina
 * de desarrollo lo traen del Hub con `pnpm embeddings:fetch`, mientras que el proceso
 * que sirve tráfico solo lee del disco. Así el arranque no depende de la red.
 *
 * La importación es dinámica a propósito: los tests nunca cargan este módulo, y la
 * suite no paga el coste de cargar ONNX Runtime para inyectar un doble.
 */
const load = async (allowRemoteModels: boolean): Promise<LocalEmbeddingFn> => {
	const { AutoModel, AutoTokenizer, env } = await import("@huggingface/transformers");

	env.cacheDir = embeddingCacheDir;
	env.allowRemoteModels = allowRemoteModels;

	const loadModel = async () => {
		// Con red se pide el id y la revisión; sin red, la carpeta ya resuelta.
		const modelPath = allowRemoteModels ? EMBEDDING_MODEL_ID : embeddingModelPath();
		const revision: { revision?: string } = allowRemoteModels
			? { revision: EMBEDDING_MODEL_REVISION }
			: {};

		const tokenizer = await AutoTokenizer.from_pretrained(modelPath, revision);
		const model = await AutoModel.from_pretrained(modelPath, {
			...revision,
			dtype: EMBEDDING_DTYPE,
		});

		return { tokenizer, model };
	};

	let loaded: Awaited<ReturnType<typeof loadModel>>;

	try {
		loaded = await loadModel();
	} catch (error) {
		throw new Error(
			`Could not load ${EMBEDDING_MODEL_ID} from ${embeddingCacheDir}. Run \`pnpm embeddings:fetch\` to download it.`,
			{ cause: error }
		);
	}

	const { tokenizer, model } = loaded;

	return async (text: string): Promise<number[]> => {
		const inputs = await tokenizer([text], { padding: true });
		const output = (await model(inputs)) as SentenceEmbeddingOutput;
		const vector = output.sentence_embedding?.tolist()[0];

		if (!vector) {
			throw new Error("The embedding model returned no sentence_embedding");
		}

		return vector;
	};
};

/** El camino de producción: lee el modelo ya presente en el disco, sin red. */
export const loadLocalEmbedding = (): Promise<LocalEmbeddingFn> => load(false);

/** El camino de la imagen y del desarrollo: descarga el modelo del Hub. */
export const downloadEmbeddingModel = (): Promise<LocalEmbeddingFn> => load(true);
