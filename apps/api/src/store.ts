import type {
  Agent,
  BulkDispatchRefreshResult,
  DelegationActionInput,
  DispatchRecord,
  DispatchRecordHistory,
  Intent,
  IntentInput,
  IntentView,
  RouteIntentResult
} from '@good-intent/shared';
import type { GoodIntentDb } from './db.js';
import { getDefaultDb } from './db.js';
import { buildIntentIdpExport } from './idp-export.js';
import { ensureInitialized, resetDatabase } from './bootstrap.js';
import { createIsolatedStoreRuntime, getDbStatus } from './runtime-store.js';
import {
  applyDelegationAction,
  createIntent,
  getIntentIdpExport,
  getIntentView,
  getOrg,
  listDispatchRecords as readPathListDispatchRecords,
  listIntentViews,
  refreshDispatchRecord,
  refreshDispatchRecordsForRun,
  routeStoredIntent
} from './read-paths.js';

export type GoodIntentStore = {
  ensureInitialized: () => void;
  getOrg: () => Agent[];
  createIntent: (input: IntentInput) => Intent;
  listIntentViews: () => IntentView[];
  getIntentView: (intentId: string) => IntentView | null;
  routeStoredIntent: (intentId: string) => RouteIntentResult | null;
  applyDelegationAction: (runId: string, input: DelegationActionInput) => IntentView | { error: string } | null;
  getIntentIdpExport: (intentId: string) => ReturnType<typeof buildIntentIdpExport> | null;
  listDispatchRecords: (filters?: { intentId?: string; runId?: string; orderId?: string }) => DispatchRecordHistory;
  refreshDispatchRecord: (dispatchRecordId: string) => DispatchRecord | null;
  refreshDispatchRecordsForRun: (runId: string) => DispatchRecord[];
  refreshDispatchRecords: (filters: { intentId?: string; runId?: string; orderId?: string }) => BulkDispatchRefreshResult;
  getDbStatus: () => ReturnType<typeof getDbStatus>;
};

export const createIsolatedStore = createIsolatedStoreRuntime;

export { ensureInitialized, resetDatabase } from './bootstrap.js';
export { applyDelegationAction, createIntent, getIntentIdpExport, getIntentView, getOrg, listIntentViews, routeStoredIntent } from './read-paths.js';
export { getDbStatus } from './runtime-store.js';

export function listDispatchRecords(filters?: { intentId?: string; runId?: string; orderId?: string }, database = resolveDatabase()): DispatchRecordHistory {
  return { dispatchRecords: readPathListDispatchRecords(filters, database) };
}

export function refreshDispatchRecords(
  filters: { intentId?: string; runId?: string; orderId?: string },
  database = resolveDatabase()
): BulkDispatchRefreshResult {
  const matched = readPathListDispatchRecords(filters, database);
  const dispatchRecords = matched.map((record) => refreshDispatchRecord(record.id, database) ?? record);

  const statuses = dispatchRecords.reduce<Partial<Record<DispatchRecord['status'], number>>>((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    return counts;
  }, {});

  const errorCount = dispatchRecords.filter((record) => record.status === 'error').length;
  const summary = {
    requestedCount: matched.length,
    refreshedCount: dispatchRecords.length,
    successCount: dispatchRecords.length - errorCount,
    errorCount,
    unchangedCount: 0,
    statuses
  };

  return { dispatchRecords, summary };
}

function resolveDatabase(database?: GoodIntentDb) {
  return database ?? getDefaultDb();
}

export function createStore(database = resolveDatabase()): GoodIntentStore {
  return {
    ensureInitialized: () => ensureInitialized(database),
    getOrg: () => getOrg(database),
    createIntent: (input) => createIntent(input, database),
    listIntentViews: () => listIntentViews(database),
    getIntentView: (intentId) => getIntentView(intentId, database),
    routeStoredIntent: (intentId) => routeStoredIntent(intentId, database),
    applyDelegationAction: (runId, input) => applyDelegationAction(runId, input, database),
    getIntentIdpExport: (intentId) => getIntentIdpExport(intentId, database),
    listDispatchRecords: (filters) => listDispatchRecords(filters, database),
    refreshDispatchRecord: (dispatchRecordId) => refreshDispatchRecord(dispatchRecordId, database),
    refreshDispatchRecordsForRun: (runId) => refreshDispatchRecordsForRun(runId, database),
    refreshDispatchRecords: (filters) => refreshDispatchRecords(filters, database),
    getDbStatus: () => getDbStatus(database)
  };
}
