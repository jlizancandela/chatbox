export type ChatConfig = {
	similarityThreshold: number;
	historyLimits: HistoryLimits;
};

export type HistoryLimits = {
	maxMessages: number;
	maxMessageChars: number;
	maxTotalChars: number;
};

const readPositiveInt = (
	env: NodeJS.ProcessEnv,
	key: string,
	fallback: number,
): number => {
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

const createHistoryLimits = (
	env: NodeJS.ProcessEnv = process.env,
): HistoryLimits => {
	const limits: HistoryLimits = {
		maxMessages: readPositiveInt(env, "HISTORY_MAX_MESSAGES", 20),
		maxMessageChars: readPositiveInt(
			env,
			"HISTORY_MAX_MESSAGE_CHARS",
			2000,
		),
		maxTotalChars: readPositiveInt(env, "HISTORY_MAX_TOTAL_CHARS", 8000),
	};
	if (limits.maxTotalChars < limits.maxMessageChars) {
		throw new Error(
			"HISTORY_MAX_TOTAL_CHARS must be >= HISTORY_MAX_MESSAGE_CHARS",
		);
	}
	return limits;
};

export const chatConfig: ChatConfig = {
	similarityThreshold: parseFloat(
		process.env.SIMILARITY_THRESHOLD ?? "0.5",
	),
	historyLimits: createHistoryLimits(),
};

if (
	Number.isNaN(chatConfig.similarityThreshold) ||
	chatConfig.similarityThreshold <= 0 ||
	chatConfig.similarityThreshold > 1
) {
	throw new Error("SIMILARITY_THRESHOLD must be a number between 0 and 1");
}
