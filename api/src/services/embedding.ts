import pgvector from "pgvector/pg";
import {
	documentPrompt,
	EMBEDDING_DIMENSION,
	type EmbedPurpose,
	QUERY_PROMPT,
} from "./embedding.config";
import { loadLocalEmbedding } from "./embeddingModel";

/**
 * Lo que devuelve el proveedor de embeddings: los componentes del vector, sin
 * prefijos y sin normalizar. El servicio se encarga de las dos cosas.
 */
export type EmbedContentFn = (text: string) => Promise<number[]>;

export type EmbedTextOptions = {
	purpose: EmbedPurpose;
	title?: string;
	context?: string;
};

/**
 * La interfaz que consume el resto de la aplicación: texto y opciones dentro, vector
 * serializado para pgvector fuera. Ni la ingesta ni el chat saben qué modelo hay
 * detrás ni cómo se llama.
 */
export type EmbedTextFn = (text: string, options: EmbedTextOptions) => Promise<string>;

export type EmbeddingService = {
	embedText: EmbedTextFn;
	/** Se resuelve cuando el modelo terminó de cargar. */
	ready: Promise<void>;
};

/**
 * El prefijo que espera EmbeddingGemma. Una consulta y un documento no se codifican
 * igual: sin esta distinción el vector de la pregunta no cae cerca de su fragmento.
 */
const prompt = (text: string, { purpose, title }: EmbedTextOptions): string =>
	purpose === "query" ? `${QUERY_PROMPT}${text}` : `${documentPrompt(title)}${text}`;

/**
 * L2 normaliza el vector antes de guardarlo. El modelo ya devuelve vectores
 * normalizados, pero el contrato es del servicio, no del modelo: un cambio de pesos
 * no puede dejar el corpus en otra escala sin que nadie lo note.
 */
const normalize = (values: number[]): number[] => {
	let squaredNorm = 0;
	for (const value of values) {
		squaredNorm += value * value;
	}

	if (!Number.isFinite(squaredNorm) || squaredNorm === 0) {
		throw new Error("The embedding model returned a zero or non-finite vector");
	}

	const norm = Math.sqrt(squaredNorm);
	return values.map((value) => value / norm);
};

/**
 * El servicio de embeddings.
 *
 * `embedContent` es el colaborador: si viene, se usa; si no, se carga EmbeddingGemma
 * en el proceso. Quien lo llama decide —la aplicación lo decora en la instancia, la
 * ingesta lo cablea en el CLI— y así el servicio no sabe nada de quién lo usa.
 */
export const embeddingService = (embedContent?: EmbedContentFn): EmbeddingService => {
	let embed = embedContent;

	const ready: Promise<void> =
		embedContent !== undefined
			? Promise.resolve()
			: loadLocalEmbedding().then((loaded) => {
					embed = loaded;
				});

	const embedText = async (text: string, options: EmbedTextOptions): Promise<string> => {
		await ready;

		if (!embed) {
			throw new Error("The embedding model is not available");
		}

		const values = await embed(prompt(text, options));

		if (values.length !== EMBEDDING_DIMENSION) {
			throw new Error(
				`The embedding model returned ${values.length} dimensions; the schema expects ${EMBEDDING_DIMENSION}`
			);
		}

		const sqlEmbedding = pgvector.toSql(normalize(values));
		if (!sqlEmbedding) {
			throw new Error(`Could not serialize embedding for ${options.purpose}`);
		}

		return sqlEmbedding;
	};

	return { embedText, ready };
};
