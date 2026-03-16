import type { Agent, DelegationEvent, DelegationOrder, DispatchRecord, ExecutionUpdate, Intent, RoutingDecision } from '@good-intent/shared';

export type IdpActorType = 'agent' | 'user' | 'system' | 'human' | 'runtime';

export interface IdpActor {
  type: IdpActorType;
  id: string;
}

export interface IdpIntent {
  type: 'intent';
  version: 'idp.v0';
  id: string;
  created_at: string;
  created_by: IdpActor;
  source: {
    product: 'good-intent';
    surface: 'web';
  };
  text: string;
  project?: string;
  urgency?: string;
  constraints?: string[];
  context: {
    app_intent_status: string;
  };
  metadata: Record<string, unknown>;
}

export interface IdpRoutingDecision {
  type: 'routing_decision';
  version: 'idp.v0';
  id: string;
  intent_id: string;
  created_at: string;
  routing_mode: RoutingDecision['routingMode'];
  selected_owner: IdpActor | null;
  confidence: number;
  reason: string;
  candidate_set: Array<{
    actor: IdpActor;
    score: number;
    summary: string;
  }>;
  policy_version: 'routing-rules.v0';
  metadata: Record<string, unknown>;
}

export interface IdpDispatchReceiptRef {
  dispatch_record_id: string;
  runtime: DispatchRecord['runtime'];
  channel: string;
  status: DispatchRecord['status'];
  receipt_id: string;
  log_key: string;
  command: string;
  dispatched_at: string;
  launched_at?: string | null;
  ended_at?: string | null;
  process_pid?: number | null;
  exit_code?: number | null;
  last_error?: string | null;
  summary: string;
  artifact_refs: DispatchRecord['artifactRefs'];
}

export interface IdpDelegationOrder {
  type: 'delegation_order';
  version: 'idp.v0';
  id: string;
  intent_id: string;
  routing_decision_id?: string | null;
  run_id: string;
  issued_at: string;
  from_actor: IdpActor;
  to_actor: IdpActor;
  objective: string;
  success_criteria: string[];
  constraints: string[];
  priority: DelegationOrder['priority'];
  dispatch_receipt?: IdpDispatchReceiptRef | null;
  metadata: Record<string, unknown>;
}

export interface IdpDelegationEvent {
  type: 'delegation_event';
  version: 'idp.v0';
  id: string;
  run_id: string;
  intent_id: string;
  order_id?: string | null;
  timestamp: string;
  event_type: string;
  from_actor?: IdpActor;
  to_actor?: IdpActor;
  status?: string;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface IdpExecutionUpdate {
  type: 'execution_update';
  version: 'idp.v0';
  id: string;
  run_id: string;
  dispatch_record_id?: string | null;
  timestamp: string;
  status: ExecutionUpdate['status'];
  progress?: number | null;
  summary: string;
  artifact_refs?: ExecutionUpdate['artifactRefs'];
  needs_input: boolean;
  blocker?: string | null;
  metadata: Record<string, unknown>;
}

export interface IdpRun {
  id: string;
  intent_id: string;
  root_routing_decision_id?: string | null;
  current_owner: IdpActor | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IdpExport {
  version: 'idp.v0';
  exported_at: string;
  intent: IdpIntent;
  routing_decision: IdpRoutingDecision | null;
  run: IdpRun | null;
  delegation_orders: IdpDelegationOrder[];
  delegation_events: IdpDelegationEvent[];
  execution_updates: IdpExecutionUpdate[];
}

function buildDispatchReceiptRef(dispatchRecord: DispatchRecord | null | undefined): IdpDispatchReceiptRef | null {
  if (!dispatchRecord) return null;
  return {
    dispatch_record_id: dispatchRecord.id,
    runtime: dispatchRecord.runtime,
    channel: dispatchRecord.channel,
    status: dispatchRecord.status,
    receipt_id: dispatchRecord.receiptId,
    log_key: dispatchRecord.logKey,
    command: dispatchRecord.command,
    dispatched_at: dispatchRecord.dispatchedAt,
    summary: dispatchRecord.summary,
    artifact_refs: dispatchRecord.artifactRefs
  };
}

export interface IdpExamplePayload {
  key: 'direct' | 'manager_first' | 'clarify';
  title: string;
  description: string;
  export: IdpExport;
}

function actorForAgent(agentId: string | null | undefined): IdpActor | null {
  if (!agentId) return null;
  return { type: 'agent', id: agentId };
}

function systemActor(id: string): IdpActor {
  return { type: 'system', id };
}

function summarizeCandidate(candidate: RoutingDecision['candidateSnapshot'][number], agents: Agent[]) {
  const agent = agents.find((entry) => entry.id === candidate.agentId);
  return {
    actor: actorForAgent(candidate.agentId)!,
    score: candidate.score,
    summary: candidate.reasons.slice(0, 2).join(' · ') || `${agent?.title ?? candidate.agentName} candidate`
  };
}

export function buildIdpExport(params: {
  intent: Intent;
  decision: RoutingDecision | null;
  run: {
    id: string;
    intentId: string;
    currentAgentId: string | null;
    status: string;
    rootRoutingDecisionId: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  orders: DelegationOrder[];
  events: DelegationEvent[];
  executionUpdates: ExecutionUpdate[];
  dispatchRecords?: DispatchRecord[];
  agents: Agent[];
}): IdpExport {
  const { intent, decision, run, orders, events, executionUpdates, dispatchRecords = [], agents } = params;
  const exportedAt = new Date().toISOString();
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const dispatchRecordByOrderId = new Map(dispatchRecords.map((record) => [record.delegationOrderId, record]));
  const findMatchingOrderId = (event: DelegationEvent) => {
    if (event.delegationOrderId && orderById.has(event.delegationOrderId)) {
      return event.delegationOrderId;
    }

    const sameTargetOrder = [...orders]
      .reverse()
      .find((order) => order.delegationRunId === event.delegationRunId && order.toAgentId === (event.toAgentId ?? null));

    return sameTargetOrder?.id ?? null;
  };

  return {
    version: 'idp.v0',
    exported_at: exportedAt,
    intent: {
      type: 'intent',
      version: 'idp.v0',
      id: intent.id,
      created_at: intent.createdAt,
      created_by: systemActor('good-intent-user'),
      source: {
        product: 'good-intent',
        surface: 'web'
      },
      text: intent.text,
      project: intent.project,
      urgency: intent.urgency,
      constraints: intent.constraints ?? [],
      context: {
        app_intent_status: intent.status
      },
      metadata: {}
    },
    routing_decision: decision
      ? {
          type: 'routing_decision',
          version: 'idp.v0',
          id: decision.id,
          intent_id: intent.id,
          created_at: decision.createdAt,
          routing_mode: decision.routingMode,
          selected_owner: actorForAgent(decision.selectedAgentId),
          confidence: decision.confidence,
          reason: decision.reasoningSummary,
          candidate_set: decision.candidateSnapshot.map((candidate) => summarizeCandidate(candidate, agents)),
          policy_version: 'routing-rules.v0',
          metadata: {}
        }
      : null,
    run: run
      ? {
          id: run.id,
          intent_id: run.intentId,
          root_routing_decision_id: run.rootRoutingDecisionId,
          current_owner: actorForAgent(run.currentAgentId),
          status: run.status,
          created_at: run.createdAt,
          updated_at: run.updatedAt
        }
      : null,
    delegation_orders: orders.map((order) => ({
      type: 'delegation_order',
      version: 'idp.v0',
      id: order.id,
      intent_id: order.intentId,
      routing_decision_id: order.routingDecisionId ?? null,
      run_id: order.delegationRunId,
      issued_at: order.issuedAt,
      from_actor: actorForAgent(order.fromAgentId) ?? systemActor('good-intent-router'),
      to_actor: actorForAgent(order.toAgentId)!,
      objective: order.objective,
      success_criteria: order.successCriteria,
      constraints: order.constraints,
      priority: order.priority,
      dispatch_receipt: buildDispatchReceiptRef(dispatchRecordByOrderId.get(order.id)),
      metadata: {}
    })),
    delegation_events: events.map((event) => ({
      type: 'delegation_event',
      version: 'idp.v0',
      id: event.id,
      run_id: event.delegationRunId,
      intent_id: intent.id,
      order_id: findMatchingOrderId(event),
      timestamp: event.createdAt,
      event_type: event.type,
      from_actor: actorForAgent(event.fromAgentId) ?? undefined,
      to_actor: actorForAgent(event.toAgentId) ?? undefined,
      status: run?.status,
      summary: event.summary,
      metadata: event.metadata
    })),
    execution_updates: executionUpdates.map((update) => ({
      type: 'execution_update',
      version: 'idp.v0',
      id: update.id,
      run_id: update.delegationRunId,
      dispatch_record_id: update.dispatchRecordId ?? null,
      timestamp: update.createdAt,
      status: update.status,
      progress: update.progress,
      summary: update.summary,
      artifact_refs: update.artifactRefs ?? [],
      needs_input: Boolean(update.needsInput),
      blocker: update.blocker,
      metadata: update.needsInput ? { needs_input_reason: update.needsInput } : {}
    }))
  };
}
