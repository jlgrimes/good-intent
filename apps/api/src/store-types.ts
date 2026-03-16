import type { Agent, DelegationRun, DispatchRecord, ExecutionUpdate, Intent, IntentView, RoutingDecision as SharedRoutingDecision } from '@good-intent/shared';
import type { DispatchRefresh } from './runtime-dispatch.js';
import type { createDatabase, delegationRunsTable } from './db';

export type DatabaseHandle = ReturnType<typeof createDatabase>;

export type GoodIntentStoreDeps = {
  database: DatabaseHandle;
  serializeJson: (value: unknown) => string;
  getAllAgents: () => Agent[];
  getIntentById: (intentId: string) => Intent | null;
  getRoutingDecisionByIntentId: (intentId: string) => SharedRoutingDecision | null;
  getRunByIntentId: (intentId: string) => DelegationRun | null;
  getOrdersByRunId: (runId: string) => any[];
  getEventsByRunId: (runId: string) => any[];
  getDispatchRecordsByRunId: (runId: string) => DispatchRecord[];
  getExecutionUpdatesByRunId: (runId: string) => ExecutionUpdate[];
  refreshDispatchRecord: (dispatchRecordId: string) => DispatchRecord | null;
  refreshDispatchRecordsForRun: (runId: string) => DispatchRecord[];
  applyDispatchRefreshToRun: (runId: string, record: DispatchRecord, refresh: DispatchRefresh) => void;
  getAgentById: (agentId: string | null | undefined) => Agent | null;
  getIntentView: (intentId: string) => IntentView | null;
  toDelegationRun: (row: typeof delegationRunsTable.$inferSelect) => DelegationRun;
};
