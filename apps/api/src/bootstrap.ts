import fs from 'node:fs';
import path from 'node:path';
import seedAgents from '../../../data/seed-org.json' with { type: 'json' };
import type { Agent, DelegationEvent, DelegationRun, Intent, RoutingDecision as SharedRoutingDecision } from '@good-intent/shared';
import { agentsTable, createDatabase, delegationEventsTable, delegationRunsTable, getDefaultDb, intentsTable, routingDecisionsTable } from './db';
import type { DatabaseHandle } from './store-types.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const LEGACY_STATE_FILE = path.join(REPO_ROOT, 'data/state.json');

function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function rowCount(tableName: string, database = resolveDatabase()) {
  const result = database.sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
  return result.count;
}

function resolveDatabase(database?: DatabaseHandle) {
  return database ?? getDefaultDb();
}

export function migrateSchema(database = resolveDatabase()) {
  const { sqlite } = database;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      reports_to TEXT,
      capabilities_json TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intents (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      urgency TEXT NOT NULL,
      project TEXT,
      constraints_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routing_decisions (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      selected_agent_id TEXT,
      routing_mode TEXT NOT NULL,
      confidence REAL NOT NULL,
      reasoning_summary TEXT NOT NULL,
      candidate_snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegation_runs (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      current_agent_id TEXT,
      status TEXT NOT NULL,
      root_routing_decision_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegation_orders (
      id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      routing_decision_id TEXT,
      delegation_run_id TEXT NOT NULL,
      from_agent_id TEXT,
      to_agent_id TEXT NOT NULL,
      objective TEXT NOT NULL,
      success_criteria_json TEXT NOT NULL,
      constraints_json TEXT NOT NULL,
      priority TEXT NOT NULL,
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegation_events (
      id TEXT PRIMARY KEY,
      delegation_run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_agent_id TEXT,
      to_agent_id TEXT,
      delegation_order_id TEXT,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dispatch_records (
      id TEXT PRIMARY KEY,
      delegation_order_id TEXT NOT NULL,
      delegation_run_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      to_agent_id TEXT NOT NULL,
      runtime TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      command TEXT NOT NULL,
      log_key TEXT NOT NULL,
      artifact_refs_json TEXT NOT NULL DEFAULT '[]',
      dispatched_at TEXT NOT NULL,
      launched_at TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS execution_updates (
      id TEXT PRIMARY KEY,
      delegation_run_id TEXT NOT NULL,
      dispatch_record_id TEXT,
      agent_id TEXT,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      progress REAL,
      blocker TEXT,
      needs_input TEXT,
      artifact_refs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);

  const executionUpdateColumns = sqlite.prepare("PRAGMA table_info('execution_updates')").all() as Array<{ name: string }>;
  const hasNeedsInput = executionUpdateColumns.some((column) => column.name === 'needs_input');
  if (!hasNeedsInput) {
    sqlite.exec("ALTER TABLE execution_updates ADD COLUMN needs_input TEXT;");
  }

  const hasArtifactRefs = executionUpdateColumns.some((column) => column.name === 'artifact_refs_json');
  if (!hasArtifactRefs) {
    sqlite.exec("ALTER TABLE execution_updates ADD COLUMN artifact_refs_json TEXT NOT NULL DEFAULT '[]';");
  }

  const hasDispatchRecordId = executionUpdateColumns.some((column) => column.name === 'dispatch_record_id');
  if (!hasDispatchRecordId) {
    sqlite.exec("ALTER TABLE execution_updates ADD COLUMN dispatch_record_id TEXT;");
  }

  const dispatchRecordColumns = sqlite.prepare("PRAGMA table_info('dispatch_records')").all() as Array<{ name: string }>;
  const hasLaunchedAt = dispatchRecordColumns.some((column) => column.name === 'launched_at');
  if (!hasLaunchedAt) {
    sqlite.exec("ALTER TABLE dispatch_records ADD COLUMN launched_at TEXT;");
  }

  const hasEndedAt = dispatchRecordColumns.some((column) => column.name === 'ended_at');
  if (!hasEndedAt) {
    sqlite.exec("ALTER TABLE dispatch_records ADD COLUMN ended_at TEXT;");
  }

  const hasProcessPid = dispatchRecordColumns.some((column) => column.name === 'process_pid');
  if (!hasProcessPid) {
    sqlite.exec("ALTER TABLE dispatch_records ADD COLUMN process_pid INTEGER;");
  }

  const hasExitCode = dispatchRecordColumns.some((column) => column.name === 'exit_code');
  if (!hasExitCode) {
    sqlite.exec("ALTER TABLE dispatch_records ADD COLUMN exit_code INTEGER;");
  }

  const hasLastError = dispatchRecordColumns.some((column) => column.name === 'last_error');
  if (!hasLastError) {
    sqlite.exec("ALTER TABLE dispatch_records ADD COLUMN last_error TEXT;");
  }

  const delegationEventColumns = sqlite.prepare("PRAGMA table_info('delegation_events')").all() as Array<{ name: string }>;
  const hasDelegationOrderId = delegationEventColumns.some((column) => column.name === 'delegation_order_id');
  if (!hasDelegationOrderId) {
    sqlite.exec("ALTER TABLE delegation_events ADD COLUMN delegation_order_id TEXT;");
  }
}

export function seedOrgIfNeeded(database = resolveDatabase()) {
  const existingAgentIds = new Set(
    database.db.select({ id: agentsTable.id }).from(agentsTable).all().map((row) => row.id)
  );
  const missingAgents = (seedAgents as Agent[]).filter((agent) => !existingAgentIds.has(agent.id));
  if (missingAgents.length === 0) return;

  database.db.insert(agentsTable).values(
    missingAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      reportsTo: agent.reportsTo,
      capabilitiesJson: serializeJson(agent.capabilities),
      status: agent.status
    }))
  ).run();
}

export function importLegacyStateIfNeeded(database = resolveDatabase()) {
  if (process.env.NODE_ENV === 'test' || rowCount('intents', database) > 0 || !fs.existsSync(LEGACY_STATE_FILE)) return;

  const legacy = parseJson<{
    intents: Intent[];
    routingDecisions: SharedRoutingDecision[];
    delegationRuns: DelegationRun[];
    delegationEvents: DelegationEvent[];
  }>(fs.readFileSync(LEGACY_STATE_FILE, 'utf8'));

  if (legacy.intents.length > 0) {
    database.db.insert(intentsTable).values(legacy.intents.map((intent) => ({
      id: intent.id,
      text: intent.text,
      urgency: intent.urgency ?? 'normal',
      project: intent.project ?? null,
      constraintsJson: serializeJson(intent.constraints ?? []),
      status: intent.status,
      createdAt: intent.createdAt
    }))).run();
  }

  if (legacy.routingDecisions.length > 0) {
    database.db.insert(routingDecisionsTable).values(legacy.routingDecisions.map((decision) => ({
      id: decision.id,
      intentId: decision.intentId,
      selectedAgentId: decision.selectedAgentId,
      routingMode: decision.routingMode,
      confidence: decision.confidence,
      reasoningSummary: decision.reasoningSummary,
      candidateSnapshotJson: serializeJson(decision.candidateSnapshot),
      createdAt: decision.createdAt
    }))).run();
  }

  if (legacy.delegationRuns.length > 0) {
    database.db.insert(delegationRunsTable).values(legacy.delegationRuns.map((run) => ({
      id: run.id,
      intentId: run.intentId,
      currentAgentId: run.currentAgentId,
      status: run.status,
      rootRoutingDecisionId: run.rootRoutingDecisionId,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt
    }))).run();
  }

  if (legacy.delegationEvents.length > 0) {
    database.db.insert(delegationEventsTable).values(legacy.delegationEvents.map((event) => ({
      id: event.id,
      delegationRunId: event.delegationRunId,
      type: event.type,
      fromAgentId: event.fromAgentId ?? null,
      toAgentId: event.toAgentId ?? null,
      delegationOrderId: event.delegationOrderId ?? null,
      summary: event.summary,
      metadataJson: serializeJson(event.metadata),
      createdAt: event.createdAt
    }))).run();
  }
}

export function ensureInitialized(database = resolveDatabase()) {
  migrateSchema(database);
  seedOrgIfNeeded(database);
  importLegacyStateIfNeeded(database);
}

export function resetDatabase(database = resolveDatabase()) {
  database.sqlite.exec(`
    DROP TABLE IF EXISTS execution_updates;
    DROP TABLE IF EXISTS dispatch_records;
    DROP TABLE IF EXISTS delegation_events;
    DROP TABLE IF EXISTS delegation_orders;
    DROP TABLE IF EXISTS delegation_runs;
    DROP TABLE IF EXISTS routing_decisions;
    DROP TABLE IF EXISTS intents;
    DROP TABLE IF EXISTS agents;
  `);
}

