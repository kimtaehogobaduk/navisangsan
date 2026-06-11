---
name: Dual-environment DB adapter
description: How NAVI auto-selects Supabase vs PostgreSQL depending on which env vars are present.
---

# Dual-environment DB adapter

**Rule:** Never hardcode Supabase or pg — always go through `supabaseAdmin` from `src/integrations/supabase/client.server.ts`.

**How it works:**
- If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are in `process.env` → real `@supabase/supabase-js` admin client is used (Lovable/GitHub environment).
- Otherwise → custom `QueryBuilder` / `MutateBuilder` pg adapter is used (Replit environment).

**Client side (`client.ts`):**
- If `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` are in `import.meta.env` → real Supabase browser client.
- Otherwise → no-op stub (auth methods return friendly Korean error messages).

**Why:** The user wants the same codebase to work on both Lovable (Supabase) and Replit (PostgreSQL) without any code changes between environments.

**How to apply:** Any new server function that needs DB access should import `supabaseAdmin` from `@/integrations/supabase/client.server` and use the standard Supabase-style chaining API. The adapter handles the rest.

**Key env vars:**
- Replit: `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (auto-provisioned)
- Lovable: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- AI keys (both): `CEREBRAS_API_KEY`, `GROQ_API_KEY`
