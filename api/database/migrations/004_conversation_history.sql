CREATE TABLE IF NOT EXISTS conversation_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT conversation_sessions_session_key_not_empty
    CHECK (length(btrim(session_key)) > 0),
  CONSTRAINT conversation_sessions_expiry_after_creation
    CHECK (expires_at >= created_at)
);

CREATE INDEX IF NOT EXISTS conversation_sessions_expires_at_idx
  ON conversation_sessions (expires_at);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL
    REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_messages_session_seq_unique
    UNIQUE (session_id, seq),
  CONSTRAINT conversation_messages_seq_positive
    CHECK (seq > 0),
  CONSTRAINT conversation_messages_role_valid
    CHECK (role IN ('user', 'assistant')),
  CONSTRAINT conversation_messages_content_not_empty
    CHECK (length(btrim(content)) > 0)
);
