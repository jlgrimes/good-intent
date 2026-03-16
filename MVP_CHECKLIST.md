# Good Intent — MVP Checklist

## MVP question

Can a user say what they want done **without choosing a worker**, and can the system route it to the right owner with a legible trace?

If yes, the wedge exists.
If no, this is still PM software cosplay.

---

## Current wedge status

### Already real
- [x] User can open the app and submit an intent with **no assignee picker**
- [x] API persists intents
- [x] Deterministic router selects an owner from a seed org
- [x] Router returns routing mode, confidence, and compact explanation
- [x] UI shows selected owner + why
- [x] Routing alternatives are inspectable
- [x] Delegation run skeleton is persisted
- [x] Delegation events are persisted and shown in the trace
- [x] Delegation orders are persisted as first-class handoff objects
- [x] Execution updates are persisted separately from events
- [x] User can trigger follow-up run actions (`delegate`, `escalate`, `block`, `complete`, `needs_input`, `reply_to_input`)
- [x] Inbox/detail flow exists for previously submitted intents
- [x] IDP export exists for the routed trace
- [x] Real HTTP smoke test proves create -> route -> detail -> export

### Not done yet
- [ ] Real agent/runtime dispatch beyond local wedge state
- [ ] Delegation trace connected to an actual worker execution environment
- [ ] Non-seed org management / editable org definitions
- [ ] Better workload/availability-aware routing
- [ ] Clarification loop that actually amends and re-routes the original ask in-place
- [ ] More robust package/service boundaries inside the API layer
- [ ] Clean repo extraction / GitHub monorepo packaging

---

## MVP acceptance criteria

### A. Zero-assignment primary flow
- [x] Main submit path never asks the user to choose an assignee
- [x] Intent submit works from the web UI
- [x] Intent submit works via API

### B. Automatic routing
- [x] Router can choose a winner from the org automatically
- [x] Routing modes are explicit: `direct`, `manager_first`, `org_top`, `clarify`
- [x] Candidate scoring is deterministic-first
- [x] Clarify mode exists for underspecified asks

### C. Explainability
- [x] Chosen owner is shown
- [x] Explanation is shown
- [x] Confidence is shown in a legible way
- [x] Alternatives are inspectable
- [x] Inbox rows communicate the shape of the routing decision

### D. Delegation trace
- [x] Routing decision persists
- [x] Delegation run persists
- [x] Delegation order persists
- [x] Delegation events persist
- [x] Execution updates persist
- [x] Trace is visible in UI

### E. Follow-up ownership changes
- [x] A routed run can be delegated to another owner
- [x] A routed run can escalate upward
- [x] A routed run can be marked blocked
- [x] A routed run can be completed
- [x] A routed run can request input and resume

### F. Proof / validation
- [x] Router unit tests exist
- [x] API integration tests exist
- [x] Real HTTP smoke flow exists
- [x] Build/typecheck scripts exist
- [x] Fresh DB reset/seed path exists

---

## What counts as MVP-complete enough to show someone

This is the bar for “the wedge is real enough to demo,” not “the company is finished.”

### Demo bar
- [x] Open app
- [x] Submit an intent without choosing a worker
- [x] Watch the app auto-select an owner
- [x] See a one-sentence explanation
- [x] Inspect alternatives / routing mode
- [x] See a compact trace
- [x] Reassign / escalate / complete from the same product surface

That bar is already met.

---

## What is still missing from the stronger MVP

This is the next real bar beyond the current local wedge.

### Stronger MVP bar
- [ ] Dispatch the chosen owner into a real runtime/worker, not just local app state
- [ ] Capture actual runtime progress back into `execution_updates`
- [ ] Preserve the same trace semantics when a real worker accepts / delegates / blocks / completes
- [ ] Support org data beyond the hardcoded demo seed
- [ ] Make clarification a true resume-and-reroute flow

This is the right next frontier because it deepens the wedge instead of widening the surface area.

---

## Canonical demo scenarios

These should remain green as the product evolves:

- [x] `Fix the broken deploy on production` → infra/CTO path
- [x] `Rewrite the homepage hero copy so the value prop is clearer` → design path
- [x] `Figure out why onboarding conversion dropped this week` → manager-first or org-top path
- [x] `Fix the OAuth callback bug in the app` → engineering path
- [x] `Handle that weird thing from earlier` → clarify

If these break, the wedge is regressing.

---

## Immediate next-step checklist

These are the best next slices in order.

### 1. Connect routing to a real runtime
- [ ] Define the first concrete dispatch adapter target
- [ ] Create runtime dispatch records from delegation orders
- [ ] Ingest runtime progress back into `execution_updates`
- [ ] Keep the current trace contract intact

### 2. Split overloaded API orchestration code
- [ ] Extract routing service from `store.ts`
- [ ] Extract delegation service from `store.ts`
- [ ] Extract intent view/inbox summary builders from `store.ts`
- [ ] Keep smoke flow green during the split

### 3. Make clarify more real
- [ ] Allow replying to a clarification from the main intent surface
- [ ] Attach the new context to the original intent/run history
- [ ] Re-route the updated intent without creating a weird duplicate experience

### 4. Prepare repo extraction cleanly
- [ ] Remove accidental generated/runtime clutter from the repo shape
- [ ] Confirm package boundaries are real, not just named
- [ ] Add repo-level extraction notes if GitHub push becomes imminent

---

## Hard no list

Do **not** spend MVP cycles on:
- [ ] assignee pickers in the main flow
- [ ] kanban boards
- [ ] generic issue tracker features
- [ ] broad settings surfaces
- [ ] auth/billing rabbit holes
- [ ] visual polish that does not strengthen the delegation wedge

---

## Short read on where the project stands

Good Intent already has the core local proof:

**intent in -> automatic org-aware routing out -> visible delegation trace**

The next serious move is not more dashboarding.
It is connecting that routing/trace model to a real worker runtime while keeping the zero-assignment flow intact.
