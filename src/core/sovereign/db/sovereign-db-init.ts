// db/sovereign-db-init.ts
// Browser / worker bootstrap helper.
// Creates a PGLite instance, applies the schema, and returns it as PgLiteLike.
// Import this module in browser/worker contexts; in tests use testing/make-test-db.ts.

import type { PgLiteLike } from "./pglite-client";
import type { ExecPgLike } from "./init-schema";
import { initSchema } from "./init-schema";

export interface DbInitOptions {
  /** "memory" = in-process (default). "idb" = persisted via IndexedDB. */
  persistence?: "memory" | "idb";
  /** IDB database name when persistence="idb". Defaults to "sovereign". */
  dbName?: string;
  /**
   * Schema version to initialise. When >= 2 the v2 additive migration
   * (sovereign-schema-v2.sql) is applied after the v1 schema.
   * Defaults to 1 for backwards compatibility.
   */
  schemaVersion?: number;
  /** Full contents of sovereign-schema-v2.sql (required when schemaVersion >= 2). */
  schemaSqlV2?: string;
  /** Full contents of sovereign-schema-v3.sql (required when schemaVersion >= 3). */
  schemaSqlV3?: string;
  /** Full contents of sovereign-schema-v4.sql (required when schemaVersion >= 4). */
  schemaSqlV4?: string;
  /** Full contents of sovereign-schema-v5.sql (required when schemaVersion >= 5). */
  schemaSqlV5?: string;
}

/**
 * Initialises Sovereign's PGLite database.
 * Dynamically imports `@electric-sql/pglite` so the module is only bundled
 * when actually needed (tree-shakeable for non-browser builds).
 *
 * @param schemaSql  Full contents of sovereign-schema-v1.sql (or later migration).
 * @param opts       Persistence and naming options.
 * @returns          A PgLiteLike instance ready for use by the engine.
 */
export async function initSovereignDb(
  schemaSql: string,
  opts: DbInitOptions = {}
): Promise<PgLiteLike> {
  // 1. Cloud-Native Server-Side Postgres (Google Cloud SQL connection)
  if (typeof process !== "undefined" && process?.env?.DATABASE_URL) {
    try {
      // Dynamically import pg so it doesn't break client/worker bundles
      const pg = await import("pg");
      const Pool = pg.Pool || (pg.default as any).Pool;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      const pgClient = {
        query: async (sql: string, params?: unknown[]) => {
          const res = await pool.query(sql, params as any[]);
          return { rows: res.rows };
        },
        exec: async (sql: string) => pool.query(sql)
      } as ExecPgLike;

      await initSchema(pgClient, schemaSql);
      if ((opts.schemaVersion ?? 1) >= 2 && opts.schemaSqlV2) await initSchema(pgClient, opts.schemaSqlV2);
      if ((opts.schemaVersion ?? 1) >= 3 && opts.schemaSqlV3) await initSchema(pgClient, opts.schemaSqlV3);
      if ((opts.schemaVersion ?? 1) >= 4 && opts.schemaSqlV4) await initSchema(pgClient, opts.schemaSqlV4);
      if ((opts.schemaVersion ?? 1) >= 5 && opts.schemaSqlV5) await initSchema(pgClient, opts.schemaSqlV5);

      return pgClient as PgLiteLike;
    } catch (e) {
      console.warn("Failed to load 'pg' module or connect to DATABASE_URL. Falling back to PGLite.", e);
    }
  }

  // 2. Local/Offline fallback or Worker context (PGLite WASM)
  const { PGlite } = await import("@electric-sql/pglite");
  const persistence = opts.persistence ?? "memory";
  const dbName = opts.dbName ?? "sovereign";

  const db = persistence === "idb"
    ? new PGlite(`idb://${dbName}`)
    : new PGlite();

  await initSchema(db as unknown as ExecPgLike, schemaSql);

  if ((opts.schemaVersion ?? 1) >= 2 && opts.schemaSqlV2) {
    await initSchema(db as unknown as ExecPgLike, opts.schemaSqlV2);
  }

  if ((opts.schemaVersion ?? 1) >= 3 && opts.schemaSqlV3) {
    await initSchema(db as unknown as ExecPgLike, opts.schemaSqlV3);
  }

  if ((opts.schemaVersion ?? 1) >= 4 && opts.schemaSqlV4) {
    await initSchema(db as unknown as ExecPgLike, opts.schemaSqlV4);
  }

  if ((opts.schemaVersion ?? 1) >= 5 && opts.schemaSqlV5) {
    await initSchema(db as unknown as ExecPgLike, opts.schemaSqlV5);
  }

  return db as unknown as PgLiteLike;
}
