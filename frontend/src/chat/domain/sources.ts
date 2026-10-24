import type { ChatSource } from "../types";

/**
 * La forma de una fuente. La exige el API en cada fragmento y la usan el estado y el
 * almacenamiento: una fuente sin título no se puede atribuir a nada, así que no es
 * una fuente.
 */
export const isChatSource = (value: unknown): value is ChatSource => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.documentId === "string" &&
		typeof candidate.chunkIndex === "number" &&
		typeof candidate.title === "string" &&
		typeof candidate.content === "string" &&
		typeof candidate.distance === "number"
	);
};

/**
 * Los títulos de los documentos de los que viene la respuesta, sin repetir: un mismo
 * documento puede haber aportado varios fragmentos.
 */
export const sourceTitles = (sources: readonly ChatSource[]): string[] => {
	const titles: string[] = [];

	for (const source of sources) {
		if (!titles.includes(source.title)) {
			titles.push(source.title);
		}
	}

	return titles;
};
