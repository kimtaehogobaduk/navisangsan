import { getPool } from "@/lib/db.server";

export { getPool };

type WhereClause = { column: string; op: string; value: unknown };
type UpdateData = Record<string, unknown>;

class TableQuery {
  private _table: string;
  private _wheres: WhereClause[] = [];
  private _inClause: { column: string; values: unknown[] } | null = null;
  private _selectCols = "*";
  private _orderCols: Array<{ col: string; asc: boolean }> = [];
  private _limitVal: number | null = null;
  private _isMaybeSingle = false;
  private _isSingle = false;

  constructor(table: string) {
    this._table = table;
  }

  select(cols: string) {
    this._selectCols = cols;
    return this;
  }

  eq(col: string, val: unknown) {
    this._wheres.push({ column: col, op: "=", value: val });
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._inClause = { column: col, values: vals };
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
    return this._execute() as Promise<{ data: Record<string, unknown> | null; error: null }>;
  }

  single() {
    this._isSingle = true;
    return this._execute() as Promise<{ data: Record<string, unknown>; error: null }>;
  }

  then(
    resolve: (val: { data: unknown; error: null }) => void,
    reject: (e: unknown) => void,
  ) {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: unknown; error: null }> {
    const pool = getPool();
    const params: unknown[] = [];
    let idx = 1;

    const whereParts: string[] = [];
    for (const w of this._wheres) {
      whereParts.push(`"${w.column}" ${w.op} $${idx++}`);
      params.push(w.value);
    }
    if (this._inClause) {
      const placeholders = this._inClause.values.map(() => `$${idx++}`).join(", ");
      whereParts.push(`"${this._inClause.column}" IN (${placeholders})`);
      params.push(...this._inClause.values);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const order =
      this._orderCols.length > 0
        ? `ORDER BY ${this._orderCols.map((o) => `"${o.col}" ${o.asc ? "ASC" : "DESC"}`).join(", ")}`
        : "";
    const limit = this._limitVal !== null ? `LIMIT ${this._limitVal}` : "";

    const sql = `SELECT ${this._selectCols === "*" ? "*" : this._selectCols} FROM "${this._table}" ${where} ${order} ${limit}`.trim();
    const res = await pool.query(sql, params);

    if (this._isMaybeSingle || this._isSingle) {
      return { data: res.rows[0] ?? null, error: null };
    }
    return { data: res.rows, error: null };
  }

  async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    const pool = getPool();
    const rows = Array.isArray(data) ? data : [data];
    let lastRow: Record<string, unknown> | null = null;
    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = keys.map((k) => {
        const v = row[k];
        return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
      });
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const res = await pool.query(
        `INSERT INTO "${this._table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      lastRow = res.rows[0] ?? null;
    }
    return {
      data: lastRow,
      error: null,
      select: (_cols?: string) => ({
        single: async () => ({ data: lastRow, error: null }),
      }),
    };
  }

  async update(data: UpdateData) {
    const pool = getPool();
    const keys = Object.keys(data);
    const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const vals: unknown[] = keys.map((k) => {
      const v = data[k];
      return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
    });
    let idx = keys.length + 1;

    const whereParts: string[] = [];
    for (const w of this._wheres) {
      whereParts.push(`"${w.column}" ${w.op} $${idx++}`);
      vals.push(w.value);
    }
    if (this._inClause) {
      const placeholders = this._inClause.values.map(() => `$${idx++}`).join(", ");
      whereParts.push(`"${this._inClause.column}" IN (${placeholders})`);
      vals.push(...this._inClause.values);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const sql = `UPDATE "${this._table}" SET ${sets} ${where}`.trim();
    await pool.query(sql, vals);
    return { data: null, error: null };
  }

  async upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ) {
    const pool = getPool();
    const rows = Array.isArray(data) ? data : [data];
    const conflict = opts?.onConflict ?? "id";

    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = keys.map((k) => {
        const v = row[k];
        return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
      });
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const conflictCols = conflict
        .split(",")
        .map((c) => `"${c.trim()}"`)
        .join(", ");
      const updates = keys
        .filter((k) => !conflict.split(",").map((c) => c.trim()).includes(k))
        .map((k) => `"${k}" = EXCLUDED."${k}"`)
        .join(", ");
      const upsertSuffix = updates
        ? `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`
        : `ON CONFLICT (${conflictCols}) DO NOTHING`;
      await pool.query(
        `INSERT INTO "${this._table}" (${cols}) VALUES (${placeholders}) ${upsertSuffix}`,
        vals,
      );
    }
    return { error: null };
  }

  async delete() {
    const pool = getPool();
    const params: unknown[] = [];
    let idx = 1;

    const whereParts: string[] = [];
    for (const w of this._wheres) {
      whereParts.push(`"${w.column}" ${w.op} $${idx++}`);
      params.push(w.value);
    }
    if (this._inClause) {
      const placeholders = this._inClause.values.map(() => `$${idx++}`).join(", ");
      whereParts.push(`"${this._inClause.column}" IN (${placeholders})`);
      params.push(...this._inClause.values);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    await pool.query(`DELETE FROM "${this._table}" ${where}`.trim(), params);
    return { error: null };
  }
}

export const supabaseAdmin = {
  from: (table: string) => new TableQuery(table),
  auth: {
    admin: {
      listUsers: async (_opts?: { page?: number; perPage?: number }) => {
        return { data: { users: [] as Array<{ id: string; email?: string; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null }> }, error: null };
      },
    },
    getClaims: async (_token: string) => ({
      data: null as null,
      error: new Error("not supported"),
    }),
  },
};
