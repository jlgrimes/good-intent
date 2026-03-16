import { createDatabase, getDbFilePath, getDefaultDb } from './db.js';
import { ensureInitialized, resetDatabase, rowCount } from './bootstrap.js';
import { getAllEvents } from './queries.js';
import type { DatabaseHandle } from './store-types.js';

function resolveDatabase(database?: DatabaseHandle) {
  return database ?? getDefaultDb();
}

export function createIsolatedStoreRuntime(dbFilePath = getDbFilePath()) {
  const database = createDatabase(dbFilePath);
  return {
    database,
    ensureInitialized: () => ensureInitialized(database),
    resetDatabase: () => resetDatabase(database),
    getDbStatus: () => getDbStatus(database),
    close: () => database.sqlite.close()
  };
}

export function getDbStatus(database = resolveDatabase()) {
  return {
    path: database.dbFilePath,
    counts: {
      agents: rowCount('agents', database),
      intents: rowCount('intents', database),
      routingDecisions: rowCount('routing_decisions', database),
      delegationRuns: rowCount('delegation_runs', database),
      delegationOrders: rowCount('delegation_orders', database),
      delegationEvents: rowCount('delegation_events', database),
      executionUpdates: rowCount('execution_updates', database)
    },
    delegationEvents: getAllEvents(database)
  };
}
