# Good Intent — Overnight Tasks

## Purpose

This document is the execution brief for overnight engineering crons.

It is not a brainstorming doc.
It is not a product essay.
It is a narrow implementation attack plan.

Primary mission:

**Build the first real vertical slice of intent → automatic routing → visible delegation.**

---

## Source docs

Before making changes, read:
1. `PRODUCT_SPEC.md`
2. `IMPLEMENTATION_PLAN.md`
3. `ROUTING_RULES.md`

If these conflict:
- prefer the most concrete implementation detail
- preserve the wedge: zero-assignment automatic delegation

---

## Non-negotiable product rule

The primary user flow must **not** require manually choosing an assignee.

If a proposed change makes the user select the worker in the main path, it is wrong.

Manual assignment may exist later as an advanced override.
It is not the wedge.

---

## What counts as success tonight

By the end of the overnight session, we want the repo materially closer to this:

1. a bootstrap app exists
2. the core data model exists
3. a seed org exists
4. an intent can be created
5. an intent can be automatically routed
6. the chosen owner + explanation can be surfaced

If possible, also:
7. a delegation run / trace skeleton exists

---

## Priority order

### Priority 1 — repo bootstrap
If the repo is still mostly empty, do this first.

Deliverables:
- app structure created
- TypeScript setup working
- package manager/workspace configured
- web and api bootstrapped
- minimal README instructions

Recommended shape:

```text
/apps
  /web
  /api
/packages
  /shared
  /router-engine
```

Acceptance criteria:
- install works
- dev/build/typecheck commands exist
- repo structure is coherent and documented

---

### Priority 2 — schema and domain model
Define the core objects.

Required tables/models:
- `agents`
- `intents`
- `routing_decisions`
- `delegation_runs`
- `delegation_events`

Acceptance criteria:
- schema compiles
- migrations exist
- fields are sufficient for routing + trace
- no PM-tool-only tables added unless essential

---

### Priority 3 — seed org
Create a development org so routing is testable.

Suggested seed:
- CEO
  - CTO
    - Infra Engineer
    - Product Engineer
  - Designer
  - Growth Lead

Each agent should have:
- role
- title
- capabilities
- reportsTo
- active status

Acceptance criteria:
- local seed command or bootstrap script exists
- sample org can be viewed/queried

---

### Priority 4 — router engine v1
Implement the first deterministic router.

Required modules:
- candidate generation
- keyword/capability matching
- score aggregation
- routing mode selection
- explanation builder

Must follow `ROUTING_RULES.md`.

Acceptance criteria:
- router can return:
  - selected agent
  - routing mode
  - confidence
  - explanation
- unit tests exist for canonical examples

---

### Priority 5 — intent submission API
Implement intent creation and routing.

Required endpoints:
- `POST /intents`
- `POST /intents/:id/route`
- `GET /intents/:id`
- `GET /org`

Acceptance criteria:
- an intent can be created without assignee
- route endpoint automatically chooses an owner
- result is persisted

---

### Priority 6 — minimal frontend
Build only what proves the wedge.

Required UI:
- intent composer
- routing result view
- basic trace/event panel if feasible

Acceptance criteria:
- user can submit a request from UI
- no assignee dropdown in primary path
- routed owner + explanation are shown

---

## Stretch goal

### Delegation trace skeleton
If core routing works, add:
- `delegation_runs`
- `delegation_events`
- initial route event creation
- simple timeline rendering

Acceptance criteria:
- trace is append-only and visible
- initial route becomes first event

---

## What to avoid tonight

Do **not** spend time on:
- kanban boards
- issue tracker abstractions
- rich permissions systems
- fancy auth
- generic settings UI
- deep agent execution plumbing unless the route-to-owner slice already works
- polishing visual design before core flow exists

Avoid PM-tool gravity.

---

## Engineering principles for the cron

### 1. Build vertical slices
Prefer:
- thin working feature end-to-end

over:
- broad architecture with no proof

### 2. Prefer deterministic routing first
Do not make the router fully LLM-native yet.

### 3. Preserve evidence
Leave behind:
- tests
- docs
- commands
- clear file structure

### 4. Keep the wedge visible
At every step ask:

**Does this reduce assignment labor for the human?**

If not, it’s probably drift.

---

## Concrete task breakdown

### Task A — Bootstrap monorepo/app shell
- initialize repo layout
- choose stack
- add package scripts
- verify typecheck/build

### Task B — Define schema
- create DB models
- add migration files
- add shared types

### Task C — Seed org
- add sample agents
- wire reportsTo relationships
- add capabilities

### Task D — Implement router engine
- create `routeIntent()`
- implement deterministic scoring
- implement explanation builder

### Task E — Add API endpoints
- create intent
- route intent
- fetch intent / result
- fetch org

### Task F — Build minimal UI
- input box
- submit action
- result panel

### Task G — Add tests
- unit tests for router
- integration test for route endpoint

---

## Canonical test prompts

Use these as fixture cases.

1. `Fix the broken deploy on production`
2. `Rewrite the homepage hero copy so the value prop is clearer`
3. `Figure out why onboarding conversion dropped this week`
4. `Fix the OAuth callback bug in the app`
5. `Handle that weird thing from earlier`

Expected outcomes should match `ROUTING_RULES.md`.

---

## Commit strategy

Prefer a few coherent commits over noisy churn.

Good commit slices:
- `bootstrap app structure`
- `add core schema and seed org`
- `implement router engine v1`
- `add intent routing API`
- `add minimal intent inbox UI`

---

## Reporting format for overnight summaries

When the cron finishes, report only:
1. what concrete artifacts were created
2. which files/modules changed
3. what now works end-to-end
4. what is still missing from the wedge
5. exact next step

No vague “made progress” summaries.

---

## Stop condition

Stop once one of these is true:

### Good stop
A user can:
- open app
- submit intent
- see automatic route + explanation

### Acceptable stop
Core backend is complete enough that the next run can focus only on UI wiring.

### Bad stop
Lots of scaffolding exists but no routing flow can be demonstrated.

---

## The one question to keep asking

**Can the user say what they want done without choosing the worker?**

If yes, we are building Good Intent.
If no, we are drifting back into project management software.
