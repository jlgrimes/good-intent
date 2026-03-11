# Good Intent — Routing Rules v0

## Purpose

This document defines the first routing contract for Good Intent.

The goal is not to build a perfect router on day one.
The goal is to build a router that is:
- explicit
- testable
- explainable
- better than manual assignment for common cases

This is the routing policy the overnight engineering work should implement first.

---

## Core principle

**The user should not pick the worker in the primary flow.**

Routing exists to remove assignment labor from the user.

If the system pushes the “who should do this?” question back to the human too early, it is failing.

---

## Router shape

Routing v0 should follow a 4-step pipeline:

1. **intent classification**
2. **candidate generation**
3. **deterministic scoring**
4. **policy decision**

Optional 5th step:
5. **LLM explanation / adjudication**

The LLM must not invent candidates.
It may only help rank existing candidates or explain the result.

---

## Step 1 — intent classification

Classify the request into one or more work types.

### Initial work types
- `engineering`
- `infrastructure`
- `design`
- `growth`
- `product`
- `strategy`
- `research`
- `cross_functional`
- `ambiguous`

A request can hit multiple types.

### Example mappings
- “fix OAuth callback bug” → `engineering`
- “debug deploy failure” → `infrastructure`, `engineering`
- “rewrite homepage copy” → `design`, `growth`
- “figure out why activation dropped” → `growth`, `product`, `cross_functional`
- “what should we do next?” → `strategy`, `ambiguous`

---

## Step 2 — candidate generation

Candidate generation should be broad and deterministic.

### Candidate pool
Start from all:
- active agents
- in the current company / org
- not terminated / disabled

### Candidate metadata used in v0
Each agent should expose:
- `role`
- `title`
- `capabilities[]`
- `reportsTo`
- `status`

---

## Step 3 — deterministic scoring

Every candidate gets a score.

Suggested v0 score components:

### A. capability match
Match request text against capability keywords.

Example:
- if request mentions `deploy`, `infra`, `server`, `build`, `hosting`, `CI`, `observability`
  - boost infra-capable agents
- if request mentions `copy`, `hero`, `landing page`, `UX`, `design`, `brand`
  - boost design-capable agents
- if request mentions `activation`, `conversion`, `funnel`, `onboarding`, `growth`
  - boost growth-capable agents
- if request mentions `strategy`, `prioritize`, `what should we do`, `plan`, `tradeoff`
  - boost leadership/strategy agents

### B. role prior
Role priors should influence routing.

Example priors:
- CEO / orchestrator better for ambiguous and cross-functional work
- CTO / infra leads better for infrastructure and technical triage
- designers better for UX/copy/presentation tasks
- product/growth leads better for metric movement and funnel questions
- engineers better for implementation bugs/features

### C. chain-of-command adjustment
If the task is broad or unclear, bias upward.
If the task is narrow and executional, bias downward toward specialists.

### D. availability gate
Agents that are:
- terminated
- paused
- unavailable

should be excluded or heavily penalized.

---

## Step 4 — routing policy decision

After scoring, select a routing mode.

### `direct`
Use when there is a strong specialist winner.

Examples:
- bug fix
- deploy issue
- landing page copy update

### `manager_first`
Use when work is in a known domain but is broad enough that a lead/manager should decide final sub-ownership.

Examples:
- “improve onboarding activation”
- “clean up the developer experience for deploys”

### `org_top`
Use when work is strategic, ambiguous, or clearly cross-functional.

Examples:
- “figure out why growth is stalling”
- “plan next quarter product strategy”

### `clarify`
Use when confidence is too low to route responsibly.

Examples:
- “work on this thing”
- “handle that problem from before”

---

## Confidence policy

Confidence should be explicit.

### Proposed thresholds
- `>= 0.80` → `direct`
- `0.55 - 0.79` → `manager_first` or `org_top`
- `< 0.55` → `clarify`

This can be heuristic initially.
The important thing is that the system behaves consistently.

---

## Clarification rule

The router should only ask a question when:
- no candidate has meaningful score separation
- request is too underspecified
- multiple domains conflict with no obvious escalation target

Do **not** ask clarification just because the system is slightly uncertain.
When possible, route to a manager/orchestrator instead.

---

## Top-level routing rule

When in doubt:
- route broad/ambiguous work to the top relevant manager
- route strongly cross-functional work to the top org node / orchestrator

This is better than asking the user to manually dispatch.

---

## Initial capability keyword heuristics

These should be implemented as simple seed rules first.

### Infrastructure
Keywords:
- deploy
- deployment
- infra
- server
- build
- CI
- CD
- pipeline
- observability
- metrics
- logs
- hosting
- docker
- kubernetes
- SSL
- DNS

### Engineering
Keywords:
- bug
- fix
- API
- auth
- OAuth
- backend
- frontend
- feature
- refactor
- database
- schema
- TypeScript
- React

### Design
Keywords:
- design
- UX
- UI
- copy
- hero
- landing page
- visual
- brand
- layout

### Growth
Keywords:
- growth
- activation
- onboarding
- conversion
- funnel
- retention
- experiment
- signup
- acquisition

### Product
Keywords:
- roadmap
- prioritize
- spec
- flow
- product
- user problem
- requirements

### Strategy
Keywords:
- strategy
- plan
- tradeoff
- direction
- org
- who should own
- next move
- decide

### Research
Keywords:
- research
- compare
- analyze
- investigate
- benchmark
- explore

---

## Tie-breaking rules

If scores are close:

1. prefer manager over specialist for broad tasks
2. prefer specialist over manager for narrow implementation tasks
3. prefer active/available agents over busy/unavailable ones
4. prefer higher-level orchestrator if ambiguity remains

---

## Explanation contract

Every route must produce a compact explanation.

### Format
- one sentence
- mention top reason
- mention selected owner

### Good examples
- “Routed to CTO because this request is about deployment and infrastructure reliability.”
- “Routed to Designer because the request focuses on landing page copy and presentation.”
- “Routed to CEO because the request is cross-functional and needs top-level delegation.”

### Bad examples
- “This seemed like the best option.”
- “The model thinks this is good.”
- “Based on the intent provided, this agent may be suitable.”

No mush.

---

## Re-delegation rules

After initial routing, the selected owner should be able to:
- accept and execute
- delegate downward
- escalate upward
- request clarification

### Default behavior
- managers may re-delegate downward
- specialists may escalate upward when blocked/out-of-domain
- CEO/orchestrator may delegate to any suitable downstream agent

---

## Event model requirements

Each routing-related event should be recorded.

### Required event types
- `intent.created`
- `intent.routed`
- `run.dispatched`
- `run.delegated`
- `run.escalated`
- `run.blocked`
- `run.completed`
- `intent.clarification_requested`

Without these, the delegation trace won’t be real.

---

## v0 rules for what NOT to do

Do not:
- ask the user to assign an agent in the normal flow
- use only an LLM with no deterministic scoring
- silently route without explanation
- conflate issue creation with routing logic
- add PM-board complexity before routing works

---

## Test cases that must pass

### Case 1 — infrastructure
Input:
> fix the broken deploy on production

Expected:
- infra/CTO/DevOps candidate wins
- explanation mentions deployment/infra

### Case 2 — design/copy
Input:
> rewrite the hero copy so the value prop is clearer

Expected:
- designer/growth/design lead wins
- explanation mentions copy/landing page

### Case 3 — ambiguous strategic
Input:
> figure out why onboarding conversion fell and what to do about it

Expected:
- manager-first or CEO/org-top route
- explanation mentions cross-functional ambiguity

### Case 4 — underspecified
Input:
> handle that weird thing from earlier

Expected:
- clarify

### Case 5 — implementation bug
Input:
> fix the OAuth callback bug in the app

Expected:
- engineer wins
- not CEO

---

## Recommended implementation order

1. implement deterministic candidate generation
2. implement keyword/capability scoring
3. implement routing mode selection
4. implement explanation builder
5. add tests for the five canonical cases
6. optionally add LLM explanation/ranking after deterministic path works

---

## TL;DR

Routing v0 should be:
- deterministic first
- explainable always
- manager-aware
- zero-assignment by default

If the user still has to choose the worker, the router has failed.
