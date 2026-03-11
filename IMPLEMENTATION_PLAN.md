# Good Intent — Implementation Plan v0

## Goal

Turn the product wedge into an engineering plan that is concrete enough for overnight cron work.

Wedge recap:

**A user states intent once. The system chooses ownership, delegates through the org, and tracks execution.**

This document is intentionally biased toward:
- thin vertical slices
- deterministic architecture
- clear file/module boundaries
- cron-friendly tasks
- minimal PM-tool sprawl

---

## What we are actually building first

Not a full company OS.
Not a broad PM platform.
Not a generic multi-agent framework.

We are building the first working version of:

**Intent Router + Delegation Trace**

That means v0 only needs to prove these things:

1. user can submit work **without choosing an assignee**
2. system can pick an owner from org structure
3. system can explain why it picked them
4. system can dispatch the work
5. user can inspect the delegation path
6. agent / manager can re-delegate or escalate

If those are real, the wedge exists.

---

## Product architecture at a glance

### Main flows

#### Flow A — submit intent
1. user writes request
2. backend creates `intent`
3. router evaluates candidates
4. router records `routing_decision`
5. system dispatches `delegation_run`
6. chosen agent is woken

#### Flow B — re-delegation
1. chosen owner accepts or re-routes
2. system records downstream delegation event
3. new agent is woken
4. trace updates

#### Flow C — escalation / clarification
1. no good owner / low confidence / blocked run
2. system escalates upward or asks question
3. trace records escalation reason

---

## Core domain model

We should keep the data model brutally small.

### 1. Agent
Represents a member of the org.

Required fields:
- `id`
- `name`
- `role`
- `title`
- `reportsTo`
- `capabilities[]`
- `status`
- `routingMetadata` (optional later)

### 2. Intent
Represents the user’s request.

Required fields:
- `id`
- `companyId`
- `createdByUserId`
- `text`
- `projectId?`
- `urgency?`
- `constraints?`
- `status` (`pending`, `routed`, `running`, `blocked`, `done`)
- `createdAt`

### 3. RoutingDecision
Represents the system’s choice.

Required fields:
- `id`
- `intentId`
- `selectedAgentId`
- `routingMode` (`direct`, `manager_first`, `org_top`, `clarify`)
- `confidence`
- `reasoningSummary`
- `candidateSnapshotJson`
- `createdAt`

### 4. DelegationRun
Represents execution ownership over time.

Required fields:
- `id`
- `intentId`
- `currentAgentId`
- `status` (`queued`, `running`, `blocked`, `done`, `cancelled`)
- `rootRoutingDecisionId`
- `createdAt`
- `updatedAt`

### 5. DelegationEvent
Append-only trace of routing changes.

Required fields:
- `id`
- `delegationRunId`
- `type` (`routed`, `delegated`, `escalated`, `clarified`, `completed`, `blocked`)
- `fromAgentId?`
- `toAgentId?`
- `summary`
- `metadataJson`
- `createdAt`

---

## Recommended repo shape

Since the repo is empty, start simple.

## Suggested top-level structure

```text
/apps
  /web
  /api
/packages
  /shared
  /router-engine
/docs
  PRODUCT_SPEC.md
  IMPLEMENTATION_PLAN.md
  ROUTING_RULES.md
```

If you want less monorepo ceremony, this can also be:

```text
/web
/api
/shared
/docs
```

But long-term I’d prefer:
- `apps/web`
- `apps/api`
- `packages/shared`
- `packages/router-engine`

because the router will become its own unit fast.

---

## Tech recommendation for v0

Keep this boring.

### Frontend
- Next.js or Vite + React + TypeScript
- Tailwind if desired
- no design-system rabbit hole

### Backend
- Node + TypeScript
- Express / Fastify / Hono, any is fine
- pick the one you’ll move fastest in

### Database
- Postgres
- Drizzle or Prisma
- strongly prefer Drizzle if you want explicitness and fast iteration

### Background execution
- initial version can do direct async dispatch
- later move to queue/job worker

### LLM usage
- do **not** make routing fully prompt-driven
- use LLM only as a ranking/explanation helper
- deterministic candidate generation first

---

## Routing engine design

This is the core of the whole product.

## Rule: start hybrid, not magical

The first router should have 3 stages:

### Stage 1 — candidate generation
Given an intent, generate a candidate list from:
- all active agents in company
- maybe filtered by project/team in future

### Stage 2 — deterministic scoring
Score candidates using:
- role match
- capability keyword match
- manager/root logic
- org distance
- availability/status

Example factors:
- mention of “deploy”, “infra”, “build”, “server” → CTO / DevOps / engineer upweight
- mention of “copy”, “design”, “hero”, “brand” → designer / marketing upweight
- mention of “strategy”, “figure out”, “what should we do” → manager / CEO upweight
- ambiguous cross-functional intent → top-level orchestrator upweight

### Stage 3 — LLM adjudication / explanation
Use an LLM to:
- classify request type
- compare top 3 candidates
- produce 1-sentence explanation

But the model should choose among structured candidates, not hallucinate agents from thin air.

---

## Initial routing modes

We need explicit routing behavior.

### `direct`
Use when there is a clear specialist match.

Example:
- “fix OAuth callback bug” → engineer

### `manager_first`
Use when the task is broad but inside a domain.

Example:
- “improve onboarding activation” → growth/product manager first

### `org_top`
Use when the task is ambiguous, cross-functional, or strategic.

Example:
- “figure out why this launch is underperforming” → CEO / orchestrator

### `clarify`
Use when confidence is below threshold.

Example:
- “work on this weird thing” with no context

---

## Confidence policy

Keep this simple and explicit.

### Proposed thresholds
- `>= 0.80` → route directly
- `0.55 - 0.79` → manager-first / org-top
- `< 0.55` → ask clarifying question

Even if these are heuristic at first, making them explicit prevents hand-wavey routing.

---

## Minimal UI for v0

Only build three screens.

### 1. Intent Inbox
Main thing the user sees.

Components:
- single text area / command input
- optional project selector
- optional urgency selector
- submit button

Key principle:
- no assignee picker in the primary flow

### 2. Routing Result View
After submit, show:
- selected owner
- routing mode
- confidence
- explanation
- dispatch status

Optional:
- top 2 alternatives hidden behind expandable detail

### 3. Delegation Trace View
Show the chain:
- user intent
- initial route
- any re-delegations
- escalations
- final result

Think event timeline, not kanban board.

---

## API surface for v0

Keep the API small and obvious.

### Intent APIs
- `POST /intents`
- `GET /intents/:id`
- `GET /intents`

### Routing APIs
- `POST /intents/:id/route`
- `GET /intents/:id/routing-decision`

### Delegation APIs
- `POST /delegation-runs/:id/delegate`
- `POST /delegation-runs/:id/escalate`
- `POST /delegation-runs/:id/complete`
- `POST /delegation-runs/:id/block`
- `GET /delegation-runs/:id/events`

### Agent/org APIs
- `GET /agents`
- `GET /org`

---

## Suggested internal modules

### `/packages/router-engine`
This should contain:
- `intent-classifier.ts`
- `candidate-generator.ts`
- `deterministic-scorer.ts`
- `routing-policy.ts`
- `llm-adjudicator.ts`
- `explanation-builder.ts`
- `route-intent.ts`

### `/apps/api/src/services`
- `intent-service.ts`
- `routing-service.ts`
- `delegation-service.ts`
- `agent-service.ts`

### `/apps/api/src/routes`
- `intents.ts`
- `delegation.ts`
- `agents.ts`
- `org.ts`

### `/apps/web/src`
- `pages/IntentInbox.tsx`
- `pages/IntentDetail.tsx`
- `components/IntentComposer.tsx`
- `components/RoutingSummary.tsx`
- `components/DelegationTrace.tsx`

---

## First engineering milestone

### Milestone 1 — prove routing exists

Goal:
- submit intent
- route automatically
- show chosen owner + explanation
- persist result in DB

#### Deliverables
- org model
- agent seed data / CRUD
- create intent endpoint
- route intent endpoint
- deterministic router
- basic web form
- detail page with routing summary

#### Not required yet
- waking real agents
- live execution
- downstream re-delegation
- queue workers

This is the smallest “it’s real” milestone.

---

## Second engineering milestone

### Milestone 2 — connect routing to execution

Goal:
- after routing, create real delegation run
- wake selected agent
- record dispatch event

#### Deliverables
- `delegation_runs` table
- `delegation_events` table
- dispatch service
- wakeup integration
- trace timeline UI

#### Success condition
User can submit a task and watch it move into execution without assigning anyone manually.

---

## Third engineering milestone

### Milestone 3 — re-delegation and escalation

Goal:
- chosen agent can re-delegate or escalate
- system records the chain of ownership

#### Deliverables
- API for delegate/escalate/complete/block
- trace updates
- blocked-state reasoning
- upward escalation logic

#### Success condition
A routed task can move through the org while preserving a clean execution trace.

---

## Overnight-cron-friendly backlog

These tasks are intentionally sized for autonomous engineering sessions.

### Track 1 — project bootstrap
1. initialize repo structure
2. choose stack and create app shells
3. add shared TS config / lint / format / env scaffolding
4. add README with run instructions

### Track 2 — data model
1. define schema for:
   - agents
   - intents
   - routing_decisions
   - delegation_runs
   - delegation_events
2. generate migrations
3. add local seed data for sample org

### Track 3 — router engine
1. implement candidate generation
2. implement deterministic scoring
3. implement routing mode selection
4. implement explanation builder
5. add unit tests for routing behavior

### Track 4 — API
1. create intent route
2. create route-intent route
3. persist routing decisions
4. expose org endpoint
5. expose delegation trace endpoint

### Track 5 — frontend
1. build intent input page
2. build routing result panel
3. build trace timeline
4. wire to API

### Track 6 — execution bridge
1. define agent dispatch interface
2. create wakeup stub / adapter
3. create delegation run creation service
4. record dispatch events

---

## Exact recommended order of implementation

If I were sequencing this for overnight runs:

### Night 1
- bootstrap repo
- define schema
- implement seed org
- create basic API + web shell

### Night 2
- implement router engine v1
- create route-intent endpoint
- show routing result in UI
- add tests for routing heuristics

### Night 3
- implement delegation run + events
- connect route to dispatch
- build trace UI

### Night 4
- add re-delegation + escalation actions
- add confidence threshold behavior
- polish explanation UX

That’s enough to prove the wedge.

---

## Minimal sample org for development

Use a fake seeded org so routing is testable from day one.

Example:
- CEO
  - CTO
    - Infra Engineer
    - Product Engineer
  - Designer
  - Growth Lead

Example capability sets:
- CEO: strategy, prioritization, cross-functional coordination
- CTO: architecture, infra, technical triage
- Infra Engineer: deployment, CI/CD, hosting, observability
- Product Engineer: app features, bugs, auth, frontend/backend
- Designer: copy, UX, branding, landing pages
- Growth Lead: onboarding, activation, funnels, experiments

This lets us test routing with realistic examples immediately.

---

## Test strategy

Do not skip this.

### Unit tests
For router engine:
- direct specialist routing
- manager-first routing
- org-top routing
- low-confidence clarify behavior

### Integration tests
For API:
- create intent
- route intent
- persist routing decision
- create delegation run
- create delegation events

### Manual QA scenarios
- deployment bug → CTO / infra
- landing page copy → designer
- activation drop → CEO / growth lead
- ambiguous cross-functional ask → CEO

---

## Open implementation decisions

These need explicit resolution early.

### 1. Monorepo vs simple app split
Recommendation:
- start monorepo-ish with `apps/` + `packages/`

### 2. Next.js vs Vite
Recommendation:
- if speed matters most and SSR is irrelevant: Vite
- if you want future app structure + API routes + deployment simplicity: Next.js

### 3. Queue now or later
Recommendation:
- later
- keep dispatch synchronous-ish first

### 4. LLM provider abstraction now or later
Recommendation:
- later
- define a thin interface, but only implement one provider initially

### 5. Real agent integration now or stub first
Recommendation:
- stub first, then bridge to actual wakeup/execution after routing is proven

---

## Suggested docs to add next

To make overnight work sharper, add these after this doc:

### `ROUTING_RULES.md`
Defines:
- initial scoring heuristics
- keyword/capability rules
- manager escalation policy
- confidence thresholds

### `SYSTEM_ARCHITECTURE.md`
Defines:
- app structure
- request flow
- DB ownership
- dispatch lifecycle

### `OVERNIGHT_TASKS.md`
Defines:
- exact next engineering tasks
- acceptance criteria
- what cron should work on in priority order

---

## What the overnight cron should optimize for

Not breadth.
Not polish.
Not abstract frameworks.

The cron should optimize for:

1. **making routing real**
2. **making delegation visible**
3. **avoiding PM-tool creep**
4. **shipping testable vertical slices**

Every overnight session should ask:

**Did we reduce the amount of assignment labor the human has to do?**

If not, it’s drift.

---

## Immediate next action recommendation

After this doc, create:
1. `ROUTING_RULES.md`
2. `OVERNIGHT_TASKS.md`

Then point the overnight cron at those files plus this plan.

That will make the automation substantially sharper than just “go build the thing.”

---

## TL;DR

Build Good Intent in this order:

1. **Intent Inbox**
2. **Router Engine**
3. **Routing Result**
4. **Delegation Run + Trace**
5. **Re-delegation / Escalation**

And keep asking one question:

**Can the user say what they want done without choosing the worker?**

If yes, we are building the wedge.
If no, we are rebuilding PM software.
