-- Rollback: remove temporary conversation history tables.
-- These tables are not required because the client now sends history
-- with each request and the server no longer persists it.

DROP TABLE IF EXISTS conversation_messages;
DROP TABLE IF EXISTS conversation_sessions;
