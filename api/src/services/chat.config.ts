export type ChatConfig = {
	similarityThreshold: number;
	topK: number;
	generation: GenerationConfig;
	historyLimits: HistoryLimits;
	sessionBudget: SessionBudgetConfig;
};

export type HistoryLimits = {
	maxMessages: number;
	maxMessageChars: number;
	maxTotalChars: number;
};

export type ReasoningEffort = "low" | "medium" | "high";

export type GenerationConfig = {
	temperature: number;
	maxCompletionTokens: number;
	reasoningEffort: ReasoningEffort;
};

/**
 * El presupuesto de una sesión.
 *
 * Los dos topes se complementan: el de turnos es predecible para el visitante —"no
 * puedes pasar de N preguntas"— y el de tokens es exacto para el gasto (#148).
 */
export type SessionBudgetConfig = {
	maxTokens: number;
	maxTurns: number;
};

const readPositiveInt = (env: NodeJS.ProcessEnv, key: string, fallback: number): number => {
	const raw = env[key];
	if (raw === undefined || raw.trim() === "") {
		return fallback;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${key} must be a positive integer`);
	}
	return value;
};

const readFloatInRange = (
	env: NodeJS.ProcessEnv,
	key: string,
	fallback: number,
	min: number,
	max: number
): number => {
	const raw = env[key];
	if (raw === undefined || raw.trim() === "") {
		return fallback;
	}
	const value = Number(raw);
	if (!Number.isFinite(value) || value < min || value > max) {
		throw new Error(`${key} must be a number between ${min} and ${max}`);
	}
	return value;
};

const readEnum = <T extends string>(
	env: NodeJS.ProcessEnv,
	key: string,
	fallback: T,
	allowed: readonly T[]
): T => {
	const raw = env[key]?.trim().toLowerCase();
	if (raw === undefined || raw === "") {
		return fallback;
	}
	if (!allowed.includes(raw as T)) {
		throw new Error(`${key} must be one of ${allowed.join(", ")}`);
	}
	return raw as T;
};

/**
 * El historial que se reenvía en cada turno.
 *
 * El tope baja de 20 a 12 mensajes y de 8.000 a 4.000 caracteres (#148). El historial
 * se reenvía **completo** en cada turno, así que es la palanca que más pesa en el
 * coste: una conversación de diez turnos paga diez veces la misma pregunta. Con el
 * tope anterior, un turno con el historial lleno costaba ~2.160 tokens; con este,
 * ~1.430. El efecto medido está en `api/.specs/148-presupuesto-por-sesion.md`.
 */
const createHistoryLimits = (env: NodeJS.ProcessEnv = process.env): HistoryLimits => {
	const limits: HistoryLimits = {
		maxMessages: readPositiveInt(env, "HISTORY_MAX_MESSAGES", 12),
		maxMessageChars: readPositiveInt(env, "HISTORY_MAX_MESSAGE_CHARS", 1000),
		maxTotalChars: readPositiveInt(env, "HISTORY_MAX_TOTAL_CHARS", 4000),
	};
	if (limits.maxTotalChars < limits.maxMessageChars) {
		throw new Error("HISTORY_MAX_TOTAL_CHARS must be >= HISTORY_MAX_MESSAGE_CHARS");
	}
	return limits;
};

/**
 * La temperatura que usa el proveedor por defecto (1) es más alta de lo que
 * conviene para responder con datos: Groq recomienda 0.5-0.7 para gpt-oss. El
 * límite de tokens tiene que contemplar el razonamiento del modelo, y el
 * esfuerzo por defecto ("medium") paga razonamiento en cada pregunta de un
 * widget que pide datos concretos.
 *
 * El techo baja de 2.048 a 1.200 tokens (#148): el prompt pide un máximo de 200
 * palabras —unos 300 tokens— y el resto es holgura para el razonamiento. Con 1.200
 * caben las respuestas más largas que el prompt permite, sin truncar ninguna.
 */
export const createGenerationConfig = (env: NodeJS.ProcessEnv = process.env): GenerationConfig => ({
	temperature: readFloatInRange(env, "GENERATION_TEMPERATURE", 0.6, 0, 2),
	maxCompletionTokens: readPositiveInt(env, "GENERATION_MAX_COMPLETION_TOKENS", 1200),
	reasoningEffort: readEnum(env, "GENERATION_REASONING_EFFORT", "low", ["low", "medium", "high"]),
});

export const createTopK = (env: NodeJS.ProcessEnv = process.env): number =>
	readPositiveInt(env, "RETRIEVAL_TOP_K", 5);

/**
 * El presupuesto de una sesión.
 *
 * Los valores por defecto salen de las cifras medidas sobre la API real (#148):
 *
 * - Un turno inicial cuesta ~1.170 tokens y uno con el historial en su tope ~2.160.
 * - La cuota diaria del proveedor son ~200.000 tokens, y una conversación no debe
 *   llevarse ni la décima parte: el tope de **20.000 tokens** deja unas 17
 *   conversaciones completas al día, o unas 9 si cada turno lleva el historial lleno.
 * - Con **12 turnos** una conversación se agota antes de que el visitante la note
 *   larga, y nunca se acerca al tope de tokens.
 *
 * El de turnos se comprueba primero en la respuesta, porque avisa antes de que el de
 * tokens duela.
 */
export const createSessionBudgetConfig = (
	env: NodeJS.ProcessEnv = process.env
): SessionBudgetConfig => ({
	maxTokens: readPositiveInt(env, "SESSION_BUDGET_MAX_TOKENS", 20_000),
	maxTurns: readPositiveInt(env, "SESSION_BUDGET_MAX_TURNS", 12),
});

/**
 * Umbral de **distancia** coseno. `0.8` está calibrado sobre EmbeddingGemma: las
 * cuatro preguntas del widget quedan por debajo y las preguntas ajenas, en su mayoría,
 * por encima. Cambiar de modelo obliga a recalibrarlo.
 */
export const chatConfig: ChatConfig = {
	similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD ?? "0.8"),
	topK: createTopK(),
	generation: createGenerationConfig(),
	historyLimits: createHistoryLimits(),
	sessionBudget: createSessionBudgetConfig(),
};

if (
	Number.isNaN(chatConfig.similarityThreshold) ||
	chatConfig.similarityThreshold <= 0 ||
	chatConfig.similarityThreshold > 1
) {
	throw new Error("SIMILARITY_THRESHOLD must be a number between 0 and 1");
}
