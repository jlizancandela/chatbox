import type { Pool, PoolClient } from "pg";
import {
	type HistoryMessage,
	historyLimits,
	historyTTLMinutes,
	normalizeMessageContent,
} from "../services/history.contract";

export type TransactionClient = Pick<PoolClient, "query">;
export type PoolClientProvider = Pick<Pool, "connect">;

const insertOrRefreshSession = async (
	client: TransactionClient,
	sessionKey: string,
	ttlMinutes: number,
): Promise<string | undefined> => {
	const result = await client.query<{ id: string }>(
		`INSERT INTO conversation_sessions (session_key, expires_at)
		 VALUES ($1, NOW() + ($2 * INTERVAL '1 minute'))
		 ON CONFLICT (session_key)
		 DO UPDATE SET last_activity_at = NOW(),
		               expires_at = NOW() + ($2 * INTERVAL '1 minute')
		 WHERE conversation_sessions.expires_at > NOW()
		 RETURNING id`,
		[sessionKey, ttlMinutes],
	);

	return result.rows[0]?.id;
};

const createSession = async (
	client: TransactionClient,
	sessionKey: string,
	ttlMinutes: number,
): Promise<string> => {
	const result = await client.query<{ id: string }>(
		`INSERT INTO conversation_sessions (session_key, expires_at)
		 VALUES ($1, NOW() + ($2 * INTERVAL '1 minute'))
		 RETURNING id`,
		[sessionKey, ttlMinutes],
	);

	const id = result.rows[0]?.id;
	if (!id) {
		throw new Error(`No session ID returned for key: ${sessionKey}`);
	}

	return id;
};

export const findOrCreateSessionByKey = async (
	client: TransactionClient,
	sessionKey: string,
	ttlMinutes = historyTTLMinutes,
): Promise<string> => {
	const refreshed = await insertOrRefreshSession(client, sessionKey, ttlMinutes);
	if (refreshed) {
		return refreshed;
	}

	// The existing session expired, so it must be replaced: deleting it also
	// removes its messages through ON DELETE CASCADE.
	await client.query("DELETE FROM conversation_sessions WHERE session_key = $1", [
		sessionKey,
	]);

	return createSession(client, sessionKey, ttlMinutes);
};

export const listMessagesBySession = async (
	client: TransactionClient,
	sessionId: string,
	limit: number,
): Promise<HistoryMessage[]> => {
	const result = await client.query<{
		seq: number;
		role: string;
		content: string;
		created_at: Date;
	}>(
		`SELECT seq, role, content, created_at
		 FROM conversation_messages
		 WHERE session_id = $1
		 ORDER BY seq DESC
		 LIMIT $2`,
		[sessionId, limit],
	);

	// Newest first so the LIMIT keeps the most recent messages; the contract
	// reads them in ascending seq order.
	return result.rows
		.map(
			(row): HistoryMessage => ({
				seq: row.seq,
				role: row.role === "assistant" ? "assistant" : "user",
				content: row.content,
				createdAt: new Date(row.created_at).toISOString(),
			}),
		)
		.reverse();
};

export const saveCompletedTurn = async (
	pool: PoolClientProvider,
	sessionKey: string,
	question: string,
	answer: string,
): Promise<void> => {
	const normalizedQuestion = normalizeMessageContent(question, historyLimits);
	const normalizedAnswer = normalizeMessageContent(answer, historyLimits);

	if (!normalizedQuestion || !normalizedAnswer) {
		return;
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const sessionId = await findOrCreateSessionByKey(client, sessionKey);

		// Serialize sequence allocation for concurrent requests of one session.
		await client.query(
			"SELECT id FROM conversation_sessions WHERE id = $1 FOR UPDATE",
			[sessionId],
		);
		const next = await client.query<{ seq: number }>(
			`SELECT COALESCE(MAX(seq), 0) + 1 AS seq
			 FROM conversation_messages
			 WHERE session_id = $1`,
			[sessionId],
		);
		const firstSeq = next.rows[0]?.seq;
		if (firstSeq === undefined) {
			throw new Error("Could not allocate conversation sequence");
		}

		await client.query(
			`INSERT INTO conversation_messages (session_id, seq, role, content)
			 VALUES ($1, $2, 'user', $3), ($1, $4, 'assistant', $5)`,
			[sessionId, firstSeq, normalizedQuestion, firstSeq + 1, normalizedAnswer],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		throw error;
	} finally {
		client.release();
	}
};
