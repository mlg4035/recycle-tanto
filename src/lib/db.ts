import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbDir = path.join(process.cwd(), "data");
const dbPath = path.join(dbDir, "recycletanto.db");

function createDb() {
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      handwritingocr_document_id TEXT,
      result_json TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_document_id ON jobs(handwritingocr_document_id);

    CREATE TABLE IF NOT EXISTS upload_attempts (
      ip TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_upload_attempts_ip_created_at
      ON upload_attempts(ip, created_at);
  `);

  return db;
}

declare global {
  var __recycleTantoDb: Database.Database | undefined;
}

export const db = global.__recycleTantoDb ?? createDb();

if (process.env.NODE_ENV !== "production") {
  global.__recycleTantoDb = db;
}
