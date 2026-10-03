import assert from "node:assert";
import { createHmac, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Pool } from "pg";
import { runCleanupOnce } from "../../src/plugins/cleanup";
import { readHistoryCleanupSchedule } from "../../src/services/history.contract";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

after(async () => {
	await pool.end();
});

const fakeLog = {
	info: () => {},
	warn: () => {},
	error: () => {},
	debug: () => {},
	trace: () => {},
	fatal: () => {},
	child: () => fakeLog,
	level: "info",
	silent: () => {},
};

const deriveKey = (suffix: string): string => {
	const secret = process.env.HISTORY_HMAC_SECRET?.trim() ?? "";
	return createHmac("sha256", secret)
		.update(`${suffix}-${randomUUID()}`)
		.digest("hex");
};

const insertExpiredSession = async (suffix: string) => {
	const sessionKey = deriveKey(suffix);
	const result = await pool.query<{ id: string }>(
		`INSERT INTO conversation_sessions
		 (session_key, created_at, last_activity_at, expires_at)
		 VALUES ($1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '90 minutes',
		         NOW() - INTERVAL '1 hour')
		 RETURNING id`,
		[sessionKey],
	);
	return { id: result.rows[0]!.id, sessionKey };
};

const insertActiveSession = async (suffix: string) => {
	const sessionKey = deriveKey(suffix);
	const result = await pool.query<{ id: string }>(
		`INSERT INTO conversation_sessions (session_key, expires_at)
		 VALUES ($1, NOW() + INTERVAL '15 minutes')
		 RETURNING id`,
		[sessionKey],
	);
	return { id: result.rows[0]!.id, sessionKey };
};

const cleanup = async (sessionKey: string) => {
	await pool.query("DELETE FROM conversation_sessions WHERE session_key = $1", [
		sessionKey,
	]);
};

test("runCleanupOnce deletes expired sessions and their messages", async () => {
	const session = await insertExpiredSession("198.51.100.10");
	await pool.query(
		`INSERT INTO conversation_messages (session_id, seq, role, content)
		 VALUES ($1, 1, 'user', 'hola')`,
		[session.id],
	);

	const deleted = await runCleanupOnce(pool, fakeLog as never);

	assert.ok(deleted >= 1, `expected at least one deletion, got ${deleted}`);
	const sessions = await pool.query(
		"SELECT 1 FROM conversation_sessions WHERE id = $1",
		[session.id],
	);
	assert.strictEqual(sessions.rowCount, 0);
	const messages = await pool.query(
		"SELECT 1 FROM conversation_messages WHERE session_id = $1",
		[session.id],
	);
	assert.strictEqual(messages.rowCount, 0);
});

test("runCleanupOnce keeps active sessions", async () => {
	const session = await insertActiveSession("198.51.100.11");

	await runCleanupOnce(pool, fakeLog as never);

	const sessions = await pool.query(
		"SELECT 1 FROM conversation_sessions WHERE id = $1",
		[session.id],
	);
	assert.strictEqual(sessions.rowCount, 1);

	await cleanup(session.sessionKey);
});

test("readHistoryCleanupSchedule defaults to a daily 03:00 cron", () => {
	assert.strictEqual(readHistoryCleanupSchedule({}), "0 3 * * *");
});

test("readHistoryCleanupSchedule accepts a 5-field cron expression", () => {
	assert.strictEqual(
		readHistoryCleanupSchedule({ HISTORY_CLEANUP_SCHEDULE: "*/15 * * * *" }),
		"*/15 * * * *",
	);
});

test("readHistoryCleanupSchedule rejects malformed cron expressions", () => {
	assert.throws(
		() => readHistoryCleanupSchedule({ HISTORY_CLEANUP_SCHEDULE: "every 5 minutes" }),
		/HISTORY_CLEANUP_SCHEDULE must be a 5 field cron expression/,
	);
	assert.throws(
		() => readHistoryCleanupSchedule({ HISTORY_CLEANUP_SCHEDULE: "0 0 * *" }),
		/HISTORY_CLEANUP_SCHEDULE must be a 5 field cron expression/,
	);
});

test("runCleanupOnce cascades every message of an expired session, not only the latest one", async () => {
	const session = await insertExpiredSession("198.51.100.30");
	await pool.query(
		`INSERT INTO conversation_messages (session_id, seq, role, content)
		 VALUES ($1, 1, 'user', 'u1'),
		        ($1, 2, 'assistant', 'a1'),
		        ($1, 3, 'user', 'u2'),
		        ($1, 4, 'assistant', 'a2'),
		        ($1, 5, 'user', 'u3')`,
		[session.id],
	);

	await runCleanupOnce(pool, fakeLog as never);

	const remaining = await pool.query<{ total: number }>(
		"SELECT COUNT(*)::int AS total FROM conversation_messages WHERE session_id = $1",
		[session.id],
	);
	assert.strictEqual(
		remaining.rows[0]?.total,
		0,
		"every message of the expired session must be removed through the cascade",
	);
});

test("runCleanupOnce never deletes messages that belong to an active session", async () => {
	const expired = await insertExpiredSession("198.51.100.40");
	const active = await insertActiveSession("198.51.100.41");
	await pool.query(
		`INSERT INTO conversation_messages (session_id, seq, role, content)
		 VALUES ($1, 1, 'user', 'caduca-1'),
		        ($1, 2, 'assistant', 'caduca-2'),
		        ($2, 1, 'user', 'viva-1'),
		        ($2, 2, 'assistant', 'viva-2'),
		        ($2, 3, 'user', 'viva-3')`,
		[expired.id, active.id],
	);

	await runCleanupOnce(pool, fakeLog as never);

	const expiredMessages = await pool.query<{ total: number }>(
		"SELECT COUNT(*)::int AS total FROM conversation_messages WHERE session_id = $1",
		[expired.id],
	);
	assert.strictEqual(expiredMessages.rows[0]?.total, 0);

	const activeMessages = await pool.query<{ total: number }>(
		"SELECT COUNT(*)::int AS total FROM conversation_messages WHERE session_id = $1",
		[active.id],
	);
	assert.strictEqual(
		activeMessages.rows[0]?.total,
		3,
		"all active session messages must survive the cleanup",
	);

	await cleanup(active.sessionKey);
});

test("runCleanupOnce returns zero when there are no expired sessions left", async () => {
	const deleted = await runCleanupOnce(pool, fakeLog as never);
	assert.strictEqual(
		deleted,
		0,
		"a second cleanup with nothing to delete must report zero deletions",
	);
});

test("conversation_messages.session_id cascades on parent delete", async () => {
	const constraint = await pool.query<{
		conname: string;
		confdeltype: string;
	}>(
		`SELECT conname, confdeltype
		 FROM pg_constraint
		 WHERE conrelid = 'conversation_messages'::regclass
		   AND contype = 'f'
		   AND pg_get_constraintdef(oid) LIKE '%conversation_sessions%'`,
	);

	assert.strictEqual(
		constraint.rowCount,
		1,
		"expected exactly one foreign key from conversation_messages to conversation_sessions",
	);
	assert.strictEqual(
		constraint.rows[0]?.confdeltype,
		"c",
		"the foreign key must use ON DELETE CASCADE (confdeltype = 'c')",
	);
});
