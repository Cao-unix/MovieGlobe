import json
import sqlite3
import uuid
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


def utc_now():
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Storage:
    db_path: Path

    def __post_init__(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with closing(self._connect()) as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    douban_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    message TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_jobs_douban_id ON jobs(douban_id);

                CREATE TABLE IF NOT EXISTS reports (
                    douban_id TEXT PRIMARY KEY,
                    movie_count INTEGER NOT NULL,
                    point_count INTEGER NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.commit()

    def mark_processing_jobs_failed(self):
        now = utc_now()
        with closing(self._connect()) as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, error = ?, updated_at = ?
                WHERE status = ?
                """,
                ("failed", "Server restarted before the job finished.", now, "processing"),
            )
            conn.commit()

    def create_job(self, douban_id):
        now = utc_now()
        job_id = str(uuid.uuid4())
        with closing(self._connect()) as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, douban_id, status, progress, message, error, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (job_id, douban_id, "queued", 0, "Waiting in queue.", None, now, now),
            )
            conn.commit()
        return self.get_job(job_id)

    def get_active_job(self, douban_id):
        with closing(self._connect()) as conn:
            row = conn.execute(
                """
                SELECT * FROM jobs
                WHERE douban_id = ? AND status IN ('queued', 'processing')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (douban_id,),
            ).fetchone()
        return self._row_to_job(row) if row else None

    def get_job(self, job_id):
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return self._row_to_job(row) if row else None

    def update_job(self, job_id, **fields):
        if not fields:
            return self.get_job(job_id)
        fields["updated_at"] = utc_now()
        columns = ", ".join(f"{key} = ?" for key in fields)
        values = list(fields.values()) + [job_id]
        with closing(self._connect()) as conn:
            conn.execute(f"UPDATE jobs SET {columns} WHERE id = ?", values)
            conn.commit()
        return self.get_job(job_id)

    def save_report(self, report):
        now = utc_now()
        payload = json.dumps(report, ensure_ascii=False)
        with closing(self._connect()) as conn:
            existing = conn.execute(
                "SELECT douban_id, created_at FROM reports WHERE douban_id = ?",
                (report["douban_id"],),
            ).fetchone()
            created_at = existing["created_at"] if existing else now
            conn.execute(
                """
                INSERT OR REPLACE INTO reports (
                    douban_id, movie_count, point_count, payload, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    report["douban_id"],
                    report["movie_count"],
                    report["point_count"],
                    payload,
                    created_at,
                    now,
                ),
            )
            conn.commit()
        return self.get_report(report["douban_id"])

    def get_report(self, douban_id):
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT * FROM reports WHERE douban_id = ?",
                (douban_id,),
            ).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload"])
        return {
            "douban_id": row["douban_id"],
            "movie_count": row["movie_count"],
            "point_count": row["point_count"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "payload": payload,
        }

    def list_recent_reports(self, limit=8):
        with closing(self._connect()) as conn:
            rows = conn.execute(
                """
                SELECT douban_id, movie_count, point_count, payload, updated_at
                FROM reports
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        recent = []
        for row in rows:
            payload = json.loads(row["payload"])
            recent.append(
                {
                    "douban_id": row["douban_id"],
                    "movie_count": row["movie_count"],
                    "point_count": row["point_count"],
                    "updated_at": row["updated_at"],
                    "title": payload.get("title") or f"Douban {row['douban_id']}",
                }
            )
        return recent

    def _row_to_job(self, row):
        if not row:
            return None
        return {
            "id": row["id"],
            "douban_id": row["douban_id"],
            "status": row["status"],
            "progress": row["progress"],
            "message": row["message"],
            "error": row["error"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
