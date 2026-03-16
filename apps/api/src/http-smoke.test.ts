import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe.sequential('http smoke flow', () => {
  beforeAll(async () => {
    process.env.GOOD_INTENT_RUNTIME_BIN = 'good-intent-runtime-dev';
    process.env.GOOD_INTENT_RUNTIME_REFRESH_MODE = 'completed';
    process.env.GOOD_INTENT_RUNTIME_SPAWN_MODE = 'process';
    process.env.GOOD_INTENT_RUNTIME_PROCESS_COMMAND = 'sleep 0.1';
    process.env.GOOD_INTENT_RUNTIME_BIN = process.execPath;
    const runtimeDispatch = await import('./runtime-dispatch');
    runtimeDispatch.setDefaultRuntimeDispatcher(runtimeDispatch.createCommandRuntimeDispatcher());
  });

  afterAll(async () => {
    delete process.env.GOOD_INTENT_RUNTIME_BIN;
    delete process.env.GOOD_INTENT_RUNTIME_REFRESH_MODE;
    delete process.env.GOOD_INTENT_RUNTIME_SPAWN_MODE;
    delete process.env.GOOD_INTENT_RUNTIME_PROCESS_COMMAND;
    const runtimeDispatch = await import('./runtime-dispatch');
    runtimeDispatch.setDefaultRuntimeDispatcher(null);
  });

  it('submits and auto-routes in one HTTP call with no assignee picker', async () => {
    const dbPath = `/tmp/good-intent-http-smoke-${Date.now()}.db`;
    process.env.GOOD_INTENT_DB_PATH = dbPath;

    const { createApp } = await import('./server');
    const { createIsolatedStore, createStore } = await import('./store');
    const isolated = createIsolatedStore(dbPath);
    isolated.resetDatabase();
    let initCalls = 0;
    const app = createApp({
      store: createStore(isolated.database),
      initialize: () => {
        initCalls += 1;
        isolated.ensureInitialized();
      }
    });

    expect(initCalls).toBe(1);

    const submitResponse = await request(app)
      .post('/intents/submit')
      .send({ text: 'Fix the broken deploy on production' })
      .expect(201);

    expect(submitResponse.body.intent.text).toBe('Fix the broken deploy on production');
    expect(submitResponse.body.intent.status).toBe('routed');
    expect(submitResponse.body.selectedAgent.id).toBe('agent_infra');
    expect(submitResponse.body.decision.routingMode).toBe('direct');
    expect(submitResponse.body.decision.reasoningSummary.toLowerCase()).toContain('infrastructure work');
    expect(submitResponse.body.run.currentAgentId).toBe('agent_infra');
    expect(submitResponse.body.orders).toHaveLength(1);
    expect(submitResponse.body.initialHandoff.order.id).toBe(submitResponse.body.orders[0].id);
    expect(submitResponse.body.initialHandoff.dispatchRecord.id).toBe(submitResponse.body.dispatchRecords[0].id);
    expect(submitResponse.body.initialHandoff.toAgent.id).toBe('agent_infra');
    expect(submitResponse.body.initialHandoff.dispatchRecord.runtime).toBe('command-runtime');
    expect(submitResponse.body.initialHandoff.dispatchRecord.status).toBe('running');
    expect(submitResponse.body.initialHandoff.dispatchRecord.logKey).toContain('worker://');
    expect(submitResponse.body.initialHandoff.dispatchRecord.artifactRefs.some((artifact: { label: string }) => artifact.label === 'Runtime update file')).toBe(true);
    expect(submitResponse.body.events.some((event: { type: string }) => event.type === 'intent.routed')).toBe(true);

    const intentId = submitResponse.body.intent.id as string;

    const bulkRefreshResponse = await request(app)
      .post('/dispatch-records/refresh')
      .send({ runId: submitResponse.body.run.id })
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 25));

    const secondBulkRefreshResponse = await request(app)
      .post('/dispatch-records/refresh')
      .send({ runId: submitResponse.body.run.id })
      .expect(200);

    expect(bulkRefreshResponse.body.summary.requestedCount).toBe(1);
    expect(bulkRefreshResponse.body.summary.refreshedCount).toBe(1);
    expect(bulkRefreshResponse.body.summary.successCount + bulkRefreshResponse.body.summary.errorCount).toBe(1);
    expect(secondBulkRefreshResponse.body.summary.requestedCount).toBe(1);

    const detailResponse = await request(app)
      .get(`/intents/${intentId}`);

    expect(detailResponse.status, JSON.stringify(detailResponse.body)).toBe(200);

    expect(detailResponse.body.intent.id).toBe(intentId);
    expect(detailResponse.body.selectedAgent.id).toBe('agent_infra');
    expect(detailResponse.body.orders).toHaveLength(1);
    expect(detailResponse.body.initialHandoff.order.id).toBe(detailResponse.body.orders[0].id);
    expect(detailResponse.body.initialHandoff.dispatchRecord.id).toBe(detailResponse.body.dispatchRecords[0].id);
    expect(detailResponse.body.initialHandoff.dispatchRecord.receiptId).toBe(detailResponse.body.dispatchRecords[0].receiptId);
    expect(detailResponse.body.events.some((event: { type: string }) => event.type === 'intent.routed')).toBe(true);
    expect(['running', 'done']).toContain(detailResponse.body.executionUpdates[0].status);
    expect(detailResponse.body.executionUpdates.some((update: { artifactRefs?: Array<{ label: string }>; summary: string }) => update.artifactRefs?.some((artifact) => artifact.label === 'Runtime update file' || artifact.label === 'Worker objective' || artifact.label === 'Worker trace file' || artifact.label === 'Worker domain') || update.summary.includes('Worker completed initial handoff artifact'))).toBe(true);
    expect(detailResponse.body.dispatchRecords[0].artifactRefs.some((artifact: { label: string }) => artifact.label === 'Runtime update file')).toBe(true);
    expect(detailResponse.body.events.find((event: { type: string }) => event.type === 'run.dispatched').metadata.dispatchReceipt.receiptId).toContain('receipt_order_');
    const runtimeTransitionEvents = detailResponse.body.events.filter((event: { metadata?: { source?: string } }) => event.metadata?.source === 'dispatch-refresh');
    expect(runtimeTransitionEvents.length).toBeGreaterThanOrEqual(1);
    expect(['running', 'completed']).toContain(runtimeTransitionEvents[0].metadata.nextStatus);
    expect(runtimeTransitionEvents[0].metadata.dispatchRecordId).toBe(detailResponse.body.dispatchRecords[0].id);
    expect(['running', 'completed']).toContain(detailResponse.body.dispatchRecords[0].status);
    expect(detailResponse.body.dispatchRecords[0].launchedAt).toBeTruthy();
    expect(detailResponse.body.dispatchRecords[0].runtime).toBe('command-runtime');
    expect(detailResponse.body.dispatchRecords[0].logKey).toContain('worker://');
    expect(detailResponse.body.dispatchRecords[0].artifactRefs.some((artifact: { label: string }) => artifact.label === 'Runtime update file')).toBe(true);
    expect([null, undefined].includes(detailResponse.body.dispatchRecords[0].processPid) || typeof detailResponse.body.dispatchRecords[0].processPid === 'number').toBe(true);

    const refreshResponse = await request(app)
      .post(`/dispatch-records/${detailResponse.body.dispatchRecords[0].id}/refresh`)
      .expect(200);

    expect(['running', 'completed']).toContain(refreshResponse.body.dispatchRecord.status);

    const dispatchHistoryResponse = await request(app)
      .get('/dispatch-records')
      .query({ intentId, runId: detailResponse.body.run.id, refresh: 'true' })
      .expect(200);

    expect(dispatchHistoryResponse.body.dispatchRecords).toHaveLength(1);
    expect(dispatchHistoryResponse.body.dispatchRecords[0].intentId).toBe(intentId);
    expect(dispatchHistoryResponse.body.dispatchRecords[0].delegationRunId).toBe(detailResponse.body.run.id);
    expect(dispatchHistoryResponse.body.dispatchRecords[0].delegationOrderId).toBe(detailResponse.body.orders[0].id);
    expect(dispatchHistoryResponse.body.dispatchRecords[0].receiptId).toContain(detailResponse.body.orders[0].id);
    expect(['running', 'completed']).toContain(dispatchHistoryResponse.body.dispatchRecords[0].status);

    const contractResponse = await request(app)
      .get('/api/contract')
      .expect(200);

    expect(contractResponse.body.endpoints.some((endpoint: { path: string; method: string }) => endpoint.path === '/dispatch-records' && endpoint.method === 'GET')).toBe(true);
    expect(contractResponse.body.endpoints.some((endpoint: { path: string; method: string }) => endpoint.path === '/dispatch-records/refresh' && endpoint.method === 'POST')).toBe(true);

    const exportResponse = await request(app)
      .get(`/intents/${intentId}/idp-export`)
      .expect(200);

    expect(exportResponse.body.version).toBe('idp.v0');
    expect(exportResponse.body.intent.id).toBe(intentId);
    expect(exportResponse.body.routing_decision.selected_owner.id).toBe('agent_infra');
    expect(exportResponse.body.run.current_owner.id).toBe('agent_infra');
    expect(exportResponse.body.delegation_orders).toHaveLength(1);
    expect(exportResponse.body.delegation_orders[0].dispatch_receipt.process_pid ?? null).toBe(detailResponse.body.dispatchRecords[0].processPid ?? null);
    expect(exportResponse.body.delegation_orders[0].dispatch_receipt.exit_code ?? null).toBe(detailResponse.body.dispatchRecords[0].exitCode ?? null);

    isolated.close();
    delete process.env.GOOD_INTENT_DB_PATH;
  });
});
