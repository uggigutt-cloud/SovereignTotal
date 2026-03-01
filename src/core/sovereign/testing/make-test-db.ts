// testing/make-test-db.ts
// Creates an in-memory PGLite database with the Sovereign schema applied.
// Used as the foundation for all integration tests.
/// <reference types="node" />

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { PgLiteLike } from "../db/pglite-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_SQL = readFileSync(
  join(__dirname, "../schema/sovereign-schema-v1.sql"),
  "utf-8"
);
const SCHEMA_V2_SQL = readFileSync(
  join(__dirname, "../schema/sovereign-schema-v2.sql"),
  "utf-8"
);
const SCHEMA_V3_SQL = readFileSync(
  join(__dirname, "../schema/sovereign-schema-v3.sql"),
  "utf-8"
);
const SCHEMA_V4_SQL = readFileSync(
  join(__dirname, "../schema/sovereign-schema-v4.sql"),
  "utf-8"
);

/** PGLite with exec exposed for schema initialization */
interface TestDb extends PgLiteLike {
  exec: (sql: string) => Promise<unknown>;
  close?: () => Promise<void>;
}

/**
 * Creates an in-memory PGLite instance with the full Sovereign schema.
 * Each call returns an independent database — no shared state between tests.
 */
export async function makeTestDb(): Promise<TestDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  await db.exec(SCHEMA_V2_SQL);
  await db.exec(SCHEMA_V3_SQL);
  await db.exec(SCHEMA_V4_SQL);
  return db as unknown as TestDb;
}
