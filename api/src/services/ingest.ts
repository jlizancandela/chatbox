import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "node:path";
import type { DocumentChunk } from "../repositories/documents";
import { computeDocumentVersion, resolveDisplayTitle } from "./documentIdentity";
import { embeddingSignature } from "./embedding.config";

/**
 * Lo que la ingesta necesita del exterior.
 *
 * Se inyecta para poder probarla sin PostgreSQL y sin modelo: los dos son caros y uno
 * de ellos cobra por llamada.
 */
export type IngestDeps = {
	read: (source: string) => Promise<string>;
	hasVersion: (source: string, version: string) => Promise<boolean>;
	embed: (
		content: string,
		chunks: string[],
		title: string,
	) => Promise<DocumentChunk[]>;
	ingest: (input: {
		content: string;
		source: string;
		title: string;
		version: string;
		chunks: DocumentChunk[];
	}) => Promise<string>;
};

export type IngestResult = {
	source: string;
	/** Fragmentos del documento, se hayan embebido ahora o no. */
	chunks: number;
	/** `true` si la versión ya estaba: el documento se reactivó sin gastar embeddings. */
	reused: boolean;
};

/** El troceado del corpus: 512 caracteres con 50 de solapamiento. */
const splitter = new RecursiveCharacterTextSplitter({
	chunkSize: 512,
	chunkOverlap: 50,
});

/**
 * Ingiere un documento.
 *
 * La versión se comprueba **antes** de pedir los embeddings. Si el documento ya está
 * con esa versión, la ingesta lo reactiva y no hace ni una llamada al proveedor: por
 * eso reingerir el corpus sin cambios es gratis, y por eso la ingesta puede correr en
 * cada despliegue sin coste.
 *
 * Cuando reutiliza, no pasa fragmentos: el servicio solo reactiva el documento y los
 * que ya tenía siguen en la base de datos.
 */
export const ingestFile = async (
	deps: IngestDeps,
	source: string,
): Promise<IngestResult> => {
	const content = await deps.read(source);
	const title = resolveDisplayTitle(source, path.parse(source).name);
	const chunks = await splitter.splitText(content);
	const version = computeDocumentVersion({ content, title, embeddingSignature });

	if (await deps.hasVersion(source, version)) {
		await deps.ingest({ content, source, title, version, chunks: [] });
		return { source, chunks: chunks.length, reused: true };
	}

	const embeddedChunks = await deps.embed(content, chunks, title);
	await deps.ingest({
		content,
		source,
		title,
		version,
		chunks: embeddedChunks,
	});

	return { source, chunks: chunks.length, reused: false };
};
