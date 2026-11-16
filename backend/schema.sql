PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS memory_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    architecture_id TEXT NOT NULL CHECK (architecture_id IN ('superbot_vps', 'nod_local')),
    category TEXT NOT NULL CHECK (category IN ('identity', 'preferences', 'social_graph', 'routines', 'procedural_skill')),
    synthesized_fact TEXT NOT NULL,
    source_channel TEXT NOT NULL CHECK (source_channel IN ('first_party_user', 'external_email', 'scraped_web', 'cron_loop')),
    user_quote_citation TEXT,
    provenance_sha256 TEXT,
    accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts USING fts5(
    synthesized_fact,
    user_quote_citation,
    category,
    architecture_id,
    content='memory_entries',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS memory_entries_ai AFTER INSERT ON memory_entries BEGIN
    INSERT INTO memory_entries_fts(rowid, synthesized_fact, user_quote_citation, category, architecture_id)
    VALUES (new.id, new.synthesized_fact, COALESCE(new.user_quote_citation, ''), new.category, new.architecture_id);
END;

CREATE TRIGGER IF NOT EXISTS memory_entries_ad AFTER DELETE ON memory_entries BEGIN
    INSERT INTO memory_entries_fts(memory_entries_fts, rowid, synthesized_fact, user_quote_citation, category, architecture_id)
    VALUES ('delete', old.id, old.synthesized_fact, COALESCE(old.user_quote_citation, ''), old.category, old.architecture_id);
END;

CREATE TABLE IF NOT EXISTS security_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    architecture_id TEXT NOT NULL,
    vector_name TEXT NOT NULL,
    payload_summary TEXT NOT NULL,
    reference_monitor_enforced INTEGER NOT NULL CHECK (reference_monitor_enforced IN (0, 1)),
    compromised INTEGER NOT NULL CHECK (compromised IN (0, 1)),
    control_theory_notes TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
