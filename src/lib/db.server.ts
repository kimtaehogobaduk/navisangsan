import pg from "pg";
const { Pool } = pg;

let _pool: InstanceType<typeof Pool> | null = null;

function getPool(): InstanceType<typeof Pool> {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function dbQuery(sql: string, params?: unknown[]) {
  return getPool().query(sql, params as unknown[]);
}

let _dbInitialized = false;
let _initPromise: Promise<void> | null = null;

export async function initDb() {
  if (_dbInitialized) return;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS admissions_info (
          id SERIAL PRIMARY KEY,
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
      _dbInitialized = true;
      console.log("[NAVI] admissions_info table ready");
    } catch (err: unknown) {
      // 동시 CREATE 경쟁 조건 — 이미 생성됐으면 무시
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists") || msg.includes("duplicate key")) {
        _dbInitialized = true;
        return;
      }
      throw err;
    }
  })();
  return _initPromise;
}

export async function upsertAdmissionsInfo(items: {
  topic_key: string;
  title: string;
  summary: string;
  bullets: string[];
  target_grade: string;
  universities: string[];
  info_type: string;
  importance: number;
}[]) {
  for (const item of items) {
    await dbQuery(
      `INSERT INTO admissions_info
        (topic_key, title, summary, bullets, target_grade, universities, info_type, importance, fetched_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8, NOW())
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
        item.topic_key,
        item.title,
        item.summary,
        JSON.stringify(item.bullets),
        item.target_grade,
        JSON.stringify(item.universities),
        item.info_type,
        item.importance,
      ]
    );
  }
}

export async function getAllAdmissionsInfo() {
  await initDb(); // 테이블 없으면 자동 생성
  const res = await dbQuery(
    `SELECT * FROM admissions_info ORDER BY importance DESC, fetched_at DESC`
  );
  return res.rows as {
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
  }[];
}

export async function getLastFetchedAt(): Promise<Date | null> {
  await initDb();
  const res = await dbQuery(
    `SELECT MAX(fetched_at) as last FROM admissions_info`
  );
  return res.rows[0]?.last ?? null;
}
