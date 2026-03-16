import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type {
  Agent,
  DelegationActionInput,
  DelegationEvent,
  DelegationRun,
  DispatchRecord,
  Intent,
  IntentInput,
  IntentView,
  RouteIntentResult,
  RoutingDecision as SharedRoutingDecision
} from '@good-intent/shared';
import type { GoodIntentDb } from './db.js';
import { ensureInitialized } from './bootstrap.js';
import { buildIntentIdpExport } from './idp-export.js';
import { dispatchRecordsTable, executionUpdatesTable, delegationEventsTable, delegationRunsTable, intentsTable } from './schema.js';
import {
  getAgentById as queryAgentById,
  getAllAgents as queryAllAgents,
  getDispatchRecordsByRunId as queryDispatchRecordsByRunId,
  getEventsByRunId as queryEventsByRunId,
  listDispatchRecords as queryListDispatchRecords,
  getExecutionUpdatesByRunId as queryExecutionUpdatesByRunId,
  getIntentById as queryIntentById,
  getOrdersByRunId as queryOrdersByRunId,
  getRunByIntentId as queryRunByIntentId,
  getRoutingDecisionByIntentId as queryRoutingDecisionByIntentId,
  listIntents as queryListIntents,
  toDelegationRun,
  toDispatchRecord
} from './queries.js';
import type { GoodIntentStoreDeps } from './store-types.js';
import { applyDelegationActionWrite, routeStoredIntentWrite } from './write-paths.js';
import { buildClarificationPreviewEvent, buildIntentView } from './view-models.js';
import { getDefaultDb } from './db.js';
import { getDefaultRuntimeDispatcher, type DispatchRefresh } from './runtime-dispatch.js';

function resolveDatabase(database?: GoodIntentDb) {
  return database ?? getDefaultDb();
}

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function nowIso() {
  return new Date().toISOString();
}

export function getAllAgents(database = resolveDatabase()): Agent[] {
  ensureInitialized(database);
  return queryAllAgents(database);
}

export function getOrg(database = resolveDatabase()): Agent[] {
  return getAllAgents(database);
}

export function createIntent(input: IntentInput, database = resolveDatabase()): Intent {
  ensureInitialized(database);
  const intent: Intent = {
    id: `intent_${nanoid(10)}`,
    text: input.text.trim(),
    urgency: input.urgency ?? 'normal',
    project: input.project,
    constraints: input.constraints ?? [],
    status: 'pending',
    createdAt: nowIso()
  };

  database.sqlite.prepare(
    `INSERT INTO intents (id, text, urgency, project, constraints_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    intent.id,
    intent.text,
    intent.urgency,
    intent.project ?? null,
    serializeJson(intent.constraints),
    intent.status,
    intent.createdAt
  );

  return intent;
}

export function getIntentById(intentId: string, database = resolveDatabase()): Intent | null {
  ensureInitialized(database);
  return queryIntentById(database, intentId);
}

export function getRoutingDecisionByIntentId(intentId: string, database = resolveDatabase()): SharedRoutingDecision | null {
  return queryRoutingDecisionByIntentId(database, intentId);
}

export function getRunByIntentId(intentId: string, database = resolveDatabase()): DelegationRun | null {
  return queryRunByIntentId(database, intentId);
}

export function getOrdersByRunId(runId: string, database = resolveDatabase()) {
  return queryOrdersByRunId(database, runId);
}

export function getEventsByRunId(runId: string, database = resolveDatabase()): DelegationEvent[] {
  return queryEventsByRunId(database, runId);
}

export function getDispatchRecordsByRunId(runId: string, database = resolveDatabase()) {
  return queryDispatchRecordsByRunId(database, runId);
}

export function listDispatchRecords(
  filters: { intentId?: string; runId?: string; orderId?: string } = {},
  database = resolveDatabase()
) {
  ensureInitialized(database);
  return queryListDispatchRecords(database, filters);
}

export function getExecutionUpdatesByRunId(runId: string, database = resolveDatabase()) {
  return queryExecutionUpdatesByRunId(database, runId);
}

export function getAgentById(agentId: string | null | undefined, database = resolveDatabase()): Agent | null {
  return queryAgentById(database, agentId);
}

function mapDispatchRefreshToExecutionStatus(refresh: DispatchRefresh) {
  return refresh.status === 'completed' ? 'done' : refresh.status === 'error' ? 'blocked' : refresh.status;
}

function upsertRefreshExecutionUpdate(database: GoodIntentDb, record: DispatchRecord, refresh: DispatchRefresh) {
  const status = mapDispatchRefreshToExecutionStatus(refresh);
  const existing = database.db
    .select()
    .from(executionUpdatesTable)
    .where(eq(executionUpdatesTable.dispatchRecordId, record.id))
    .get();

  const artifactRefs = refresh.artifactRefs ?? record.artifactRefs;
  const artifactRefsJson = serializeJson(artifactRefs);
  const blocker = refresh.status === 'error' ? refresh.lastError ?? null : null;
  const explicitProgress = typeof (refresh as DispatchRefresh & { progress?: number }).progress === 'number'
    ? (refresh as DispatchRefresh & { progress?: number }).progress
    : null;
  const progress = explicitProgress ?? (refresh.status === 'completed' ? 1 : refresh.status === 'running' ? 0.25 : refresh.status === 'queued' ? 0 : null);
  const workerArtifact = artifactRefs.find((artifact) => artifact.label === 'Worker artifact');
  const workerState = artifactRefs.find((artifact) => artifact.label === 'Worker state')?.value;
  const workerObjective = artifactRefs.find((artifact) => artifact.label === 'Worker objective')?.value;
  const workerDomain = artifactRefs.find((artifact) => artifact.label === 'Worker domain')?.value;
  const workerSummary = artifactRefs.find((artifact) => artifact.label === 'Worker summary')?.value;
  const summaryParts = [refresh.summary];
  if (workerSummary) {
    summaryParts.push(workerSummary);
  } else if (workerState && workerObjective) {
    summaryParts.push(`${workerState}: ${workerObjective}`);
  }
  if (workerDomain) {
    summaryParts.push(`domain=${workerDomain}`);
  }
  const summary = summaryParts.join(' · ');

  if (existing) {
    database.db
      .update(executionUpdatesTable)
      .set({
        status,
        summary,
        progress,
        blocker,
        artifactRefsJson
      })
      .where(eq(executionUpdatesTable.id, existing.id))
      .run();

    if (workerArtifact && workerState) {
      database.db.insert(executionUpdatesTable).values({
        id: `update_${nanoid(10)}`,
        delegationRunId: record.delegationRunId,
        dispatchRecordId: record.id,
        agentId: record.toAgentId,
        status,
        summary: `Worker artifact ready for ${record.toAgentId}: ${workerSummary ?? workerState ?? 'artifact generated'}.`,
        progress,
        blocker,
        needsInput: null,
        artifactRefsJson,
        createdAt: nowIso()
      }).run();
    }
    return;
  }

  database.db.insert(executionUpdatesTable).values({
    id: `update_${nanoid(10)}`,
    delegationRunId: record.delegationRunId,
    dispatchRecordId: record.id,
    agentId: record.toAgentId,
    status,
    summary,
    progress,
    blocker,
    needsInput: null,
    artifactRefsJson,
    createdAt: nowIso()
  }).run();
}

function appendRuntimeTransitionEvent(database: GoodIntentDb, record: DispatchRecord, refresh: DispatchRefresh) {
  const changed =
    record.status !== refresh.status
    || (record.lastError ?? null) !== (refresh.lastError ?? null)
    || (record.summary ?? '') !== (refresh.summary ?? '')
    || (record.launchedAt ?? null) !== (refresh.launchedAt ?? record.launchedAt ?? null);

  if (!changed) {
    return;
  }

  const type = refresh.status === 'completed'
    ? 'run.completed'
    : refresh.status === 'error'
      ? 'run.blocked'
      : 'run.dispatched';

  const summary = refresh.status === 'completed'
    ? `Runtime completed handoff for ${record.toAgentId}.`
    : refresh.status === 'error'
      ? `Runtime reported an error for ${record.toAgentId}.`
      : `Runtime confirmed active handoff for ${record.toAgentId}.`;

  database.db.insert(delegationEventsTable).values({
    id: `evt_${nanoid(10)}`,
    delegationRunId: record.delegationRunId,
    type,
    fromAgentId: null,
    toAgentId: record.toAgentId,
    delegationOrderId: record.delegationOrderId,
    summary,
    metadataJson: serializeJson({
      dispatchRecordId: record.id,
      previousStatus: record.status,
      nextStatus: refresh.status,
      runtime: record.runtime,
      receiptId: record.receiptId,
      launchedAt: refresh.launchedAt ?? record.launchedAt ?? null,
      endedAt: refresh.endedAt ?? record.endedAt ?? null,
      processPid: refresh.processPid ?? record.processPid ?? null,
      exitCode: refresh.exitCode ?? record.exitCode ?? null,
      lastError: refresh.lastError ?? null,
      source: 'dispatch-refresh'
    }),
    createdAt: nowIso()
  }).run();
}

function syncRunAndIntentStatus(database: GoodIntentDb, runId: string, intentId: string, record: DispatchRecord, refresh: DispatchRefresh) {
  const currentRun = database.db.select().from(delegationRunsTable).where(eq(delegationRunsTable.id, runId)).get();
  if (!currentRun || currentRun.currentAgentId !== record.toAgentId) {
    return;
  }

  const runStatus = refresh.status === 'completed' ? 'done' : refresh.status === 'error' ? 'blocked' : currentRun.status === 'blocked' ? 'blocked' : refresh.status;
  const intentStatus = refresh.status === 'completed' ? 'done' : refresh.status === 'error' ? 'blocked' : currentRun.status === 'blocked' ? 'blocked' : 'running';

  database.db
    .update(delegationRunsTable)
    .set({ status: runStatus, updatedAt: nowIso() })
    .where(eq(delegationRunsTable.id, runId))
    .run();

  database.db
    .update(intentsTable)
    .set({ status: intentStatus })
    .where(eq(intentsTable.id, intentId))
    .run();
}

export function applyDispatchRefreshToRun(runId: string, record: DispatchRecord, refresh: DispatchRefresh, database = resolveDatabase()) {
  appendRuntimeTransitionEvent(database, record, refresh);

  database.db
    .update(dispatchRecordsTable)
    .set({
      status: refresh.status,
      summary: refresh.summary,
      launchedAt: refresh.launchedAt ?? record.launchedAt ?? null,
      lastError: refresh.lastError ?? null,
      artifactRefsJson: serializeJson(refresh.artifactRefs ?? record.artifactRefs)
    })
    .where(eq(dispatchRecordsTable.id, record.id))
    .run();

  upsertRefreshExecutionUpdate(database, record, refresh);
  syncRunAndIntentStatus(database, runId, record.intentId, record, refresh);
}

export function refreshDispatchRecord(dispatchRecordId: string, database = resolveDatabase()): DispatchRecord | null {
  ensureInitialized(database);
  const row = database.db.select().from(dispatchRecordsTable).where(eq(dispatchRecordsTable.id, dispatchRecordId)).get();
  if (!row) return null;

  const record = toDispatchRecord(row);
  const refresh = getDefaultRuntimeDispatcher().refresh?.(record);
  if (!refresh) {
    return record;
  }

  applyDispatchRefreshToRun(record.delegationRunId, record, refresh, database);

  const updatedRow = database.db.select().from(dispatchRecordsTable).where(eq(dispatchRecordsTable.id, dispatchRecordId)).get();
  return updatedRow ? toDispatchRecord(updatedRow) : null;
}

export function refreshDispatchRecordsForRun(runId: string, database = resolveDatabase()): DispatchRecord[] {
  ensureInitialized(database);
  const records = getDispatchRecordsByRunId(runId, database);
  return records.map((record) => refreshDispatchRecord(record.id, database) ?? record);
}

export function listIntentViews(database = resolveDatabase()): IntentView[] {
  ensureInitialized(database);
  const intents = queryListIntents(database);
  return intents.map((intent: Intent) => buildIntentView(intent, {}, {
    getAllAgents: () => getAllAgents(database),
    getRoutingDecisionByIntentId: (intentId) => getRoutingDecisionByIntentId(intentId, database),
    getRunByIntentId: (intentId) => getRunByIntentId(intentId, database),
    getOrdersByRunId: (runId) => getOrdersByRunId(runId, database),
    getDispatchRecordsByRunId: (runId) => getDispatchRecordsByRunId(runId, database),
    getExecutionUpdatesByRunId: (runId) => getExecutionUpdatesByRunId(runId, database),
    getEventsByRunId: (runId) => getEventsByRunId(runId, database),
    getAgentById: (agentId) => getAgentById(agentId, database)
  }));
}

export function getIntentView(intentId: string, database = resolveDatabase()): IntentView | null {
  const intent = getIntentById(intentId, database);
  if (!intent) return null;
  const decision = getRoutingDecisionByIntentId(intentId, database);
  const run = getRunByIntentId(intentId, database);
  return buildIntentView(intent, {
    previewEvents: run ? undefined : buildClarificationPreviewEvent(intentId, decision),
    hideClarifyCandidates: true
  }, {
    getAllAgents: () => getAllAgents(database),
    getRoutingDecisionByIntentId: (lookupIntentId) => getRoutingDecisionByIntentId(lookupIntentId, database),
    getRunByIntentId: (lookupIntentId) => getRunByIntentId(lookupIntentId, database),
    getOrdersByRunId: (runId) => getOrdersByRunId(runId, database),
    getDispatchRecordsByRunId: (runId) => getDispatchRecordsByRunId(runId, database),
    getExecutionUpdatesByRunId: (runId) => getExecutionUpdatesByRunId(runId, database),
    getEventsByRunId: (runId) => getEventsByRunId(runId, database),
    getAgentById: (agentId) => getAgentById(agentId, database)
  });
}

function createStoreDeps(database = resolveDatabase()): GoodIntentStoreDeps {
  return {
    database,
    serializeJson,
    getAllAgents: () => getAllAgents(database),
    getIntentById: (intentId) => getIntentById(intentId, database),
    getRoutingDecisionByIntentId: (intentId) => getRoutingDecisionByIntentId(intentId, database),
    getRunByIntentId: (intentId) => getRunByIntentId(intentId, database),
    getOrdersByRunId: (runId) => getOrdersByRunId(runId, database),
    getDispatchRecordsByRunId: (runId) => getDispatchRecordsByRunId(runId, database),
    getEventsByRunId: (runId) => getEventsByRunId(runId, database),
    getExecutionUpdatesByRunId: (runId) => getExecutionUpdatesByRunId(runId, database),
    refreshDispatchRecord: (dispatchRecordId) => refreshDispatchRecord(dispatchRecordId, database),
    refreshDispatchRecordsForRun: (runId) => refreshDispatchRecordsForRun(runId, database),
    applyDispatchRefreshToRun: (runId, record, refresh) => applyDispatchRefreshToRun(runId, record, refresh, database),
    getAgentById: (agentId) => getAgentById(agentId, database),
    getIntentView: (intentId) => getIntentView(intentId, database),
    toDelegationRun
  };
}

export function routeStoredIntent(intentId: string, database = resolveDatabase()): RouteIntentResult | null {
  return routeStoredIntentWrite(createStoreDeps(database), intentId);
}

export function applyDelegationAction(runId: string, input: DelegationActionInput, database = resolveDatabase()): IntentView | { error: string } | null {
  return applyDelegationActionWrite(createStoreDeps(database), runId, input);
}

export function getIntentIdpExport(intentId: string, database = resolveDatabase()) {
  const view = getIntentView(intentId, database);
  if (!view) return null;
  return buildIntentIdpExport({
    ...view,
    agents: getAllAgents(database)
  });
}
