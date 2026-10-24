import { createHash } from "node:crypto";

/**
 * Títulos visibles para quien lee la respuesta. El nombre del archivo sirve para
 * identificar el documento en la ingesta, pero no para mostrárselo en el widget.
 */
const DISPLAY_TITLES: Record<string, string> = {
	"curriculum-jorge-lizan.md": "Currículum",
	"informe-github-jlizancandela.md": "Informe de GitHub",
};

export const resolveDisplayTitle = (source: string, fallback: string): string =>
	DISPLAY_TITLES[source] ?? fallback;

export type DocumentVersionInput = {
	content: string;
	title: string;
	embeddingSignature: string;
};

/**
 * La versión de un documento no depende solo de su contenido: también de su título
 * y de la configuración que produce sus embeddings. Si cambia cualquiera de los
 * tres, el documento es otro y hay que volver a embeberlo; si no cambia, la ingesta
 * lo reutiliza sin volver a gastar embeddings.
 */
export const computeDocumentVersion = ({
	content,
	title,
	embeddingSignature,
}: DocumentVersionInput): string =>
	createHash("sha256")
		.update(`${content}\n${title}\n${embeddingSignature}`)
		.digest("hex");
