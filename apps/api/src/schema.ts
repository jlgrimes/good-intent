import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentsTable = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  title: text('title').notNull(),
  reportsTo: text('reports_to'),
  capabilitiesJson: text('capabilities_json').notNull(),
  status: text('status').notNull()
});

export const intentsTable = sqliteTable('intents', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  urgency: text('urgency').notNull(),
  project: text('project'),
  constraintsJson: text('constraints_json').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull()
});

export const routingDecisionsTable = sqliteTable('routing_decisions', {
  id: text('id').primaryKey(),
  intentId: text('intent_id').notNull(),
  selectedAgentId: text('selected_agent_id'),
  routingMode: text('routing_mode').notNull(),
  confidence: real('confidence').notNull(),
  reasoningSummary: text('reasoning_summary').notNull(),
  candidateSnapshotJson: text('candidate_snapshot_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const delegationRunsTable = sqliteTable('delegation_runs', {
  id: text('id').primaryKey(),
  intentId: text('intent_id').notNull(),
  currentAgentId: text('current_agent_id'),
  status: text('status').notNull(),
  rootRoutingDecisionId: text('root_routing_decision_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});

export const delegationOrdersTable = sqliteTable('delegation_orders', {
  id: text('id').primaryKey(),
  intentId: text('intent_id').notNull(),
  routingDecisionId: text('routing_decision_id'),
  delegationRunId: text('delegation_run_id').notNull(),
  fromAgentId: text('from_agent_id'),
  toAgentId: text('to_agent_id').notNull(),
  objective: text('objective').notNull(),
  successCriteriaJson: text('success_criteria_json').notNull(),
  constraintsJson: text('constraints_json').notNull(),
  priority: text('priority').notNull(),
  issuedAt: text('issued_at').notNull()
});

export const delegationEventsTable = sqliteTable('delegation_events', {
  id: text('id').primaryKey(),
  delegationRunId: text('delegation_run_id').notNull(),
  type: text('type').notNull(),
  fromAgentId: text('from_agent_id'),
  toAgentId: text('to_agent_id'),
  delegationOrderId: text('delegation_order_id'),
  summary: text('summary').notNull(),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull()
});

export const dispatchRecordsTable = sqliteTable('dispatch_records', {
  id: text('id').primaryKey(),
  delegationOrderId: text('delegation_order_id').notNull(),
  delegationRunId: text('delegation_run_id').notNull(),
  intentId: text('intent_id').notNull(),
  toAgentId: text('to_agent_id').notNull(),
  runtime: text('runtime').notNull(),
  channel: text('channel').notNull(),
  status: text('status').notNull(),
  receiptId: text('receipt_id').notNull(),
  summary: text('summary').notNull(),
  command: text('command').notNull(),
  logKey: text('log_key').notNull(),
  artifactRefsJson: text('artifact_refs_json').notNull().default('[]'),
  dispatchedAt: text('dispatched_at').notNull(),
  launchedAt: text('launched_at'),
  endedAt: text('ended_at'),
  processPid: integer('process_pid'),
  exitCode: integer('exit_code'),
  lastError: text('last_error')
});

export const executionUpdatesTable = sqliteTable('execution_updates', {
  id: text('id').primaryKey(),
  delegationRunId: text('delegation_run_id').notNull(),
  dispatchRecordId: text('dispatch_record_id'),
  agentId: text('agent_id'),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  progress: real('progress'),
  blocker: text('blocker'),
  needsInput: text('needs_input'),
  artifactRefsJson: text('artifact_refs_json').notNull().default('[]'),
  createdAt: text('created_at').notNull()
});

export const migrationsTable = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});
