# Good Intent — Product Spec v0

## One-line idea

**Good Intent is an intent router for AI teams:** you say what needs to get done, and the system routes it to the right agent automatically.

## The problem

Current agent tools mostly assume the human is still the dispatcher.

They let you:
- create agents
- create tasks
- assign work
- track runs
- inspect results

But they still rely on a person to answer the most important question:

**Who should do this?**

That means the user is still doing project-manager labor:
- picking assignees
- translating intent into org structure
- remembering who owns what
- deciding when to escalate
- manually routing ambiguous work

This breaks the core promise.

If the user still has to choose the worker, the system is not really delegating. It is just a nicer interface for manual assignment.

## The wedge

The wedge is simple:

**intent in → org-aware delegation out**

A user should be able to say:
- “Fix the landing page copy”
- “Investigate why onboarding completion dropped”
- “Prepare a launch plan for this feature”
- “Clean up our deployment setup”

…and the system should:
1. understand the request
2. inspect the org chart / capabilities
3. choose the right owner
4. explain why
5. dispatch the work
6. track execution and escalation

That is the product.

## Product thesis

The best interface for agent orchestration is **not assignment**.
It is **delegation**.

Humans should express:
- intent
- context
- urgency
- constraints

The system should handle:
- routing
- ownership
- delegation chain
- reassignment
- escalation
- execution visibility

## Core promise

**Tell the system what you want done. It gets it to the right agent.**

Not:
- “manage an AI org chart”
- “file issues for agents”
- “assign work better”

But:
- **“Say the thing. The org handles it.”**

## Who this is for

### Primary user
A builder / operator / founder running multiple AI agents with differentiated roles.

They already:
- think in terms of roles and responsibilities
- maintain multiple prompts/personas
- manually choose which agent should do which task
- feel the overhead of dispatching work

### Ideal early user
Someone already doing agent orchestration manually in:
- text files
- chat threads
- task managers
- custom scripts

They do not need convincing that AI agents can do work.
They need relief from being the router.

## Non-goals for v0

Good Intent v0 is **not**:
- a generic project management tool
- a full Jira/Linear replacement
- a broad enterprise workflow platform
- a general-purpose multi-agent simulation layer
- an all-in-one autonomy platform

If we overbuild here, we die.

The first question is only:

**Can Good Intent route work better than a human manually choosing the assignee?**

## MVP definition

The MVP is a narrow, opinionated delegation flow.

### Input
A single task / intent input with:
- request text
- optional project / company / team scope
- optional urgency
- optional constraints / deadline

### Output
A routing decision with:
- chosen owner
- confidence level
- reasoning / explanation
- dispatched run or queued task

### Required behaviors

#### 1. Zero-assignment default
The normal user flow should **not** ask “who should this go to?”

That question is the whole thing we are trying to remove.

Manual assignment can exist as an advanced override, but it should not be the primary path.

#### 2. Org-aware routing
The router should use:
- org graph
- role
- capabilities
- reporting chain
- current availability / active load (later if needed)

#### 3. Chain-of-command semantics
By default, ambiguous work should route to the top of the relevant org chain.

Examples:
- broad product work → CEO / PM / manager
- infra work → CTO / DevOps lead
- design work → design lead / designer
- unclear cross-functional work → CEO / orchestrator

This matters because delegation is not only specialist matching. It is also management routing.

#### 4. Explainability
Every routing decision should come with a compact explanation.

Examples:
- “Routed to CTO because this task mentions deployment, infra, and build failures.”
- “Routed to Designer because the request is about copy and landing page presentation.”
- “Routed to CEO because the task is cross-functional and ambiguous.”

Without explanation, routing feels fake.

#### 5. Escalation
If the selected agent cannot or should not own the work, the system needs a clear path to:
- re-delegate downward
- bounce upward to manager
- ask a clarifying question

## The user experience

### Primary flow
1. User enters task
2. Good Intent evaluates routing
3. Good Intent shows:
   - who owns it
   - why
   - confidence
4. Good Intent dispatches the task
5. User watches execution / status
6. If blocked, the system escalates or asks for clarification

### UX principle
The user should feel like they are:
- giving direction to an organization

not:
- filing a ticket into software

## Product primitives

### 1. Agent
Represents a worker or manager in the org.

Core fields:
- id
- name
- role
- title
- capabilities
- reportsTo
- status / availability
- execution environment

### 2. Intent
Represents what the human wants done.

Core fields:
- raw request text
- project / org scope
- urgency
- constraints
- createdBy
- createdAt

### 3. Routing Decision
Represents the system’s decision about ownership.

Core fields:
- selected agent
- confidence
- explanation
- alternative candidates
- routing mode (direct / chain-of-command / escalation)

### 4. Delegation Run
Represents the actual execution path.

Core fields:
- source intent
- initial assignee
- downstream delegations
- status
- result
- blocked reason
- escalation history

## Why this is different from existing agent tools

Most tools today are one of these:
- chat wrappers around individual agents
- PM tools with AI assignees
- workflow automators
- agent execution consoles

Good Intent is different if it becomes:

**an executable org chart with automatic delegation**

That is the wedge.

The value is not:
- agent creation
- task CRUD
- board views

The value is:
- removing routing labor from the human

## Design principles

### 1. Delegation > assignment
If the product asks the human to pick the worker in the normal flow, it is failing.

### 2. Default to one input
The cleanest experience is one box, not a form graveyard.

### 3. Make routing legible
A black-box router will not build trust.

### 4. Managers matter
The best owner is not always the final doer.
Sometimes the right move is routing to a manager who delegates.

### 5. Ask questions only when necessary
Clarification should be rare and confidence-driven.

### 6. Keep the wedge narrow
Do not build broad PM software around this until routing is obviously useful.

## Proposed MVP screens

### Screen 1 — Intent Inbox
A single input area for requests.

Could include:
- task text
- optional project selector
- optional urgency
- submit button

### Screen 2 — Routing Result
After submission, show:
- selected owner
- why they were chosen
- confidence
- status: routed / running / queued

### Screen 3 — Delegation Trace
A timeline showing:
- original intent
- initial route
- re-delegations
- blocked states
- completion

## Routing model (v0)

Start hybrid, not fully generative.

### Deterministic signals
Use explicit structured data first:
- role
- capabilities keywords
- org hierarchy
- manager relationships
- current run status / paused / terminated

### LLM assistance
Use an LLM only when helpful for:
- intent classification
- ambiguous candidate ranking
- explanation generation

### Confidence policy
- high confidence → route directly
- medium confidence → route to manager / orchestrator
- low confidence → ask a clarifying question

## Example routing behavior

### Example 1
Input:
> Fix the broken deploy on our marketing site

Expected route:
- CTO / DevOps / engineer with deployment capability

Why:
- infra + deploy + site operations

### Example 2
Input:
> Rewrite the hero copy so the value prop is clearer

Expected route:
- designer / brand / marketing owner

Why:
- copy + presentation + landing page messaging

### Example 3
Input:
> Figure out why activation dropped 18% this week and tell me what to do

Expected route:
- CEO / PM / growth owner first

Why:
- ambiguous, cross-functional, diagnostic, potentially requiring downstream delegation

## Success criteria for v0

We should be able to say yes to these:

1. A user can submit a task without choosing an assignee.
2. The system automatically chooses an owner from the org.
3. The system can explain the choice in one sentence.
4. The task is actually dispatched to that owner.
5. The owner can re-delegate or escalate.
6. The user can see the routing trail.

If we cannot do those six things, we have not built the wedge yet.

## What to build next after v0 proves out

Only after the wedge works should we expand into:
- better workload balancing
- SLA / urgency handling
- delegation memory / learned routing
- approval flows
- analytics
- org simulations
- external system integrations

But those are second-order.

## Sharp product summary

Good Intent should feel like:
- **“I tell the org what I want. The org takes it from there.”**

It should not feel like:
- **“I fill out a task form and pick the robot.”**

That distinction is the whole company.

## Open questions

1. Should routing go to the best direct specialist first, or top-down manager first?
2. How much should routing rely on static capabilities vs live context?
3. When should the system ask clarification instead of routing?
4. How should confidence be surfaced without becoming noisy?
5. How much manual override should exist in v0?

## Current recommendation

Build the MVP as:
- one intent box
- auto-router
- explanation layer
- dispatch to chosen owner
- visible delegation trace

That is the smallest version of the actual product.

---

## TL;DR

The wedge is not “better task assignment.”

The wedge is:

**automatic, org-aware delegation for AI teams**

A human states intent.
The system chooses ownership.
The org executes.
