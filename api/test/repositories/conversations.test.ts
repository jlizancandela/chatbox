import assert from "node:assert";
import { after, test } from "node:test";
import { Pool } from "pg";
import {
	findOrCreateSessionByKey,
	listMessagesBySession,
	saveCompletedTurn,
} from "../../src/repositories/conversations";
import { deriveSessionKey } from "../../src/services/history.session";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

after(async () => {
	await pool.end();
});

const cleanup = async (sessionKey: string) => {
	await pool.query("DELETE FROM conversation_sessions WHERE session_key = $1", [
		sessionKey,
	]);
};

test("findOrCreateSessionByKey creates a session without storing the raw IP", async () => {
	const ip = "192.0.2.10";
	const sessionKey = deriveSessionKey(ip);
	await cleanup(sessionKey);

	const id = await findOrCreateSessionByKey(pool, sessionKey);

	const row = await pool.query<{ session_key: string }>(
		"SELECT session_key FROM conversation_sessions WHERE id = $1",
		[id],
	);

	assert.strictEqual(row.rows[0]?.session_key, sessionKey);
	assert.notStrictEqual(sessionKey, ip);
	assert.ok(!sessionKey.includes(ip));

	await cleanup(sessionKey);
});

test("findOrCreateSessionByKey applies the configured TTL", async () => {
	const sessionKey = deriveSessionKey("192.0.2.14");
	await cleanup(sessionKey);

	const id = await findOrCreateSessionByKey(pool, sessionKey, 5);
	const row = await pool.query<{ seconds: number }>(
		`SELECT EXTRACT(EPOCH FROM (expires_at - created_at))::int AS seconds
		 FROM conversation_sessions
		 WHERE id = $1`,
		[id],
	);

	assert.ok(row.rows[0]);
	assert.ok(Math.abs(row.rows[0].seconds - 300) <= 1);

	await cleanup(sessionKey);
});

test("findOrCreateSessionByKey updates last_activity_at on reuse", async () => {
	const sessionKey = deriveSessionKey("192.0.2.15");
	await cleanup(sessionKey);

	const id = await findOrCreateSessionByKey(pool, sessionKey, 15);
	await pool.query(
		`UPDATE conversation_sessions
		 SET last_activity_at = NOW() - INTERVAL '1 minute'
		 WHERE id = $1`,
		[id],
	);

	const before = await pool.query<{ last_activity_at: string }>(
		"SELECT last_activity_at::text FROM conversation_sessions WHERE id = $1",
		[id],
	);
	await findOrCreateSessionByKey(pool, sessionKey, 15);
	const after = await pool.query<{ last_activity_at: string }>(
		"SELECT last_activity_at::text FROM conversation_sessions WHERE id = $1",
		[id],
	);

	assert.ok(
		new Date(after.rows[0].last_activity_at).getTime() >
			new Date(before.rows[0].last_activity_at).getTime(),
	);

	await cleanup(sessionKey);
});

test("findOrCreateSessionByKey reuses an active session", async () => {
	const sessionKey = deriveSessionKey("192.0.2.11");
	await cleanup(sessionKey);

	const first = await findOrCreateSessionByKey(pool, sessionKey);
	const second = await findOrCreateSessionByKey(pool, sessionKey);

	assert.strictEqual(first, second);

	await cleanup(sessionKey);
});

test("findOrCreateSessionByKey replaces an expired session", async () => {
	const sessionKey = deriveSessionKey("192.0.2.12");
	await cleanup(sessionKey);

	const id = await findOrCreateSessionByKey(pool, sessionKey);

	await pool.query(
		`UPDATE conversation_sessions
		 SET created_at = NOW() - INTERVAL '40 minutes',
		     last_activity_at = NOW() - INTERVAL '31 minutes',
		     expires_at = NOW() - INTERVAL '10 minutes'
		 WHERE id = $1`,
		[id],
	);

	const renewed = await findOrCreateSessionByKey(pool, sessionKey);

	const row = await pool.query<{ id: string }>(
		"SELECT id FROM conversation_sessions WHERE session_key = $1",
		[sessionKey],
	);

	assert.strictEqual(row.rows.length, 1);
	assert.strictEqual(String(row.rows[0]?.id), renewed);

	await cleanup(sessionKey);
});

test("replacing an expired session cascades its messages away", async () => {
	const sessionKey = deriveSessionKey("192.0.2.13");
	await cleanup(sessionKey);

	const id = await findOrCreateSessionByKey(pool, sessionKey);

	await pool.query(
		"INSERT INTO conversation_messages (session_id, seq, role, content) VALUES ($1, 1, 'user', 'hola')",
		[id],
	);

	await pool.query(
		`UPDATE conversation_sessions
		 SET created_at = NOW() - INTERVAL '40 minutes',
		     last_activity_at = NOW() - INTERVAL '31 minutes',
		     expires_at = NOW() - INTERVAL '10 minutes'
		 WHERE id = $1`,
		[id],
	);

	await findOrCreateSessionByKey(pool, sessionKey);

	const count = await pool.query<{ total: number }>(
		`SELECT count(*)::int AS total
		 FROM conversation_messages cm
		 JOIN conversation_sessions cs ON cs.id = cm.session_id
		 WHERE cs.session_key = $1`,
		[sessionKey],
	);

	assert.strictEqual(count.rows[0]?.total, 0);

	await cleanup(sessionKey);
});

test("listMessagesBySession returns the most recent messages in seq order", async () => {
	const sessionKey = deriveSessionKey("192.0.2.16");
	await cleanup(sessionKey);
	const sessionId = await findOrCreateSessionByKey(pool, sessionKey);

	await pool.query(
		`INSERT INTO conversation_messages (session_id, seq, role, content)
		 VALUES ($1, 1, 'user', 'uno'),
		        ($1, 2, 'assistant', 'dos'),
		        ($1, 3, 'user', 'tres')`,
		[sessionId],
	);

	const messages = await listMessagesBySession(pool, sessionId, 2);

	assert.deepStrictEqual(
		messages.map(({ seq, role, content }) => ({ seq, role, content })),
		[
			{ seq: 2, role: "assistant", content: "dos" },
			{ seq: 3, role: "user", content: "tres" },
		],
	);
	assert.match(messages[0]?.createdAt ?? "", /^\d{4}-\d{2}-\d{2}T/);

	await cleanup(sessionKey);
});

test("saveCompletedTurn stores user and assistant messages in one turn", async () => {
	const sessionKey = deriveSessionKey("192.0.2.17");
	await cleanup(sessionKey);

	await saveCompletedTurn(pool, sessionKey, "  pregunta  ", "  respuesta  ");

	const row = await pool.query<{ role: string; content: string; seq: number }>(
		`SELECT role, content, seq
		 FROM conversation_messages cm
		 JOIN conversation_sessions cs ON cs.id = cm.session_id
		 WHERE cs.session_key = $1
		 ORDER BY seq`,
		[sessionKey],
	);

	assert.deepStrictEqual(row.rows, [
		{ role: "user", content: "pregunta", seq: 1 },
		{ role: "assistant", content: "respuesta", seq: 2 },
	]);

	await cleanup(sessionKey);
});

test("saveCompletedTurn rolls back when the atomic insert fails", async () => {
	const queries: string[] = [];
	const fakeClient = {
		query: async (sql: string) => {
			queries.push(sql);
			if (sql === "BEGIN") return { rows: [] };
			if (sql.includes("INSERT INTO conversation_sessions")) {
				return { rows: [{ id: "session-1" }] };
			}
			if (sql.includes("SELECT id FROM conversation_sessions")) {
				return { rows: [{ id: "session-1" }] };
			}
			if (sql.includes("COALESCE(MAX(seq)")) {
				return { rows: [{ seq: 1 }] };
			}
			if (sql.includes("INSERT INTO conversation_messages")) {
				throw new Error("insert failed");
			}
			return { rows: [] };
		},
		release: () => undefined,
	};

	await assert.rejects(
		saveCompletedTurn(
			{ connect: async () => fakeClient } as never,
			"session-key",
			"question",
			"answer",
		),
		/insert failed/,
	);
	assert.ok(queries.includes("ROLLBACK"));
	assert.ok(!queries.includes("COMMIT"));
});
