// engine/remedy-linker.ts
// Links persisted defects to applicable remedies from NorwegianRemedyCatalog.
//
// For each defect that matches a catalog entry (by category + tier):
//   1. Upsert the remedy row.
//   2. Upsert the defect_remedies join row.
//   3. Upsert a REMEDY graph node.
//   4. Upsert a REFERENCES edge from the DEFECT graph node to the REMEDY node.

import type { PgLiteLike } from "../db/pglite-client";
import type { DefectDraft } from "../rules/sovereign-rulepack-api";
import { NorwegianRemedyCatalog } from "../rules/remedy-catalog";
import type { RemedyEntry } from "../rules/remedy-catalog";
import { stableId } from "../rules/graph-utils";
import { jsonStableStringify } from "../utils/hash-utils";

export async function linkRemedies(
  db: PgLiteLike,
  caseId: string,
  defects: DefectDraft[],
  catalog?: RemedyEntry[]
): Promise<void> {
  const activeCatalog = catalog ?? NorwegianRemedyCatalog;
  for (const defect of defects) {
    const matching = activeCatalog.filter(
      entry =>
        entry.applicableCategories.includes(defect.category) &&
        entry.applicableTiers.includes(defect.tier)
    );

    const defectNodeId = stableId("node", [caseId, "DEFECT", defect.defectId]);

    for (let i = 0; i < matching.length; i++) {
      const entry = matching[i]!;
      const priority = i + 1;

      // 1. Upsert remedy (global — not per-case)
      await db.query(
        `
        INSERT INTO remedies (remedy_id, jurisdiction, name, description, typical_deadline)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (remedy_id) DO NOTHING
        `,
        [entry.remedyId, entry.jurisdiction, entry.name, entry.description, entry.typicalDeadline]
      );

      // 2. Upsert defect_remedies join
      const rationale =
        `${entry.name} er aktuelt for kategori ${defect.category} (${defect.tier}).`;
      await db.query(
        `
        INSERT INTO defect_remedies (defect_id, remedy_id, priority, rationale)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (defect_id, remedy_id) DO UPDATE
          SET priority=excluded.priority,
              rationale=excluded.rationale
        `,
        [defect.defectId, entry.remedyId, priority, rationale]
      );

      // 3. Upsert REMEDY graph node (scoped to case so graph traversal works)
      const remedyNodeId = stableId("node", [caseId, "REMEDY", entry.remedyId]);
      await db.query(
        `
        INSERT INTO graph_nodes (node_id, case_id, type, ref_id, label, attributes)
        VALUES ($1, $2, 'REMEDY', $3, $4, $5::jsonb)
        ON CONFLICT (node_id) DO NOTHING
        `,
        [
          remedyNodeId,
          caseId,
          entry.remedyId,
          entry.name,
          jsonStableStringify({
            jurisdiction: entry.jurisdiction,
            typicalDeadline: entry.typicalDeadline,
            applicableCategories: entry.applicableCategories,
            applicableTiers: entry.applicableTiers
          })
        ]
      );

      // 4. Upsert REFERENCES edge from DEFECT node → REMEDY node
      const edgeId = stableId("edge", [caseId, "REFERENCES", defectNodeId, remedyNodeId]);
      await db.query(
        `
        INSERT INTO graph_edges (edge_id, case_id, type, from_node_id, to_node_id, weight, attributes)
        VALUES ($1, $2, 'REFERENCES', $3, $4, $5, $6::jsonb)
        ON CONFLICT (edge_id) DO NOTHING
        `,
        [
          edgeId,
          caseId,
          defectNodeId,
          remedyNodeId,
          priority,
          jsonStableStringify({ priority, rationale })
        ]
      );
    }
  }
}
