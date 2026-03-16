# Good Intent

Good Intent is an intent router for AI teams: intent in, automatic org-aware delegation out.

## What exists right now
- Seed org with CEO / CTO / Infra Engineer / Product Engineer / Designer / Growth Lead
- Deterministic router engine with routing mode, confidence, and explanation
- SQLite + Drizzle-backed persistence for intents, routing decisions, delegation runs, delegation orders, delegation events, and execution updates
- Minimal API for creating + routing intents
- Minimal web UI with no assignee picker in the primary flow
- Inspectable routing alternatives panel showing top candidates, scores, and reasons beside the selected owner
- First-class execution updates so the current owner's queued/running/blocked/done checkpoints show up separately from the delegation event trace
- IDP export endpoint + in-product export panel for portable `intent` / `routing_decision` / `run` / `delegation_orders` / `delegation_events` / `execution_updates` payloads

## Run

```bash
npm install
npm run db:fresh-reset
npm run dev:api
npm run dev:web
```

API: `http://localhost:4010`
Web: default Vite port (`http://localhost:5173`)

## Database

```bash
npm run db:generate      # generate Drizzle SQL from schema changes
npm run db:migrate       # apply generated migrations
npm run db:seed          # ensure schema + seed org exist for current DB
npm run db:reset-seed    # drop app tables, recreate schema, reseed org
npm run db:fresh-reset   # delete sqlite files, recreate clean DB, reseed org
```

Default DB path: `data/good-intent.db`
Override with `GOOD_INTENT_DB_PATH=/absolute/path/to.db`

## IDP export

Route an intent, then fetch its protocol payload here:

```bash
curl http://localhost:4010/intents/<intent-id>/idp-export
```

Fetch the machine-readable schema manifest here:

```bash
curl http://localhost:4010/idp/schema
```

Fetch concrete example payloads here:

```bash
curl http://localhost:4010/idp/examples
```

Fetch the machine-readable app API contract here:

```bash
curl http://localhost:4010/api/contract
```

Top-level objects:
- `intent`: raw user ask + source/context
- `routing_decision`: chosen owner, mode, confidence, candidate evidence
- `run`: current owner + lifecycle state (null for clarify-mode asks)
- `delegation_orders`: explicit handoff objects
- `delegation_events`: append-only ownership trace
- `execution_updates`: progress / blocker / needs-input checkpoints

Consumer notes:
- `routing_decision` may exist even when `run` is `null`; that means the router chose `clarify` and refused to fake ownership.
- Use `delegation_events` for ownership replay and `execution_updates` for runtime progress.
- `GET /idp/schema` returns a machine-readable manifest of the top-level object keys, nullability, and field meanings for external runtimes.
- `GET /idp/examples` returns stable sample payloads for `direct`, `manager_first`, and `clarify` flows so downstream consumers have concrete fixtures alongside the field manifest.
- `GET /api/contract` returns the machine-readable app-surface contract for create/route/detail/action discovery (`/intents`, `/intents/:id/route`, `/delegation-runs/:id/actions`, etc.) with compact request/response examples.
- The web detail view now supports one-click copy/download of the current export so another runtime can ingest it directly.

## Validate

```bash
npm run test --workspace api                # includes real HTTP zero-assignment smoke flow
npm run test --workspace @good-intent/router-engine
npm run typecheck
npm run build
```
