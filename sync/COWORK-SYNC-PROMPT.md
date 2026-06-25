# CoWork → Compass website sync — standing prompt

> Paste this into CoWork to push selected information from CoWork onto the Compass website.
> CoWork stays the authoritative source; this only **adds a structured copy** to the site. Nothing in
> CoWork is moved, deleted, or rewritten. Works in two modes (initial backfill / ongoing update).

You are operating the **Compass sync**. Your job this run is to turn what CoWork knows about me into one
machine-readable **sync package** and apply it to the website through the validated CLI. You do **not**
hand-edit the database.

## 0. Read first (every run)
1. `CLAUDE.md` — follow it. 2. `THE-NARRATIVE-METHOD.md` — the Four Proof-Types are your relevance lens.
3. `MEMORY.md` — current facts. 4. `compass-app/src/lib/types.ts` — emit ONLY these column names.
5. If present, `graphify-out/GRAPH_REPORT.md` + `graphify-out/graph.json` — relationship **hints only**.
6. `compass-data/COMPASS-SECRETS.local.md` — read ONLY to learn what to exclude; never copy a value out of it.

## 1. Pick a mode
- **initial** — first full backfill: emit every relevant record as `op:"upsert"`.
- **update** — incremental: emit ONLY what changed since last time; reuse each record's existing
  `source_ref` so it updates in place instead of duplicating.

## 2. Hard rules
- Never delete, move, or rewrite any CoWork file. You only READ CoWork and WRITE the website.
- Never put a secret, credential, token, password, or anything from `compass-data/COMPASS-SECRETS.local.md` into the
  package. The schema has no field for secrets and the CLI rejects secret-shaped keys.
- Never invent facts. Unknown value → omit the field, or use `"<<PLACEHOLDER: …>>"` + `confidence:"needs_review"`.
- Structured college-app data flows freely. Raw personal reflections and any unverified claim →
  `confidence:"needs_review"` (held for my approval), never `confirmed`.
- Never set `id` or `user_id` — the database owns the id and the CLI injects the user from the session.

## 3. Build the package (EXACT shape — the CLI validates this)
```json
{
  "schema_version": 1,
  "mode": "initial",                          // or "update"
  "generated_at": "2026-06-18T00:00:00.000Z", // ISO-8601 UTC
  "source": "cowork",
  "items": [
    {
      "entity": "activities",                 // colleges|essays|tasks|activities|ideas|profiles|scholarship_deadlines
      "op": "upsert",                         // or "archive" (hides on the site; never deletes)
      "source_ref": "activity:avenues-asset-management",  // STABLE slug; reuse forever to avoid duplicates
      "confidence": "confirmed",              // or "needs_review"
      "data": { "name": "Avenues Asset Management", "role": "Founder", "status": "Active" },
      "proof_types": ["Ownership", "Impact"], // subset of Consistency|Progression|Ownership|Impact
      "theme": "Finance & Entrepreneurship Spike",
      "relationships": [                      // optional, graphify-informed
        { "type": "essay_primary_college", "target_source_ref": "college:mit" }
      ],
      "provenance": { "cowork_source": "planning/02-activity-spike-strategy.md", "note": "" },
      "change_note": "what this item changes"
    }
  ],
  "review_flags": [ { "source_ref": "…", "field": "…", "reason": "unverified_claim" } ]
}
```
Rules for the shape:
- `entity` is one of the 7 names above (note **profiles**, plural). For `profiles` always use
  `source_ref: "profile:singleton"`.
- `data` keys are snake_case columns from `types.ts` for that entity. Drop `college_ids` — essay↔college
  links go through `relationships` (`essay_college` / `essay_primary_college`), not a data field.
- `relationships.type` ∈ `essay_primary_college | essay_college | task_parent_college | task_parent_essay | scholarship_of_college`. Anything that doesn't map to one of these is a `theme` tag, not a relationship.
- Every `needs_review` item should also appear in `review_flags`.

## 4. Relevance (what to include)
Include a record when it maps to one of the 7 entities AND produces at least one Proof-Type
(Consistency / Progression / Ownership / Impact). Exclude pure reflection with no proof-type, process
meta-commentary, test-fixture/sandbox content, and anything in the secrets tier. Borderline → include as
`needs_review`. Tag each item's `proof_types` (and `theme` from a graphify hyperedge when one applies).

## 5. Privacy gate
- **Never sync:** any secret/credential/token/password; anything in `compass-data/COMPASS-SECRETS.local.md`.
- **needs_review (confirm before it counts):** `document_id`, `date_of_birth`, home address/phone, parent
  email/occupation, the factual nugget pulled from a raw reflection, and any unverified claim.

## 6. Apply it (you run this; do not hand-write SQL)
1. Write the package JSON to a temp file, e.g. `/tmp/compass-pkg.json`.
2. Preview (no writes): `cd compass-app && npm run sync -- plan /tmp/compass-pkg.json`
3. Show me the plan summary. For an `initial` run or anything touching ≥3 records, **wait for my OK.**
4. Apply: `npm run sync -- apply /tmp/compass-pkg.json` — this writes the rows, records a reversible run,
   and saves the package under `compass-app/sync/packages/<timestamp>.json` as the audit record.
5. Report: rows added / updated / archived / flagged, the run id, and anything in needs_review.
   To undo: `npm run sync -- rollback <run_id>`.

## 7. Done criteria
The package validated, applied (or was correctly held for my approval), every needs_review item is listed,
no secret left CoWork, no CoWork file changed, and I have the run id to roll back if needed.
