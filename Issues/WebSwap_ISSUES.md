# WebSwap Issues Ledger
**Created:** 2026-04-25T20:30:32-0400
**Governance:** .supercache/ v1.4.1

> This is the living help-desk and issue tracker for **WebSwap**. Every issue row below must stay evidence-backed and append-only.

---

## How to use this document

- This is the living help-desk for repo operations, CI/CD, bugs, blockers, and governance work for WebSwap.
- Every new issue is added as a row in the **Issues Ledger** below with a fresh `ISSUE-NNNN` ID.
- Every significant update to an issue appends a timestamped entry to the **Change Log** at the bottom of this file.
- **Never overwrite historical facts.** Updates append; they do not replace.

---

## Status definitions

| Status | Meaning |
|---|---|
| **New** | Captured; not yet triaged |
| **Triaged** | Scoped; priority set; owner assigned |
| **In progress** | Active work underway |
| **Blocked** | Cannot proceed; blocker and next unblock action recorded |
| **Resolved** | Fix implemented; proof attached |
| **Verified** | Fix confirmed by rerun, test, or log evidence |
| **Closed** | Complete and stable; no further action expected |

---

## Issues Ledger

| ID | Created | Title | Status | Owner | Evidence / Links | Resolution Proof |
|---|---|---|---|---|---|---|
| ISSUE-0001 | 2026-04-25 20:32 EDT | Bootstrap governance and align public surfaces with claimed port 10337 | Closed | Claude | `bootstrap.sh --init`; `bash /Volumes/SanDisk1Tb/SSOT/port-claim.sh claim 10337 WebSwap SanDisk1Tb`; `FLOYD.md`; `SSOT/WebSwap_SSOT.md`; `README.md`; `metadata.json`; `.gitignore`; `port-registry.json` | `npm run lint`; `npm test` (75 smoke + 19 HTTP passing); `npm run build`; `bootstrap.sh --verify` passed 9/9 |
| ISSUE-0002 | 2026-04-25 20:47 EDT | Migrate redesign provider from Anthropic SDK to Portkey AI Gateway | Resolved | Claude | `server.ts`; `package.json`; `.env.example`; `FLOYD.md`; `SSOT/WebSwap_SSOT.md` | `npm run lint`; `npm test`; `npm run build` |
| ISSUE-0003 | 2026-04-26 19:43 EDT | Replace fragile model-final JSON redesign with deterministic workspace build/export flow | Verified | Floyd | `server.ts`; `src/blueprint.ts`; `src/siteSummary.ts`; `src/workspaces.ts`; `src/localBuilder.ts`; `src/App.tsx`; `tests/workspace-builder.ts`; `tests/http.ts`; `README.md`; `.env.example` | `npm run lint`; `npm test` (75 smoke + 5 builder + 19 HTTP passing); `npm run build`; `bootstrap.sh --verify` passed 9/9 |
| ISSUE-0004 | 2026-04-26 20:41 EDT | Add page classification logic so secondary page names match the business type | Verified | Floyd | `src/pageClassifier.ts`; `src/blueprint.ts`; `src/localBuilder.ts`; `src/templateEngine.ts` | `npm run lint`; `npm test` (75 smoke + 5 builder + 19 HTTP passing); `npm run build`; `bootstrap.sh --verify` passed 9/9; manual tests: plumbing→services, restaurant→menu, nightclub→events, retail→products, creative→gallery |

---

## Required fields per issue

Every row above MUST have:

1. **ID** — `ISSUE-NNNN`, monotonically increasing, never reused
2. **Created** — `YYYY-MM-DD HH:MM TZ` when the issue was first captured
3. **Title** — one-line summary
4. **Status** — from the status table above
5. **Owner** — assigned person, or "Unassigned"
6. **Evidence / Links** — logs, screenshots, commands, failing step, related file paths, companion issue file if present
7. **Resolution Proof** — how the fix was verified; `N/A` until Resolved or later

If any field is missing, the row is non-compliant and must be corrected.

---

## Per-issue detail files (optional)

If an issue needs more than a single ledger row, create a companion file in `Issues/` and link it from the ledger row's Evidence / Links column.

---

## Change Log (append-only)

- 2026-04-25T20:30:32-0400 — Initialized issues ledger.
- 2026-04-25 20:32 EDT — Added ISSUE-0001 for governance bootstrap, port claim, and public-surface cleanup work in progress.
- 2026-04-25 20:33 EDT — ISSUE-0001 closed after lint, test, build, and governance verification all passed.
- 2026-04-26 19:43 EDT — Added and verified ISSUE-0003 for deterministic server-side workspace build/export cutover.

---

## Mandatory execution contract
For EACH requested item:
1) Show exact action taken
2) Show direct evidence (file/line/command/output)
3) Show verification result
4) Mark status only after proof

## Forbidden behaviors
- Declaring "done" without evidence
- Collapsing multiple requested items into one vague summary
- Skipping failed steps without explicit blocker report

## Required output structure
A) Requested items checklist
B) Per-item evidence ledger
C) Verification receipts
D) Completeness matrix (item -> done/blocked -> evidence)

## Hard gate
If any requested item has no evidence row, final status MUST be INCOMPLETE.