// utils/hash-utils.ts
// Single source of truth for FNV-1a hashing and stable JSON serialisation.
// Used by graph-utils (stableId), attribute-normalizer, and rule-engine-runner
// to guarantee identical deterministic IDs across the codebase.

export function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fnv1a32Hex(s: string): string {
  return fnv1a32(s).toString(16);
}

export function jsonStableStringify(obj: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (x: unknown): unknown => {
    if (x === null || x === undefined) return x;
    if (typeof x !== "object") return x;
    if (seen.has(x as object)) return "[Circular]";
    seen.add(x as object);
    if (Array.isArray(x)) return (x as unknown[]).map(normalize);
    const keys = Object.keys(x as object).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = normalize((x as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(normalize(obj));
}
