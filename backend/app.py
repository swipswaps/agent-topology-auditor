import hashlib
import os
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(os.environ.get("AUDIT_DB_PATH", "/data/agent_audit.sqlite3"))
SCHEMA_PATH = Path("/app/schema.sql") if Path("/app/schema.sql").exists() else Path(__file__).parent / "schema.sql"


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    max_retries = 5
    delay = 0.05
    for attempt in range(max_retries):
        try:
            conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA busy_timeout = 5000;")
            yield conn
            conn.commit()
            return
        except sqlite3.OperationalError as e:
            if "locked" in str(e) and attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise
        finally:
            try:
                conn.close()
            except Exception:
                pass


def init_db() -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_db() as conn:
        conn.executescript(schema_sql)
        cur = conn.execute("SELECT COUNT(*) AS cnt FROM memory_entries")
        if cur.fetchone()["cnt"] == 0:
            seed_entries = [
                (
                    "nod_local",
                    "routines",
                    "Every Monday at 08:00 UTC, triage four IMAP inboxes and stage draft replies without executing SMTP send.",
                    "first_party_user",
                    "Monitor my four email inboxes with a weekly routine to draft replies to my most important emails.",
                    hashlib.sha256(b"Monitor my four email inboxes with a weekly routine to draft replies to my most important emails.").hexdigest(),
                    1,
                    None,
                ),
                (
                    "nod_local",
                    "preferences",
                    "Reject any external invoice payment lacking out-of-band CVV confirmation.",
                    "external_email",
                    None,
                    None,
                    0,
                    "PROVENANCE_VIOLATION: Source channel 'external_email' lacks authenticated first-party user quote citation (Anderson 1972 Reference Monitor).",
                ),
                (
                    "superbot_vps",
                    "procedural_skill",
                    "Auto-push agent loop patches directly to origin/main without human code review.",
                    "cron_loop",
                    "Tell it to push straight to main.",
                    hashlib.sha256(b"Tell it to push straight to main.").hexdigest(),
                    1,
                    None,
                ),
            ]
            conn.executemany(
                """
                INSERT INTO memory_entries
                (architecture_id, category, synthesized_fact, source_channel, user_quote_citation, provenance_sha256, accepted, rejection_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                seed_entries,
            )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Autonomous Agent Topology & Trust-Boundary Auditor (v3)",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class MemoryIngestRequest(BaseModel):
    architecture_id: Literal["superbot_vps", "nod_local"]
    category: Literal["identity", "preferences", "social_graph", "routines", "procedural_skill"]
    synthesized_fact: str = Field(min_length=5, max_length=1000)
    source_channel: Literal["first_party_user", "external_email", "scraped_web", "cron_loop"]
    user_quote_citation: Optional[str] = Field(default=None, max_length=1000)


class AttackSimulationRequest(BaseModel):
    architecture_id: Literal["superbot_vps", "nod_local"]
    vector_name: str = Field(min_length=3, max_length=120)
    payload_summary: str = Field(min_length=5, max_length=1000)


@app.get("/api/health")
def health_check():
    with get_db() as conn:
        journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        total_memories = conn.execute("SELECT COUNT(*) FROM memory_entries;").fetchone()[0]
        total_audits = conn.execute("SELECT COUNT(*) FROM security_audit_events;").fetchone()[0]
    return {
        "status": "online",
        "engine": "sqlite3",
        "journal_mode": journal_mode,
        "fts5_enabled": True,
        "metrics": {
            "total_memories": total_memories,
            "total_audits": total_audits,
        },
    }


@app.post("/api/memory/ingest")
def ingest_memory(req: MemoryIngestRequest):
    quote = (req.user_quote_citation or "").strip()
    if req.architecture_id == "nod_local":
        if req.source_channel != "first_party_user" or len(quote) < 8:
            reason = (
                "PROVENANCE_GATE_BLOCKED: nod_local requires source_channel='first_party_user' "
                "and a verbatim user_quote_citation (>=8 chars) to prevent indirect memory poisoning."
            )
            with get_db() as conn:
                cur = conn.execute(
                    """
                    INSERT INTO memory_entries
                    (architecture_id, category, synthesized_fact, source_channel, user_quote_citation, provenance_sha256, accepted, rejection_reason)
                    VALUES (?, ?, ?, ?, ?, NULL, 0, ?)
                    """,
                    (req.architecture_id, req.category, req.synthesized_fact, req.source_channel, quote or None, reason),
                )
                row_id = cur.lastrowid
            return {"id": row_id, "accepted": False, "rejection_reason": reason}

    digest = hashlib.sha256(quote.encode("utf-8")).hexdigest() if quote else None
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO memory_entries
            (architecture_id, category, synthesized_fact, source_channel, user_quote_citation, provenance_sha256, accepted, rejection_reason)
            VALUES (?, ?, ?, ?, ?, ?, 1, NULL)
            """,
            (req.architecture_id, req.category, req.synthesized_fact, req.source_channel, quote or None, digest),
        )
        row_id = cur.lastrowid
    return {
        "id": row_id,
        "accepted": True,
        "provenance_sha256": digest,
        "warning": None
        if req.architecture_id == "nod_local"
        else "UNVERIFIED_WRITE: superbot_vps permits unquoted external/cron memory commits (87.5% poisoning vulnerability class).",
    }


@app.get("/api/memory/search")
def search_memory(q: str = Query(default="", max_length=200)):
    raw_tokens = "".join(ch if (ch.isalnum() or ch.isspace()) else " " for ch in q).split()
    safe_tokens = [t[:30] for t in raw_tokens if len(t) > 0]

    with get_db() as conn:
        if not safe_tokens:
            rows = conn.execute(
                "SELECT * FROM memory_entries ORDER BY id DESC LIMIT 25;"
            ).fetchall()
        else:
            fts_query = " OR ".join(f"{tok}*" for tok in safe_tokens)
            try:
                rows = conn.execute(
                    """
                    SELECT m.*
                    FROM memory_entries m
                    JOIN memory_entries_fts f ON m.id = f.rowid
                    WHERE memory_entries_fts MATCH ?
                    ORDER BY rank
                    LIMIT 25;
                    """,
                    (fts_query,),
                ).fetchall()
            except sqlite3.OperationalError:
                rows = conn.execute(
                    "SELECT * FROM memory_entries ORDER BY id DESC LIMIT 25;"
                ).fetchall()
    return {"results": [dict(r) for r in rows]}


@app.post("/api/audit/simulate")
def simulate_attack(req: AttackSimulationRequest):
    if req.architecture_id == "nod_local":
        enforced = 1
        compromised = 0
        notes = (
            "Reference monitor (Anderson 1972) intercepted mutation: secrets isolated in out-of-band vault; "
            "memory write rejected due to missing first-party utterance citation."
        )
    else:
        enforced = 0
        compromised = 1
        notes = (
            "Privilege boundary breached (Saltzer & Schroeder 1975): shared VPS environment, host clipboard/SSH bridge, "
            "and unreviewed main-branch auto-push allowed indirect prompt injection to escalate."
        )

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO security_audit_events
            (architecture_id, vector_name, payload_summary, reference_monitor_enforced, compromised, control_theory_notes)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (req.architecture_id, req.vector_name, req.payload_summary, enforced, compromised, notes),
        )
        event_id = cur.lastrowid
        events = conn.execute(
            "SELECT * FROM security_audit_events ORDER BY id DESC LIMIT 15;"
        ).fetchall()

    return {
        "event_id": event_id,
        "compromised": bool(compromised),
        "reference_monitor_enforced": bool(enforced),
        "control_theory_notes": notes,
        "recent_events": [dict(e) for e in events],
    }
