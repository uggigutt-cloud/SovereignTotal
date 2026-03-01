// db/init-schema.ts
// Bootstraps the Sovereign schema against any PGLite instance.
// PGLite exposes an `exec` method for multi-statement DDL; we declare it here
// as an extension of the minimal PgLiteLike interface.

import type { PgLiteLike } from "./pglite-client";

/** PGLite instances have `exec` for multi-statement SQL, in addition to `query`. */
export interface ExecPgLike extends PgLiteLike {
  exec: (sql: string) => Promise<unknown>;
}

/**
 * Runs the full Sovereign schema SQL against the database.
 * Safe to call repeatedly — all DDL uses IF NOT EXISTS guards.
 *
 * @param db   A PGLite instance exposing `.exec()`
 * @param sql  The schema SQL string (pass the contents of sovereign-schema-v1.sql)
 */
export async function initSchema(db: ExecPgLike, sql: string): Promise<void> {
  await db.exec(sql);
}
