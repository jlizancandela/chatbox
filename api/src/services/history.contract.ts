export type HistoryRole = "user" | "assistant";

export type HistoryMessage = {
	seq: number;
	role: HistoryRole;
	content: string;
	createdAt: string;
};

export type HistoryLimits = {
	maxMessages: number;
	maxMessageChars: number;
	maxTotalChars: number;
};

const DEFAULTS: HistoryLimits = {
	maxMessages: 20,
	maxMessageChars: 2000,
	maxTotalChars: 8000,
};

const DEFAULT_TTL_MINUTES = 15;

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

export const createHistoryLimits = (
	env: NodeJS.ProcessEnv = process.env,
): HistoryLimits => {
	const limits: HistoryLimits = {
		maxMessages: readPositiveInt(
			env,
			"HISTORY_MAX_MESSAGES",
			DEFAULTS.maxMessages,
		),
		maxMessageChars: readPositiveInt(
			env,
			"HISTORY_MAX_MESSAGE_CHARS",
			DEFAULTS.maxMessageChars,
		),
		maxTotalChars: readPositiveInt(
			env,
			"HISTORY_MAX_TOTAL_CHARS",
			DEFAULTS.maxTotalChars,
		),
	};

	if (limits.maxTotalChars < limits.maxMessageChars) {
		throw new Error(
			"HISTORY_MAX_TOTAL_CHARS must be greater than or equal to HISTORY_MAX_MESSAGE_CHARS",
		);
	}

	return limits;
};

export const historyLimits: HistoryLimits = createHistoryLimits();

export const readHistoryTTLMinutes = (env: NodeJS.ProcessEnv): number =>
	readPositiveInt(env, "HISTORY_SESSION_TTL_MINUTES", DEFAULT_TTL_MINUTES);

export const historyTTLMinutes: number = readHistoryTTLMinutes(process.env);

export const normalizeMessageContent = (
	content: string,
	limits: HistoryLimits = historyLimits,
): string | null => {
	const trimmed = content.trim();
	if (trimmed.length === 0) {
		return null;
	}

	return trimmed.slice(0, limits.maxMessageChars);
};

export const trimHistory = (
	messages: HistoryMessage[],
	limits: HistoryLimits = historyLimits,
): HistoryMessage[] => {
	const kept: HistoryMessage[] = [];
	let totalChars = 0;

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];

		if (kept.length >= limits.maxMessages) {
			break;
		}

		const nextTotal = totalChars + message.content.length;
		if (kept.length > 0 && nextTotal > limits.maxTotalChars) {
			break;
		}

		kept.push(message);
		totalChars = nextTotal;
	}

	kept.reverse();

	if (kept[0]?.role === "assistant") {
		kept.shift();
	}

	return kept;
};
