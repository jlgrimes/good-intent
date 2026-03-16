import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import type { DelegationActionInput, DelegationEvent, DelegationOrder, DelegationRun, DispatchRecord, ExecutionUpdate, Intent, RouteIntentResult, RoutingDecision as SharedRoutingDecision } from '@good-intent/shared';
import { routeIntent } from '../../../packages/router-engine/src/index.js';
import { delegationEventsTable, delegationOrdersTable, delegationRunsTable, executionUpdatesTable, intentsTable, routingDecisionsTable } from './db';
import { dispatchRecordsTable } from './schema.js';
import type { GoodIntentStoreDeps } from './store-types.js';
import { buildIntentView, toRouteIntentResult } from './view-models.js';
import { getDefaultRuntimeDispatcher } from './runtime-dispatch.js';

function nowIso() {
  return new Date().toISOString();
}

export function createDelegationRun(deps: GoodIntentStoreDeps, intentId: string, routingDecisionId: string, selectedAgentId: string): DelegationRun {
  const now = nowIso();
  const run: DelegationRun = {
    id: `run_${nanoid(10)}`,
    intentId,
    currentAgentId: selectedAgentId,
    status: 'queued',
    rootRoutingDecisionId: routingDecisionId,
    createdAt: now,
    updatedAt: now
  };

  deps.database.db.insert(delegationRunsTable).values({
    id: run.id,
    intentId: run.intentId,
    currentAgentId: run.currentAgentId,
    status: run.status,
    rootRoutingDecisionId: run.rootRoutingDecisionId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  }).run();

  return run;
}

export function persistDispatchRecord(
  deps: GoodIntentStoreDeps,
  input: {
    intentId: string;
    runId: string;
    delegationOrderId: string;
    toAgentId: string;
    dispatchReceipt: import('./runtime-dispatch.js').DispatchReceipt;
  }
): DispatchRecord {
  const record: DispatchRecord = {
    id: `dispatch_record_${nanoid(10)}`,
    delegationOrderId: input.delegationOrderId,
    delegationRunId: input.runId,
    intentId: input.intentId,
    toAgentId: input.toAgentId,
    runtime: input.dispatchReceipt.runtime,
    channel: input.dispatchReceipt.channel,
    status: input.dispatchReceipt.status,
    receiptId: input.dispatchReceipt.receiptId,
    summary: input.dispatchReceipt.summary,
    command: input.dispatchReceipt.command,
    logKey: input.dispatchReceipt.logKey,
    artifactRefs: input.dispatchReceipt.artifactRefs,
    dispatchedAt: input.dispatchReceipt.dispatchedAt,
    launchedAt: input.dispatchReceipt.launchedAt ?? null,
    lastError: input.dispatchReceipt.lastError ?? null
  };

  deps.database.db.insert(dispatchRecordsTable).values({
    id: record.id,
    delegationOrderId: record.delegationOrderId,
    delegationRunId: record.delegationRunId,
    intentId: record.intentId,
    toAgentId: record.toAgentId,
    runtime: record.runtime,
    channel: record.channel,
    status: record.status,
    receiptId: record.receiptId,
    summary: record.summary,
    command: record.command,
    logKey: record.logKey,
    artifactRefsJson: deps.serializeJson(record.artifactRefs),
    dispatchedAt: record.dispatchedAt,
    launchedAt: record.launchedAt ?? null,
    endedAt: record.endedAt ?? null,
    processPid: record.processPid ?? null,
    exitCode: record.exitCode ?? null,
    lastError: record.lastError ?? null
  }).run();

  return record;
}

export function createDelegationOrder(
  deps: GoodIntentStoreDeps,
  input: {
    intent: Intent;
    run: DelegationRun;
    routingDecisionId?: string | null;
    fromAgentId?: string | null;
    toAgentId: string;
    objective?: string;
    successCriteria?: string[];
    constraints?: string[];
    priority?: DelegationOrder['priority'];
  }
) {
  const targetAgent = deps.getAgentById(input.toAgentId);
  if (!targetAgent) {
    throw new Error(`delegation target not found: ${input.toAgentId}`);
  }

  const order: DelegationOrder = {
    id: `order_${nanoid(10)}`,
    intentId: input.intent.id,
    routingDecisionId: input.routingDecisionId ?? null,
    delegationRunId: input.run.id,
    fromAgentId: input.fromAgentId ?? null,
    toAgentId: input.toAgentId,
    objective: input.objective ?? input.intent.text,
    successCriteria: input.successCriteria ?? ['Own the task', 'Advance or finish the work', 'Report status in the trace'],
    constraints: input.constraints ?? input.intent.constraints ?? [],
    priority: input.priority ?? (input.intent.urgency === 'high' ? 'high' : 'normal'),
    issuedAt: nowIso()
  };

  deps.database.db.insert(delegationOrdersTable).values({
    id: order.id,
    intentId: order.intentId,
    routingDecisionId: order.routingDecisionId,
    delegationRunId: order.delegationRunId,
    fromAgentId: order.fromAgentId,
    toAgentId: order.toAgentId,
    objective: order.objective,
    successCriteriaJson: deps.serializeJson(order.successCriteria),
    constraintsJson: deps.serializeJson(order.constraints),
    priority: order.priority,
    issuedAt: order.issuedAt
  }).run();

  const dispatchReceipt = getDefaultRuntimeDispatcher().dispatch({
    order,
    run: input.run,
    targetAgent
  });
  const dispatchRecord = persistDispatchRecord(deps, {
    intentId: input.intent.id,
    runId: input.run.id,
    delegationOrderId: order.id,
    toAgentId: targetAgent.id,
    dispatchReceipt
  });

  appendExecutionUpdate(deps, input.run.id, {
    dispatchRecordId: dispatchRecord.id,
    agentId: targetAgent.id,
    status: dispatchReceipt.status === 'error' ? 'blocked' : dispatchReceipt.status === 'running' ? 'running' : 'queued',
    summary: dispatchReceipt.summary,
    progress: dispatchReceipt.status === 'running' ? 0.05 : 0,
    blocker: dispatchReceipt.lastError ?? null,
    artifactRefs: dispatchReceipt.artifactRefs
  });

  return {
    order,
    dispatchReceipt,
    dispatchRecord
  };
}

export function appendDelegationEvent(
  deps: GoodIntentStoreDeps,
  runId: string,
  event: Omit<DelegationEvent, 'id' | 'delegationRunId' | 'createdAt'>
): DelegationEvent {
  const record: DelegationEvent = {
    id: `evt_${nanoid(10)}`,
    delegationRunId: runId,
    createdAt: nowIso(),
    ...event
  };

  deps.database.db.insert(delegationEventsTable).values({
    id: record.id,
    delegationRunId: record.delegationRunId,
    type: record.type,
    fromAgentId: record.fromAgentId ?? null,
    toAgentId: record.toAgentId ?? null,
    delegationOrderId: record.delegationOrderId ?? null,
    summary: record.summary,
    metadataJson: deps.serializeJson(record.metadata),
    createdAt: record.createdAt
  }).run();

  return record;
}

export function appendExecutionUpdate(
  deps: GoodIntentStoreDeps,
  runId: string,
  input: Omit<ExecutionUpdate, 'id' | 'delegationRunId' | 'createdAt'>
): ExecutionUpdate {
  const update: ExecutionUpdate = {
    id: `update_${nanoid(10)}`,
    delegationRunId: runId,
    createdAt: nowIso(),
    ...input,
    artifactRefs: input.artifactRefs ?? []
  };

  deps.database.db.insert(executionUpdatesTable).values({
    id: update.id,
    delegationRunId: update.delegationRunId,
    dispatchRecordId: update.dispatchRecordId ?? null,
    agentId: update.agentId ?? null,
    status: update.status,
    summary: update.summary,
    progress: update.progress ?? null,
    blocker: update.blocker ?? null,
    needsInput: update.needsInput ?? null,
    artifactRefsJson: deps.serializeJson(update.artifactRefs ?? []),
    createdAt: update.createdAt
  }).run();

  return update;
}

function updateRun(deps: GoodIntentStoreDeps, runId: string, updates: Partial<typeof delegationRunsTable.$inferInsert>) {
  deps.database.db.update(delegationRunsTable).set({ ...updates, updatedAt: nowIso() }).where(eq(delegationRunsTable.id, runId)).run();
}

function updateIntentStatus(deps: GoodIntentStoreDeps, intentId: string, status: Intent['status']) {
  deps.database.db.update(intentsTable).set({ status }).where(eq(intentsTable.id, intentId)).run();
}

export function routeStoredIntentWrite(deps: GoodIntentStoreDeps, intentId: string): RouteIntentResult | null {
  const intent = deps.getIntentById(intentId);
  if (!intent) return null;

  const routeResult = routeIntent(intent, deps.getAllAgents());
  const { selectedAgent, decisionDraft } = routeResult;
  const now = nowIso();
  const storedDecision: SharedRoutingDecision = {
    id: `route_${nanoid(10)}`,
    intentId: intent.id,
    selectedAgentId: selectedAgent?.id ?? null,
    routingMode: decisionDraft.routingMode,
    confidence: decisionDraft.confidence,
    reasoningSummary: decisionDraft.reasoningSummary,
    candidateSnapshot: decisionDraft.candidateSnapshot,
    createdAt: now
  };

  deps.database.db.insert(routingDecisionsTable).values({
    id: storedDecision.id,
    intentId: storedDecision.intentId,
    selectedAgentId: storedDecision.selectedAgentId,
    routingMode: storedDecision.routingMode,
    confidence: storedDecision.confidence,
    reasoningSummary: storedDecision.reasoningSummary,
    candidateSnapshotJson: deps.serializeJson(storedDecision.candidateSnapshot),
    createdAt: storedDecision.createdAt
  }).run();

  if (!selectedAgent) {
    deps.database.db.update(intentsTable).set({ status: 'pending' }).where(eq(intentsTable.id, intent.id)).run();
    const clarificationRun: DelegationRun = {
      id: `clarify_${nanoid(8)}`,
      intentId: intent.id,
      currentAgentId: null,
      status: 'blocked',
      rootRoutingDecisionId: storedDecision.id,
      createdAt: now,
      updatedAt: now
    };
    const clarificationEvent: DelegationEvent = {
      id: `evt_preview_${nanoid(6)}`,
      delegationRunId: clarificationRun.id,
      type: 'intent.clarification_requested',
      fromAgentId: null,
      toAgentId: null,
      summary: decisionDraft.reasoningSummary,
      metadata: { intentId: intent.id },
      createdAt: now
    };
    return toRouteIntentResult({
      ...buildIntentView({ ...intent, status: 'pending' }, { previewEvents: [clarificationEvent] }, deps),
      selectedAgent: null,
      run: null,
      events: [clarificationEvent],
      executionUpdates: []
    });
  }

  const run = createDelegationRun(deps, intent.id, storedDecision.id, selectedAgent.id);
  const { order: initialOrder, dispatchReceipt, dispatchRecord } = createDelegationOrder(deps, {
    intent,
    run,
    routingDecisionId: storedDecision.id,
    toAgentId: selectedAgent.id,
    successCriteria: [
      'Own the request',
      'Delegate further if needed',
      'Report completion or blockage back through the trace'
    ]
  });
  appendDelegationEvent(deps, run.id, {
    type: 'intent.routed',
    toAgentId: selectedAgent.id,
    delegationOrderId: initialOrder.id,
    summary: decisionDraft.reasoningSummary,
    metadata: {
      confidence: decisionDraft.confidence,
      routingMode: decisionDraft.routingMode,
      delegationOrderId: initialOrder.id
    }
  });
  appendDelegationEvent(deps, run.id, {
    type: 'run.dispatched',
    toAgentId: selectedAgent.id,
    delegationOrderId: initialOrder.id,
    summary: dispatchReceipt.summary,
    metadata: {
      delegationOrderId: initialOrder.id,
      dispatchReceipt,
      dispatchRecordId: dispatchRecord.id
    }
  });

  deps.database.db.update(intentsTable).set({ status: 'routed' }).where(eq(intentsTable.id, intent.id)).run();

  return toRouteIntentResult(buildIntentView({ ...intent, status: 'routed' }, {}, deps));
}

export function applyDelegationActionWrite(
  deps: GoodIntentStoreDeps,
  runId: string,
  input: DelegationActionInput
) {
  const run = deps.database.db.select().from(delegationRunsTable).where(eq(delegationRunsTable.id, runId)).get();
  if (!run) return null;
  const currentRun = deps.toDelegationRun(run);
  const intent = deps.getIntentById(currentRun.intentId);
  if (!intent) return null;
  const currentOwner = deps.getAgentById(currentRun.currentAgentId);

  if (input.action === 'delegate') {
    const target = deps.getAgentById(input.toAgentId);
    if (!target) return { error: 'delegate target not found' };
    updateRun(deps, runId, { currentAgentId: target.id, status: 'running' });
    updateIntentStatus(deps, intent.id, 'running');
    const { order, dispatchReceipt, dispatchRecord } = createDelegationOrder(deps, {
      intent,
      run: currentRun,
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: target.id,
      objective: input.summary || intent.text,
      successCriteria: ['Take ownership from the current delegate', 'Advance the task and leave trace updates']
    });
    appendDelegationEvent(deps, runId, {
      type: 'run.delegated',
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: target.id,
      delegationOrderId: order.id,
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} delegated to ${target.title}.`,
      metadata: { delegationOrderId: order.id, dispatchReceipt, dispatchRecordId: dispatchRecord.id }
    });
    appendExecutionUpdate(deps, runId, {
      agentId: target.id,
      status: 'running',
      summary: `${target.title} accepted the handoff and is actively working the intent.`,
      progress: 0.2,
      artifactRefs: [
        {
          label: 'Dispatch receipt',
          kind: 'note',
          value: `receipt:${dispatchReceipt.receiptId}`
        }
      ]
    });
  } else if (input.action === 'escalate') {
    const target = currentOwner?.reportsTo ? deps.getAgentById(currentOwner.reportsTo) : null;
    if (!target) return { error: 'no escalation target found' };
    updateRun(deps, runId, { currentAgentId: target.id, status: 'blocked' });
    updateIntentStatus(deps, intent.id, 'blocked');
    const { order, dispatchReceipt, dispatchRecord } = createDelegationOrder(deps, {
      intent,
      run: currentRun,
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: target.id,
      objective: input.summary || `Escalated: ${intent.text}`,
      successCriteria: ['Review the blockage', 'Reassign or unblock the work']
    });
    appendDelegationEvent(deps, runId, {
      type: 'run.escalated',
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: target.id,
      delegationOrderId: order.id,
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} escalated to ${target.title}.`,
      metadata: { delegationOrderId: order.id, dispatchReceipt, dispatchRecordId: dispatchRecord.id }
    });
    appendExecutionUpdate(deps, runId, {
      agentId: target.id,
      status: 'blocked',
      summary: `${target.title} now owns the escalated blockage.`,
      blocker: input.summary || 'Escalated for review',
      artifactRefs: [
        {
          label: 'Dispatch receipt',
          kind: 'note',
          value: `receipt:${dispatchReceipt.receiptId}`
        }
      ]
    });
  } else if (input.action === 'block') {
    updateRun(deps, runId, { status: 'blocked' });
    updateIntentStatus(deps, intent.id, 'blocked');
    appendDelegationEvent(deps, runId, {
      type: 'run.blocked',
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: currentOwner?.id ?? null,
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} reported a blocker.`,
      metadata: {}
    });
    appendExecutionUpdate(deps, runId, {
      agentId: currentOwner?.id ?? null,
      status: 'blocked',
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} is blocked.`,
      blocker: input.summary || 'Blocked',
      artifactRefs: []
    });
  } else if (input.action === 'needs_input') {
    updateRun(deps, runId, { status: 'running' });
    updateIntentStatus(deps, intent.id, 'pending');
    appendDelegationEvent(deps, runId, {
      type: 'run.needs_input',
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: currentOwner?.id ?? null,
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} requested more input.`,
      metadata: { needsInput: input.needsInput ?? null }
    });
    appendExecutionUpdate(deps, runId, {
      agentId: currentOwner?.id ?? null,
      status: 'needs_input',
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} needs more context before continuing.`,
      needsInput: input.needsInput ?? 'More context requested',
      artifactRefs: input.artifactRefs ?? []
    });
  } else if (input.action === 'reply_to_input') {
    updateRun(deps, runId, { status: 'running' });
    updateIntentStatus(deps, intent.id, 'running');
    appendDelegationEvent(deps, runId, {
      type: 'run.input_received',
      fromAgentId: null,
      toAgentId: currentOwner?.id ?? null,
      summary: input.summary || 'User supplied the requested context.',
      metadata: {}
    });
    appendExecutionUpdate(deps, runId, {
      agentId: currentOwner?.id ?? null,
      status: 'running',
      summary: input.summary || 'New context received and the run is active again.',
      progress: 0.35,
      artifactRefs: input.artifactRefs ?? []
    });
  } else if (input.action === 'complete') {
    updateRun(deps, runId, { status: 'done' });
    updateIntentStatus(deps, intent.id, 'done');
    appendDelegationEvent(deps, runId, {
      type: 'run.completed',
      fromAgentId: currentOwner?.id ?? null,
      toAgentId: currentOwner?.id ?? null,
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} completed the run.`,
      metadata: {}
    });
    appendExecutionUpdate(deps, runId, {
      agentId: currentOwner?.id ?? null,
      status: 'done',
      summary: input.summary || `${currentOwner?.title ?? 'Current owner'} marked the work complete.`,
      progress: 1,
      artifactRefs: []
    });
  }

  return deps.getIntentView(intent.id);
}
