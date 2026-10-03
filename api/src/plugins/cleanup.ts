import type { FastifyBaseLogger, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import cron, { type ScheduledTask } from "node-cron";
import type { Pool } from "pg";
import "@fastify/postgres";
import { historyCleanupSchedule } from "../services/history.contract";

type CleanupClient = Pick<Pool, "query">;

export const runCleanupOnce = async (
	client: CleanupClient,
	log: FastifyBaseLogger,
): Promise<number> => {
	const result = await client.query(
		"DELETE FROM conversation_sessions WHERE expires_at < NOW()",
	);
	const deleted = result.rowCount ?? 0;
	log.info({ deleted }, "history cleanup completed");
	return deleted;
};

const cleanup: FastifyPluginAsync = async (fastify) => {
	const task: ScheduledTask = cron.schedule(historyCleanupSchedule, () => {
		void runCleanupOnce(fastify.pg, fastify.log).catch((error: unknown) => {
			fastify.log.error({ err: error }, "history cleanup failed");
		});
	});

	fastify.addHook("onClose", () => {
		task.stop();
	});
};

export default fp(cleanup);
