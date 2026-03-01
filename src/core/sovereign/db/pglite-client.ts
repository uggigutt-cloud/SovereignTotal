// db/pglite-client.ts
// Thin wrapper around PGLite (WASM) to keep queries typed & deterministic.

export type SqlValue = string | number | boolean | null | Uint8Array | object;

export interface SqlRow {
  [key: string]: unknown;
}

export interface PgLiteLike {
  query: (sql: string, params?: SqlValue[]) => Promise<{ rows: SqlRow[] }>;
}

export function asText(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().split("T")[0]!;
  return String(v);
}

export function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "t", "1", "yes", "y"].includes(s)) return true;
    if (["false", "f", "0", "no", "n"].includes(s)) return false;
  }
  return null;
}

export function asJsonObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return {};
}
