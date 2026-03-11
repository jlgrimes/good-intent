# Good Intent Protocol v0

## Purpose

This document defines the first protocol layer for Good Intent.

Good Intent is not only a product UI.
It is also an attempt to define a portable contract for:
- human intent
- routing decisions
- delegation handoff
- execution updates
- delegation trace

If the product layer is the experience, the protocol layer is the substrate.

The goal is to make this protocol:
- runtime-agnostic
- human-readable
- append-only where possible
- explainable
- extensible
- easy for other products and runtimes to consume

---

## Working name

**Intent Delegation Protocol (IDP)**

This is the provisional name for the contract described here.

The name can change later.
The structure matters more than the branding.

---

## What this protocol is for

The protocol should allow any compatible system to:

1. submit an intent
2. inspect the routing decision
3. issue a delegation order
4. accept / reject / re-delegate / escalate work
5. publish execution updates
6. emit a replayable trace of what happened

This means the protocol should work across:
- Good Intent
- Paperclip-like systems
- OpenClaw-like runtimes
- coding agents
- human operators
- workflow engines
- future delegation products

---

## Design goals

### 1. Human intent is first-class
The protocol begins with what the human wants, not with which worker gets chosen.

### 2. Routing is explicit
The system must preserve not just the selected owner, but why they were selected.

### 3. Delegation is a real handoff object
There should be a portable object that says:
- what work is being handed off
- from whom
- to whom
- with what constraints
- with what success criteria

### 4. The trace is append-only
We should be able to reconstruct the delegation path over time.

### 5. Runtime independence
The protocol must not hardcode one execution system.

### 6. Extensibility
We need stable required fields plus a place for optional metadata and future extensions.

---

## Core protocol objects

The protocol starts with five core objects.

1. `Intent`
2. `RoutingDecision`
3. `DelegationOrder`
4. `DelegationEvent`
5. `ExecutionUpdate`

---

# 1. Intent

## Meaning
Represents what the human wants done.

It is the canonical input object.

## Required fields
- `id`
- `version`
- `created_at`
- `created_by`
- `source`
- `text`

## Optional fields
- `project`
- `urgency`
- `deadline`
- `constraints`
- `attachments`
- `context`
- `labels`
- `metadata`

## Suggested shape

```json
{
  "type": "intent",
  "version": "idp.v0",
  "id": "intent_01",
  "created_at": "2026-03-11T04:00:00Z",
  "created_by": {
    "type": "user",
    "id": "user_123"
  },
  "source": {
    "product": "good-intent",
    "surface": "web"
  },
  "text": "Fix the broken deploy on production.",
  "project": "marketing-site",
  "urgency": "high",
  "constraints": [
    "Minimize downtime",
    "Do not change DNS unless necessary"
  ],
  "attachments": [],
  "context": {
    "company_id": "company_abc"
  },
  "metadata": {}
}
```

## Notes
- `text` should preserve the raw user phrasing.
- structured fields should enrich intent, not replace it.

---

# 2. RoutingDecision

## Meaning
Represents how the system interpreted the intent and selected ownership.

This object is critical because it captures reasoning, confidence, and alternatives.

## Required fields
- `id`
- `version`
- `intent_id`
- `created_at`
- `routing_mode`
- `selected_owner`
- `confidence`
- `reason`

## Optional fields
- `candidate_set`
- `policy_version`
- `classifier_output`
- `metadata`

## Suggested shape

```json
{
  "type": "routing_decision",
  "version": "idp.v0",
  "id": "route_01",
  "intent_id": "intent_01",
  "created_at": "2026-03-11T04:00:02Z",
  "routing_mode": "direct",
  "selected_owner": {
    "type": "agent",
    "id": "agent_cto"
  },
  "confidence": 0.89,
  "reason": "Routed to CTO because the request is about deployment and infrastructure reliability.",
  "candidate_set": [
    {
      "actor": { "type": "agent", "id": "agent_cto" },
      "score": 0.89,
      "summary": "Strong infra match"
    },
    {
      "actor": { "type": "agent", "id": "agent_infra" },
      "score": 0.84,
      "summary": "Strong infra specialist fit"
    }
  ],
  "policy_version": "routing-rules.v0",
  "metadata": {}
}
```

## Routing modes
Initial values:
- `direct`
- `manager_first`
- `org_top`
- `clarify`

---

# 3. DelegationOrder

## Meaning
Represents an actual handoff from one actor to another.

This is probably the most important portable object in the protocol.

If Intent is the ask, DelegationOrder is the command.

## Required fields
- `id`
- `version`
- `intent_id`
- `issued_at`
- `from_actor`
- `to_actor`
- `objective`

## Optional fields
- `success_criteria`
- `constraints`
- `priority`
- `deadline`
- `context_refs`
- `routing_decision_id`
- `metadata`

## Suggested shape

```json
{
  "type": "delegation_order",
  "version": "idp.v0",
  "id": "order_01",
  "intent_id": "intent_01",
  "routing_decision_id": "route_01",
  "issued_at": "2026-03-11T04:00:03Z",
  "from_actor": {
    "type": "system",
    "id": "good-intent-router"
  },
  "to_actor": {
    "type": "agent",
    "id": "agent_cto"
  },
  "objective": "Fix the broken deploy on production.",
  "success_criteria": [
    "Production deploy is healthy",
    "Root cause is identified",
    "Status is reported back"
  ],
  "constraints": [
    "Minimize downtime"
  ],
  "priority": "high",
  "context_refs": [
    { "kind": "intent", "id": "intent_01" }
  ],
  "metadata": {}
}
```

## Notes
- this object should be consumable by runtimes directly
- other products should be able to turn this into work without understanding the whole product UI

---

# 4. DelegationEvent

## Meaning
Represents an append-only lifecycle event in the delegation trace.

This is the core replay primitive.

## Required fields
- `id`
- `version`
- `run_id`
- `timestamp`
- `event_type`
- `summary`

## Optional fields
- `intent_id`
- `order_id`
- `from_actor`
- `to_actor`
- `status`
- `metadata`

## Suggested shape

```json
{
  "type": "delegation_event",
  "version": "idp.v0",
  "id": "evt_01",
  "run_id": "run_01",
  "intent_id": "intent_01",
  "order_id": "order_01",
  "timestamp": "2026-03-11T04:00:03Z",
  "event_type": "routed",
  "from_actor": {
    "type": "system",
    "id": "good-intent-router"
  },
  "to_actor": {
    "type": "agent",
    "id": "agent_cto"
  },
  "status": "queued",
  "summary": "Intent routed to CTO.",
  "metadata": {
    "routing_mode": "direct",
    "confidence": 0.89
  }
}
```

## Initial event types
- `intent_created`
- `intent_routed`
- `order_issued`
- `accepted`
- `delegated`
- `escalated`
- `blocked`
- `clarification_requested`
- `completed`
- `cancelled`

---

# 5. ExecutionUpdate

## Meaning
Represents live or checkpointed progress from the current owner.

This is distinct from DelegationEvent because it focuses on execution state rather than ownership changes.

## Required fields
- `id`
- `version`
- `run_id`
- `timestamp`
- `status`

## Optional fields
- `progress`
- `summary`
- `artifact_refs`
- `needs_input`
- `blocker`
- `metadata`

## Suggested shape

```json
{
  "type": "execution_update",
  "version": "idp.v0",
  "id": "update_01",
  "run_id": "run_01",
  "timestamp": "2026-03-11T04:10:00Z",
  "status": "running",
  "progress": 0.4,
  "summary": "Investigated deployment logs and isolated a failed environment variable lookup.",
  "artifact_refs": [],
  "needs_input": false,
  "metadata": {}
}
```

---

## Actor model

All protocol objects should reference actors using a shared shape.

## Actor shape

```json
{
  "type": "agent | user | system | human | runtime",
  "id": "string"
}
```

Optional extensions later:
- `name`
- `role`
- `runtime`
- `display`

Keep the base shape small.

---

## Run model

To connect these objects, we need a concept of a run.

## DelegationRun
Not necessarily a top-level protocol object yet, but important operationally.

It represents the execution container for:
- routing
- orders
- delegation events
- execution updates

Suggested fields:
- `id`
- `intent_id`
- `root_routing_decision_id`
- `current_owner`
- `status`
- `created_at`
- `updated_at`

---

## State model

The protocol should support reconstruction from events.

### Prefer append-only event history
Mutable summary state is allowed for convenience, but the truth should be recoverable from:
- routing decisions
- delegation orders
- delegation events
- execution updates

This makes the system:
- auditable
- debuggable
- portable

---

## Versioning

Version every protocol object explicitly.

### Initial version
- `idp.v0`

### Rule
New fields may be added in backward-compatible ways.
Breaking structural changes should move to:
- `idp.v1`
- `idp.v2`

Do not rely on implicit versioning.

---

## Extension points

Every major object may contain:
- `metadata`
- `extensions`

Use these for:
- product-specific data
- runtime-specific data
- experimental fields

Do not pollute the required schema with product-local detail too early.

---

## Compatibility goals

The protocol should be easy to map into:
- JSON over HTTP
- event streams
- message buses
- DB rows
- audit logs

It should also be possible for another system to consume only part of the protocol.

Examples:
- one app emits `Intent`
- another service computes `RoutingDecision`
- a runtime consumes `DelegationOrder`
- a dashboard renders `DelegationEvent` + `ExecutionUpdate`

That composability is important.

---

## What should remain product-specific

The protocol should not standardize every UI opinion.

Product-specific concerns include:
- inbox design
- timeline rendering details
- approval widgets
- auth/session strategy
- pricing/billing model
- exact runtime transport mechanism

The protocol should standardize work coordination, not the entire app surface.

---

## Example end-to-end sequence

### 1. Human submits intent
System creates `Intent`.

### 2. Router evaluates ownership
System creates `RoutingDecision`.

### 3. System issues handoff
System creates `DelegationOrder`.

### 4. System records lifecycle
System appends `DelegationEvent`:
- `intent_routed`
- `order_issued`

### 5. Assignee begins work
Runtime emits `ExecutionUpdate`.

### 6. Assignee re-delegates
System creates another `DelegationOrder` and appends `DelegationEvent(type=delegated)`.

### 7. Work completes
Runtime emits `ExecutionUpdate(status=done)` and system appends `DelegationEvent(type=completed)`.

---

## Protocol quality bar

A change is good if it makes the protocol more:
- legible
- portable
- replayable
- explainable
- runtime-neutral

A change is bad if it makes the protocol:
- tightly bound to one product UI
- dependent on hidden prompt behavior
- impossible to replay or audit
- ambiguous about ownership transfer

---

## Initial implementation recommendation

For the product build, implement protocol support in this order:

1. `Intent`
2. `RoutingDecision`
3. `DelegationOrder`
4. `DelegationEvent`
5. `ExecutionUpdate`

Do not try to standardize every future runtime concern before the first working slice exists.

---

## Open questions

1. Should `DelegationOrder` be immutable once issued?
2. Should `ExecutionUpdate` be fully evented or allow latest-state overwrite semantics too?
3. Should confidence be standardized as `0-1` float or bucketed enum?
4. Should `candidate_set` be required or optional for privacy/runtime reasons?
5. How should human actors vs machine actors be represented in mixed teams?

---

## TL;DR

Good Intent should not just be an app.
It should define a clean delegation contract.

That contract starts with:
- `Intent`
- `RoutingDecision`
- `DelegationOrder`
- `DelegationEvent`
- `ExecutionUpdate`

If we get this right, Good Intent becomes:
- a product
- a reference implementation
- and possibly the first real standard for agentic delegation runtimes
