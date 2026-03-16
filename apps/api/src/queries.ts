import { desc, eq } from 'drizzle-orm';
import type { Agent, ArtifactRef, DelegationEvent, DelegationOrder, DelegationRun, DispatchRecord, ExecutionUpdate, Intent, RoutingDecision as SharedRoutingDecision } from '@good-intent/shared';
import { agentsTable, delegationEventsTable, delegationOrdersTable, delegationRunsTable, executionUpdatesTable, intentsTable, routingDecisionsTable } from './db';
import { dispatchRecordsTable } from './schema.js';
import type { DatabaseHandle } from './store-types.js';

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function toAgent(row: typeof agentsTable.$inferSelect): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    title: row.title,
    reportsTo: row.reportsTo,
    capabilities: parseJson<string[]>(row.capabilitiesJson),
    status: row.status as Agent['status']
  };
}

export function toIntent(row: typeof intentsTable.$inferSelect): Intent {
  return {
    id: row.id,
    text: row.text,
    urgency: row.urgency as Intent['urgency'],
    project: row.project ?? undefined,
    constraints: parseJson<string[]>(row.constraintsJson),
    status: row.status as Intent['status'],
    createdAt: row.createdAt
  };
}

export function toRoutingDecision(row: typeof routingDecisionsTable.$inferSelect): SharedRoutingDecision {
  return {
    id: row.id,
    intentId: row.intentId,
    selectedAgentId: row.selectedAgentId,
    routingMode: row.routingMode as SharedRoutingDecision['routingMode'],
    confidence: row.confidence,
    reasoningSummary: row.reasoningSummary,
    candidateSnapshot: parseJson(row.candidateSnapshotJson),
    createdAt: row.createdAt
  };
}

export function toDelegationRun(row: typeof delegationRunsTable.$inferSelect): DelegationRun {
  return {
    id: row.id,
    intentId: row.intentId,
    currentAgentId: row.currentAgentId,
    status: row.status as DelegationRun['status'],
    rootRoutingDecisionId: row.rootRoutingDecisionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toDelegationOrder(row: typeof delegationOrdersTable.$inferSelect): DelegationOrder {
  return {
    id: row.id,
    intentId: row.intentId,
    routingDecisionId: row.routingDecisionId,
    delegationRunId: row.delegationRunId,
    fromAgentId: row.fromAgentId,
    toAgentId: row.toAgentId,
    objective: row.objective,
    successCriteria: parseJson<string[]>(row.successCriteriaJson),
    constraints: parseJson<string[]>(row.constraintsJson),
    priority: row.priority as DelegationOrder['priority'],
    issuedAt: row.issuedAt
  };
}

export function toDelegationEvent(row: typeof delegationEventsTable.$inferSelect): DelegationEvent {
  return {
    id: row.id,
    delegationRunId: row.delegationRunId,
    type: row.type as DelegationEvent['type'],
    fromAgentId: row.fromAgentId,
    toAgentId: row.toAgentId,
    delegationOrderId: row.delegationOrderId,
    summary: row.summary,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson),
    createdAt: row.createdAt
  };
}

export function toDispatchRecord(row: typeof dispatchRecordsTable.$inferSelect): DispatchRecord {
  return {
    id: row.id,
    delegationOrderId: row.delegationOrderId,
    delegationRunId: row.delegationRunId,
    intentId: row.intentId,
    toAgentId: row.toAgentId,
    runtime: row.runtime as DispatchRecord['runtime'],
    channel: row.channel,
    status: row.status as DispatchRecord['status'],
    receiptId: row.receiptId,
    summary: row.summary,
    command: row.command,
    logKey: row.logKey,
    artifactRefs: parseJson<ArtifactRef[]>(row.artifactRefsJson),
    dispatchedAt: row.dispatchedAt,
    launchedAt: row.launchedAt,
    endedAt: row.endedAt,
    processPid: row.processPid,
    exitCode: row.exitCode,
    lastError: row.lastError
  };
}

export function toExecutionUpdate(row: typeof executionUpdatesTable.$inferSelect): ExecutionUpdate {
  return {
    id: row.id,
    delegationRunId: row.delegationRunId,
    dispatchRecordId: row.dispatchRecordId,
    agentId: row.agentId,
    status: row.status as ExecutionUpdate['status'],
    summary: row.summary,
    progress: row.progress,
    blocker: row.blocker,
    needsInput: row.needsInput,
    artifactRefs: parseJson<ArtifactRef[]>(row.artifactRefsJson),
    createdAt: row.createdAt
  };
}

export function getAllAgents(database: DatabaseHandle): Agent[] {
  return database.db.select().from(agentsTable).all().map(toAgent);
}

export function getIntentById(database: DatabaseHandle, intentId: string): Intent | null {
  const row = database.db.select().from(intentsTable).where(eq(intentsTable.id, intentId)).get();
  return row ? toIntent(row) : null;
}

export function getRoutingDecisionByIntentId(database: DatabaseHandle, intentId: string): SharedRoutingDecision | null {
  const row = database.db.select().from(routingDecisionsTable).where(eq(routingDecisionsTable.intentId, intentId)).get();
  return row ? toRoutingDecision(row) : null;
}

export function getRunByIntentId(database: DatabaseHandle, intentId: string): DelegationRun | null {
  const row = database.db.select().from(delegationRunsTable).where(eq(delegationRunsTable.intentId, intentId)).get();
  return row ? toDelegationRun(row) : null;
}

export function listIntents(database: DatabaseHandle): Intent[] {
  return database.db
    .select()
    .from(intentsTable)
    .orderBy(desc(intentsTable.createdAt))
    .all()
    .map(toIntent);
}

export function getOrdersByRunId(database: DatabaseHandle, runId: string): DelegationOrder[] {
  return database.db.select().from(delegationOrdersTable).where(eq(delegationOrdersTable.delegationRunId, runId)).all().map(toDelegationOrder);
}

export function getAllEvents(database: DatabaseHandle): DelegationEvent[] {
  return database.db.select().from(delegationEventsTable).all().map(toDelegationEvent);
}

export function getEventsByRunId(database: DatabaseHandle, runId: string): DelegationEvent[] {
  return database.db.select().from(delegationEventsTable).where(eq(delegationEventsTable.delegationRunId, runId)).all().map(toDelegationEvent);
}

export function getDispatchRecordsByRunId(database: DatabaseHandle, runId: string): DispatchRecord[] {
  return database.db.select().from(dispatchRecordsTable).where(eq(dispatchRecordsTable.delegationRunId, runId)).all().map(toDispatchRecord);
}

export function listDispatchRecords(database: DatabaseHandle, filters?: { intentId?: string; runId?: string; orderId?: string }): DispatchRecord[] {
  const rows = database.db.select().from(dispatchRecordsTable).orderBy(desc(dispatchRecordsTable.dispatchedAt)).all();
  return rows
    .map(toDispatchRecord)
    .filter((record) => {
      if (filters?.intentId && record.intentId !== filters.intentId) return false;
      if (filters?.runId && record.delegationRunId !== filters.runId) return false;
      if (filters?.orderId && record.delegationOrderId !== filters.orderId) return false;
      return true;
    });
}

export function getExecutionUpdatesByRunId(database: DatabaseHandle, runId: string): ExecutionUpdate[] {
  return database.db.select().from(executionUpdatesTable).where(eq(executionUpdatesTable.delegationRunId, runId)).all().map(toExecutionUpdate);
}

export function getAgentById(database: DatabaseHandle, agentId: string | null | undefined): Agent | null {
  if (!agentId) return null;
  const row = database.db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).get();
  return row ? toAgent(row) : null;
}
