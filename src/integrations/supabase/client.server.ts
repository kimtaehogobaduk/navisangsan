import { createClient } from "@supabase/supabase-js";
import { getPool } from "@/lib/db.server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = !!(SUPABASE_URL && SERVICE_KEY);

// ─── PostgreSQL adapter (used when Supabase is not configured) ──────────────

type WhereFilter = { col: string; op: string; val: unknown };
type InFilter = { col: string; vals: unknown[] };

function buildWhere(wheres: WhereFilter[], inClauses: InFilter[], startIdx = 1) {
  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;
  for (const w of wheres) {
    parts.push(`"${w.col}" ${w.op} $${idx++}`);
    params.push(w.val);
  }
  for (const ic of inClauses) {
    const placeholders = ic.vals.map(() => `$${idx++}`).join(", ");
    parts.push(`"${ic.col}" IN (${placeholders})`);
    params.push(...ic.vals);
  }
  return { clause: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

function serialize(v: unknown): unknown {
  return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
}

class MutateBuilder {
  private _table: string;
  private _op: "insert" | "update" | "upsert";
  private _data: Record<string, unknown> | Record<string, unknown>[];
  private _wheres: WhereFilter[] = [];
  private _inClauses: InFilter[] = [];
  private _opts: { onConflict?: string };
  private _returnCols = "*";
  private _isSingle = false;

  constructor(
    table: string,
    op: "insert" | "update" | "upsert",
    data: Record<string, unknown> | Record<string, unknown>[],
    opts: { onConflict?: string } = {},
  ) {
    this._table = table;
    this._op = op;
    this._data = data;
    this._opts = opts;
  }

  eq(col: string, val: unknown) {
    this._wheres.push({ col, op: "=", val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._inClauses.push({ col, vals });
    return this;
  }

  select(cols = "*") {
    this._returnCols = cols;
    return this;
  }

  single() {
    this._isSingle = true;
    return this._exec();
  }

  then(
    resolve: (v: { data: unknown; error: { message: string } | null }) => unknown,
    reject: (e: unknown) => unknown,
  ) {
    return this._exec().then(resolve, reject);
  }

  private async _exec(): Promise<{ data: unknown; error: { message: string } | null }> {
    const pool = getPool();
    try {
      if (this._op === "insert") {
        const rows = Array.isArray(this._data) ? this._data : [this._data];
        let lastRow: Record<string, unknown> | null = null;
        for (const row of rows) {
          const keys = Object.keys(row);
          const vals = keys.map((k) => serialize(row[k]));
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const returning =
            this._returnCols === "*" ? "RETURNING *" : `RETURNING ${this._returnCols}`;
          const res = await pool.query(
            `INSERT INTO "${this._table}" (${cols}) VALUES (${placeholders}) ${returning}`,
            vals,
          );
          lastRow = res.rows[0] ?? null;
        }
        return { data: lastRow, error: null };
      }

      if (this._op === "update") {
        const data = this._data as Record<string, unknown>;
        const keys = Object.keys(data);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
        const vals: unknown[] = keys.map((k) => serialize(data[k]));
        const { clause, params } = buildWhere(this._wheres, this._inClauses, keys.length + 1);
        await pool.query(`UPDATE "${this._table}" SET ${sets} ${clause}`.trim(), [
          ...vals,
          ...params,
        ]);
        return { data: null, error: null };
      }

      if (this._op === "upsert") {
        const rows = Array.isArray(this._data) ? this._data : [this._data];
        const conflict = this._opts.onConflict ?? "id";
        const conflictCols = conflict
          .split(",")
          .map((c) => `"${c.trim()}"`)
          .join(", ");
        const conflictKeys = conflict.split(",").map((c) => c.trim());
        for (const row of rows) {
          const keys = Object.keys(row);
          const vals = keys.map((k) => serialize(row[k]));
          const cols = keys.map((k) => `"${k}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const updates = keys
            .filter((k) => !conflictKeys.includes(k))
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(", ");
          const suffix = updates
            ? `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`
            : `ON CONFLICT (${conflictCols}) DO NOTHING`;
          await pool.query(
            `INSERT INTO "${this._table}" (${cols}) VALUES (${placeholders}) ${suffix}`,
            vals,
          );
        }
        return { data: null, error: null };
      }

      return { data: null, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[db] ${this._op} "${this._table}" 오류:`, message);
      return { data: null, error: { message } };
    }
  }
}

class QueryBuilder {
  private _table: string;
  private _wheres: WhereFilter[] = [];
  private _inClauses: InFilter[] = [];
  private _selectCols = "*";
  private _orderCols: { col: string; asc: boolean }[] = [];
  private _limitVal: number | null = null;
  private _isMaybeSingle = false;
  private _isSingle = false;
  private _pendingOp: "select" | "delete" | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select(cols = "*") {
    this._selectCols = cols;
    this._pendingOp = "select";
    return this;
  }

  eq(col: string, val: unknown) {
    this._wheres.push({ col, op: "=", val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._inClauses.push({ col, vals });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCols.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this._limitVal = n;
    return this;
  }

  maybeSingle() {
    this._isMaybeSingle = true;
    return this._execSelect();
  }

  single() {
    this._isSingle = true;
    return this._execSelect();
  }

  delete() {
    this._pendingOp = "delete";
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    return new MutateBuilder(this._table, "insert", data);
  }

  update(data: Record<string, unknown>) {
    const mb = new MutateBuilder(this._table, "update", data);
    for (const w of this._wheres) mb.eq(w.col, w.val);
    for (const ic of this._inClauses) mb.in(ic.col, ic.vals);
    return mb;
  }

  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ) {
    return new MutateBuilder(this._table, "upsert", data, opts);
  }

  then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
    if (this._pendingOp === "delete") return this._execDelete().then(resolve, reject);
    return this._execSelect().then(resolve, reject);
  }

  private async _execSelect(): Promise<{ data: unknown; error: null }> {
    const pool = getPool();
    const { clause, params } = buildWhere(this._wheres, this._inClauses);
    const orderSql = this._orderCols.length
      ? `ORDER BY ${this._orderCols.map((o) => `"${o.col}" ${o.asc ? "ASC" : "DESC"}`).join(", ")}`
      : "";
    const limitSql = this._limitVal !== null ? `LIMIT ${this._limitVal}` : "";
    const sql = `SELECT ${this._selectCols} FROM "${this._table}" ${clause} ${orderSql} ${limitSql}`
      .replace(/\s+/g, " ")
      .trim();
    const res = await pool.query(sql, params);
    if (this._isMaybeSingle || this._isSingle) {
      return { data: res.rows[0] ?? null, error: null };
    }
    return { data: res.rows, error: null };
  }

  private async _execDelete(): Promise<{ error: null }> {
    const pool = getPool();
    const { clause, params } = buildWhere(this._wheres, this._inClauses);
    await pool.query(`DELETE FROM "${this._table}" ${clause}`.trim(), params);
    return { error: null };
  }
}

// ─── pg adapter object (mirrors Supabase admin API shape) ─────────────────

const pgAdapter = {
  from: (table: string) => new QueryBuilder(table),
  auth: {
    admin: {
      listUsers: async (_opts?: { page?: number; perPage?: number }) => ({
        data: {
          users: [] as Array<{
            id: string;
            email?: string;
            created_at: string;
            last_sign_in_at?: string | null;
            email_confirmed_at?: string | null;
          }>,
        },
        error: null,
      }),
    },
    getClaims: async (_token: string) => ({
      data: null as null,
      error: new Error("Supabase not configured"),
    }),
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────

export const supabaseAdmin: typeof pgAdapter = hasSupabase
  ? (createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as typeof pgAdapter)
  : pgAdapter;

export { getPool };
