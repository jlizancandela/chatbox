import {
	findOrCreateSessionByKey,
	listMessagesBySession,
	type TransactionClient,
} from "../repositories/conversations";
import {
	type HistoryLimits,
	type HistoryMessage,
	historyLimits,
	normalizeMessageContent,
	trimHistory,
} from "./history.contract";

export type HistoryLoader = (sessionKey: string) => Promise<HistoryMessage[]>;

type HistoryLogger = {
	warn: (details: unknown, message: string) => void;
};

/**
 * Resolves the conversation history of a session key.
 *
 * The session is created or refreshed on every valid request, so reading the
 * history also keeps `last_activity_at` and `expires_at` up to date. The
 * loader never rejects: when the database cannot be read it logs a warning
 * without message content and answers with an empty history.
 */
export const createHistoryLoader = (
	client: TransactionClient,
	limits: HistoryLimits = historyLimits,
	log?: HistoryLogger,
): HistoryLoader =>
	async (sessionKey: string): Promise<HistoryMessage[]> => {
		try {
			const sessionId = await findOrCreateSessionByKey(client, sessionKey);
			const stored = await listMessagesBySession(
				client,
				sessionId,
				limits.maxMessages,
			);

			const bounded: HistoryMessage[] = [];
			for (const message of stored) {
				const content = normalizeMessageContent(message.content, limits);
				if (content === null) {
					continue;
				}
				bounded.push({ ...message, content });
			}

			return trimHistory(bounded, limits);
		} catch {
			log?.warn({}, "conversation history unavailable; answering without it");
			return [];
		}
	};
