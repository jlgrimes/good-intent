# Good Intent — Package & Module Boundaries

## Purpose

This is the current ownership map for the code that already exists.

It is not an aspirational architecture fantasy.
It documents the real boundaries in the repo today so future cron runs can refactor intentionally instead of smearing logic across packages.

---

## Repo shape right now

```text
/apps
  /api
  /web
/packages
  /shared
  /router-engine
/data
/drizzle
```

This is already enough for the wedge:
- web submits intent with no assignee picker
- api persists + routes + exposes trace/export
- router-engine makes the deterministic routing decision
- shared holds the contract between api and web

---

## Boundary rules

### 1. `packages/shared` owns cross-app contracts

This package is the source of truth for shared product/domain types that both the API and web need.

Own here:
- domain types (`Intent`, `RoutingDecision`, `DelegationRun`, `DelegationEvent`, `DelegationOrder`, `ExecutionUpdate`)
- API/view-layer shapes consumed by the web (`IntentView`, `RoutingModeDisplay`, `InboxBadge`, `InboxRoutingSummary`, `RoutingCandidateView`, action input types)
- small stable enums / unions that define the app contract

Do **not** put here:
- DB code
- Express handlers
- router scoring logic
- React components
- persistence-specific helpers

Current files:
- `packages/shared/src/index.ts`

---

### 2. `packages/router-engine` owns routing logic only

This package should answer one question:

**Given an intent and an org, who should own the first pass, in what routing mode, and why?**

Own here:
- intent classification
- deterministic keyword/capability scoring
- routing mode selection (`direct`, `manager_first`, `org_top`, `clarify`)
- candidate ranking
- compact reasoning/explanation generation
- router unit tests

Do **not** put here:
- persistence
- HTTP concerns
- UI formatting that is purely presentational
- app bootstrap/runtime code
- IDP export assembly

Current files:
- `packages/router-engine/src/index.ts`
- `packages/router-engine/src/index.test.ts`

---

### 3. `apps/api` owns persistence, orchestration, and external app surface

This package is the backend runtime.
It turns the router + DB into a usable product/API.

Own here:
- Express app + routes
- SQLite/Drizzle persistence
- store/repository orchestration
- DB bootstrap/seed/reset scripts
- delegation mutations
- IDP export assembly
- machine-readable schema/examples/contract endpoints
- API integration + smoke tests

Sub-boundaries inside `apps/api/src`:

#### Runtime / entry
- `main.ts` — process boot only
- `server.ts` — import-safe app factory only

#### Persistence / state
- `schema.ts` — Drizzle schema declarations
- `db.ts` — DB creation, lazy default DB, file-path handling
- `store.ts` — application state orchestration and persistence-backed view building
- `scripts.ts` — reset/seed/fresh-reset CLI flows

#### Protocol / machine-readable surfaces
- `idp.ts` — build IDP exports from stored state
- `idp-schema.ts` — manifest for IDP object shapes
- `idp-examples.ts` — stable example exports
- `api-contract.ts` — non-IDP app-surface contract docs

#### Tests
- `server.test.ts` — API/store integration coverage
- `http-smoke.test.ts` — real HTTP create -> route -> detail -> export proof

Do **not** put here:
- React rendering concerns
- router heuristics that belong in `router-engine`
- cross-app type definitions that should live in `shared`

---

### 4. `apps/web` owns the product surface

This package should stay focused on the wedge UX:
- submit intent
- show selected owner + explanation
- show trace
- allow compact follow-up actions
- inspect alternatives / export

Own here:
- React components/app shell
- local UI state
- rendering of inbox/detail/action/export surfaces
- visual treatment of routing modes, badges, summaries, traces

Do **not** put here:
- routing heuristics
- persistence rules
- duplicated domain type definitions
- fake mock state that diverges from the API contract

Current key files:
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `apps/web/src/main.tsx`

---

## Data and migration ownership

### `/data`
Runtime local state only.

Current contents:
- `seed-org.json` — seed org fixture
- `good-intent.db*` — local sqlite runtime files
- legacy `state.json` import source

Rule:
- treat `seed-org.json` as seed data owned by API persistence/bootstrap
- do not put product docs here

### `/drizzle`
Migration artifacts only.

Rule:
- generated SQL + metadata live here
- schema source still lives in `apps/api/src/schema.ts`

---

## What is currently a little too coupled

These are the real cleanup targets, not theory:

### A. `store.ts` is doing a lot
It currently owns:
- persistence reads/writes
- view-model assembly
- inbox summary formatting
- action-candidate derivation
- run mutation orchestration

That is acceptable for the current wedge, but it is the biggest concentration point.

Likely next split:
- `repositories/*` for table access
- `view-builders/*` for `IntentView`/inbox formatting
- `services/*` for route/delegation mutations

### B. protocol helpers still live inside API
That is okay today because IDP export is still backend-owned.
If another runtime starts consuming/emitting the same protocol locally, `idp.ts` may want to move into a dedicated `packages/protocol` package.

### C. app-surface contract vs protocol contract are both backend-owned
That is also okay for now.
But once the API contract becomes more important, a thin `packages/contracts` package may be worth adding.
Only do that after it reduces duplication for real.

---

## Recommended ownership map for next refactor

If the current monolith-in-store starts slowing work down, split in this order:

1. `apps/api/src/services/routing-service.ts`
2. `apps/api/src/services/delegation-service.ts`
3. `apps/api/src/view-models/intent-view.ts`
4. `apps/api/src/repositories/*`
5. optional `packages/protocol` for IDP builders/schema if reused outside API

Do **not** start by adding a bunch of empty folders.
Only split when a real file is crowded enough to justify it.

---

## What should stay true after any refactor

No matter how the repo gets cleaned up, preserve these constraints:

1. Primary flow has **no assignee picker**
2. `router-engine` remains deterministic-first
3. `server.ts` stays import-safe
4. `main.ts` owns runtime boot
5. shared contracts stay in `packages/shared`
6. the HTTP smoke test keeps proving create -> route -> detail -> export end-to-end

If a refactor breaks those, it is regression disguised as cleanup.

---

## Concrete next cleanup moves

1. Split `apps/api/src/store.ts` into smaller API-owned modules without changing behavior
2. Decide whether IDP/export code has enough reuse to justify `packages/protocol`
3. Keep `packages/shared` lean; do not dump backend helpers into it
4. Keep web focused on wedge UX, not generic PM surfaces

---

## TL;DR

Current ownership is:
- `packages/shared` → shared contracts
- `packages/router-engine` → routing logic
- `apps/api` → persistence + orchestration + exports + HTTP surface
- `apps/web` → wedge UI

That is good enough for now.
The next real cleanup target is `apps/api/src/store.ts`, not a giant architecture rewrite.
