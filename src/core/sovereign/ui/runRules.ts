// ui/runRules.ts
// Promise-based wrapper around the rule-worker Web Worker message protocol.

import type { RunSummary } from "../engine/rule-engine-runner";
import type { NormalizerSummary } from "../engine/attribute-normalizer";
import type { WorkerOutMsg } from "../workers/worker-protocol";

export interface RunRulesOptions {
  /** Threshold overrides forwarded to the rule engine. */
  thresholds?: {
    independenceMin?: number;
    ewiMin?: number;
    contradictionMax?: number;
  };
  /** Called when normalisation completes (before rule evaluation starts). */
  onNormalize?: (summary: NormalizerSummary) => void;
  /** Milliseconds before the promise is rejected with a timeout error. Default: 60000. */
  timeoutMs?: number;
}

/**
 * Sends a RUN_RULEPACK message to the worker and returns a Promise that
 * resolves with the RunSummary on success, or rejects on error / timeout.
 *
 * The worker must have already been initialised with INIT_DB.
 */
export function runRulesViaWorker(
  worker: Worker,
  caseId: string,
  opts: RunRulesOptions = {}
): Promise<RunSummary> {
  const { onNormalize, timeoutMs = 60_000 } = opts;

  return new Promise<RunSummary>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      worker.removeEventListener("message", onMsg);
    };

    const onMsg = (ev: MessageEvent<WorkerOutMsg>) => {
      const msg = ev.data;

      if (msg.type === "NORMALIZE_OK") {
        onNormalize?.(msg.payload);
        return; // not terminal — keep listening
      }

      if (msg.type === "RUN_OK") {
        cleanup();
        resolve(msg.payload);
        return;
      }

      if (msg.type === "ERROR") {
        cleanup();
        reject(new Error(msg.payload.message ?? "Worker error"));
        return;
      }
    };

    worker.addEventListener("message", onMsg);

    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`runRulesViaWorker timed out after ${timeoutMs}ms for case ${caseId}`));
    }, timeoutMs);

    worker.postMessage({
      type: "RUN_RULEPACK",
      payload: { caseId, thresholds: opts.thresholds }
    });
  });
}
