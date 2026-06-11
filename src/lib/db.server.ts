import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function initDb() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admissions_info (
      id BIGSERIAL PRIMARY KEY,
      topic_key VARCHAR(255) UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      bullets JSONB DEFAULT '[]'::jsonb,
      target_grade VARCHAR(50) NOT NULL DEFAULT '공통',
      universities JSONB DEFAULT '[]'::jsonb,
      info_type VARCHAR(100) NOT NULL DEFAULT '입시정보',
      importance INTEGER DEFAULT 3,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS school_research (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_key TEXT NOT NULL UNIQUE,
      school_name TEXT NOT NULL,
      region TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_docs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_type TEXT NOT NULL DEFAULT 'youtube',
      url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '기타',
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      doc_id UUID REFERENCES training_docs(id) ON DELETE SET NULL,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS training_jobs_status_idx ON training_jobs(status, created_at)
  `);

  console.log("[DB] Tables initialized");
}

export type AdmissionsRow = {
  id: number;
  topic_key: string;
  title: string;
  summary: string;
  bullets: string[];
  target_grade: string;
  universities: string[];
  info_type: string;
  importance: number;
  fetched_at: string;
  created_at: string;
};

export async function upsertAdmissionsInfo(
  items: {
    topic_key: string;
    title: string;
    summary: string;
    bullets: string[];
    target_grade: string;
    universities: string[];
    info_type: string;
    importance: number;
  }[],
) {
  if (!items.length) return;
  const pool = getPool();
  for (const i of items) {
    await pool.query(
      `INSERT INTO admissions_info (topic_key, title, summary, bullets, target_grade, universities, info_type, importance, fetched_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, NOW())
       ON CONFLICT (topic_key) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         bullets = EXCLUDED.bullets,
         target_grade = EXCLUDED.target_grade,
         universities = EXCLUDED.universities,
         info_type = EXCLUDED.info_type,
         importance = EXCLUDED.importance,
         fetched_at = NOW()`,
      [
        i.topic_key,
        i.title,
        i.summary,
        JSON.stringify(i.bullets),
        i.target_grade,
        JSON.stringify(i.universities),
        i.info_type,
        i.importance,
      ],
    );
  }
}

export async function getAllAdmissionsInfo(): Promise<AdmissionsRow[]> {
  const rows = await query<AdmissionsRow>(
    `SELECT * FROM admissions_info ORDER BY importance DESC, fetched_at DESC`,
  );
  return rows;
}

export async function getLastFetchedAt(): Promise<Date | null> {
  const row = await queryOne<{ fetched_at: string }>(
    `SELECT fetched_at FROM admissions_info ORDER BY fetched_at DESC LIMIT 1`,
  );
  return row ? new Date(row.fetched_at) : null;
}
