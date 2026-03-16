import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildIdpSchemaManifest } from './idp-schema';
import { listIdpExamples } from './idp-examples';
import { buildApiContractManifest } from './api-contract';
import { applyDelegationAction, createIntent, ensureInitialized, getDbStatus, getIntentIdpExport, getIntentView, listDispatchRecords, listIntentViews, refreshDispatchRecords, resetDatabase, routeStoredIntent } from './store';

describe('api store vertical slice', () => {
  beforeEach(() => {
    resetDatabase();
    ensureInitialized();
  });

  it('creates, routes, and exposes a trace skeleton', () => {
    const intent = createIntent({ text: 'Fix the OAuth callback bug in the app' });
    const routed = routeStoredIntent(intent.id);
    expect(routed).not.toBeNull();
    expect(routed?.selectedAgent?.id).toBe('agent_product_eng');
    expect(routed?.events.length).toBeGreaterThan(0);

    const view = getIntentView(intent.id);
    expect(view?.decision?.selectedAgentId).toBe('agent_product_eng');
    expect(view?.orders.length).toBe(1);
    expect(view?.orders[0]?.toAgentId).toBe('agent_product_eng');
    expect(view?.dispatchRecords.length).toBe(1);
    expect(view?.dispatchRecords[0]?.delegationOrderId).toBe(view?.orders[0]?.id);
    expect(view?.dispatchRecords[0]?.receiptId).toContain(view?.orders[0]?.id ?? '');
    expect(view?.dispatchRecords[0]?.status).toBe('running');
    expect(view?.dispatchRecords[0]?.logKey).toContain('://');
    expect(view?.dispatchRecords[0]?.launchedAt).toBeTruthy();
    expect([null, undefined].includes(view?.dispatchRecords[0]?.processPid as null | undefined) || typeof view?.dispatchRecords[0]?.processPid === 'number').toBe(true);
    expect([null, undefined].includes(view?.dispatchRecords[0]?.exitCode as null | undefined) || typeof view?.dispatchRecords[0]?.exitCode === 'number').toBe(true);
    expect(view?.initialHandoff?.order.id).toBe(view?.orders[0]?.id);
    expect(view?.initialHandoff?.dispatchRecord?.id).toBe(view?.dispatchRecords[0]?.id);
    expect(view?.initialHandoff?.toAgent?.id).toBe('agent_product_eng');
    expect(view?.runtimeSummary?.latestStatus).toBe('running');
    expect(view?.runtimeSummary?.statusLabel).toBe('Runtime active');
    expect(view?.runtimeSummary?.latestReceiptId).toBe(view?.dispatchRecords[0]?.receiptId);
    expect(view?.events.length).toBeGreaterThan(0);
    expect(view?.events[0]?.delegationOrderId).toBe(view?.orders[0]?.id);
    expect(view?.executionUpdates.length).toBe(1);
    expect(view?.executionUpdates[0]?.status).toBe('running');
    expect(view?.executionUpdates[0]?.dispatchRecordId).toBe(view?.dispatchRecords[0]?.id);
    expect(view?.executionUpdates[0]?.artifactRefs?.some((artifact) => artifact.label === 'Dispatch receipt')).toBe(true);
    expect(view?.events[1]?.metadata?.dispatchReceipt).toBeTruthy();

    const refreshedRecords = refreshDispatchRecords({ runId: view?.run?.id }).dispatchRecords;
    expect(refreshedRecords).toHaveLength(1);
  });

  it('lists recent intents with persisted routing summaries', () => {
    const intent = createIntent({ text: 'Rewrite the homepage hero copy so the value prop is clearer' });
    routeStoredIntent(intent.id);

    const intents = listIntentViews();
    const listed = intents.find((entry) => entry.intent.id === intent.id);
    expect(listed).toBeTruthy();
    expect(listed?.selectedAgent?.id).toBe('agent_designer');
    expect(listed?.decision?.reasoningSummary.length).toBeGreaterThan(10);
    expect(listed?.routingCandidates.length).toBeGreaterThan(0);
    expect(listed?.routingCandidates[0]?.reasons.length).toBeGreaterThan(0);
    expect(listed?.modeDisplay?.mode).toBe('direct');
    expect(listed?.modeDisplay?.badgeLabel).toContain('Direct');
    expect(listed?.inboxBadges?.map((badge) => badge.label)).toContain('Direct specialist route');
    expect(listed?.inboxBadges?.map((badge) => badge.label)).toContain('Run queued');
    expect(listed?.inboxBadges?.map((badge) => badge.label)).toContain('Runtime active');
    expect(listed?.inboxRoutingSummary?.label).toContain('won directly');
    expect(listed?.inboxRoutingSummary?.detail).toContain('alternatives considered');
    expect(listed?.inboxRoutingSummary?.tone).toBe('direct');
    expect(listed?.inboxRoutingSummary?.ownerLabel).toBe('Designer');
    expect(listed?.inboxRoutingSummary?.supportLabel).toMatch(/over|top specialist signal/);
    expect(listed?.inboxRoutingSummary?.stateLabel).toBe('Queued now');
    expect(listed?.inboxRoutingSummary?.actionabilityLabel).toBe('Ready to start');
  });

  it('preserves clarification events for underspecified asks', () => {
    const intent = createIntent({ text: 'Handle that weird thing from earlier' });
    routeStoredIntent(intent.id);

    const view = getIntentView(intent.id);
    expect(view?.selectedAgent).toBeNull();
    expect(view?.events[0]?.type).toBe('intent.clarification_requested');
    expect(view?.routingCandidates).toEqual([]);
    expect(view?.modeDisplay?.mode).toBe('clarify');
    expect(view?.modeDisplay?.hint.toLowerCase()).toContain('fake assignment');
    expect(view?.initialHandoff).toBeUndefined();
    expect(view?.inboxBadges?.map((badge) => badge.label)).toContain('Clarification required');
    expect(view?.inboxBadges?.map((badge) => badge.label)).toContain('Needs detail');
    expect(view?.inboxRoutingSummary?.label).toContain('Needs detail');
    expect(view?.inboxRoutingSummary?.tone).toBe('clarify');
    expect(view?.inboxRoutingSummary?.ownerLabel).toBe('No owner selected');
    expect(view?.inboxRoutingSummary?.supportLabel).toBe('Clarification required');
    expect(view?.inboxRoutingSummary?.stateLabel).toBe('Awaiting detail');
    expect(view?.inboxRoutingSummary?.actionabilityLabel).toBe('Needs more context');
  });

  it('persists data in sqlite-backed views across list and detail APIs', () => {
    const intent = createIntent({ text: 'Fix the broken deploy on production' });
    const routed = routeStoredIntent(intent.id);

    const fromList = listIntentViews().find((entry) => entry.intent.id === intent.id);
    const fromDetail = getIntentView(intent.id);

    expect(routed?.selectedAgent?.id).toBe('agent_infra');
    expect(fromList?.decision?.selectedAgentId).toBe('agent_infra');
    expect(fromDetail?.run?.currentAgentId).toBe('agent_infra');
    expect(fromDetail?.orders.length).toBe(1);
    expect(fromDetail?.orders[0]?.toAgentId).toBe('agent_infra');
    expect(fromDetail?.dispatchRecords.length).toBe(1);
    expect(fromDetail?.dispatchRecords[0]?.toAgentId).toBe('agent_infra');
    expect(fromDetail?.dispatchRecords[0]?.command).toContain('--order');
    expect(fromDetail?.dispatchRecords[0]?.logKey).toContain('://');
    expect(fromDetail?.initialHandoff?.order.objective).toBe('Fix the broken deploy on production');
    expect(fromDetail?.initialHandoff?.dispatchRecord?.receiptId).toBe(fromDetail?.dispatchRecords[0]?.receiptId);
    expect(fromDetail?.runtimeSummary?.detailLabel).toContain('running');
    expect(fromDetail?.runtimeSummary?.latestLogKey).toContain('://');
    expect(fromDetail?.events.some((event: { type: string }) => event.type === 'run.dispatched')).toBe(true);
    expect(fromDetail?.executionUpdates[0]?.status).toBe('running');
    expect(fromDetail?.executionUpdates[0]?.dispatchRecordId).toBe(fromDetail?.dispatchRecords[0]?.id);
    expect(fromDetail?.executionUpdates[0]?.artifactRefs?.find((artifact) => artifact.kind === 'command')?.value).toContain('--agent');
  });

  it('surfaces distinct mode framing for manager-first and org-top routes', () => {
    const broadIntent = createIntent({ text: 'Figure out why onboarding conversion dropped this week' });
    routeStoredIntent(broadIntent.id);
    const broadView = getIntentView(broadIntent.id);
    expect(['manager_first', 'org_top']).toContain(broadView?.modeDisplay?.mode);
    expect(broadView?.modeDisplay?.hint.length).toBeGreaterThan(20);
    expect(broadView?.modeDisplay?.confidenceLabel).toContain('confidence');

    expect(broadView?.inboxRoutingSummary?.label).toMatch(/holds the first pass|org-top handoff/);
    expect(['manager', 'org_top']).toContain(broadView?.inboxRoutingSummary?.tone);
    expect(broadView?.inboxRoutingSummary?.ownerLabel?.length).toBeGreaterThan(3);
    expect(broadView?.inboxRoutingSummary?.supportLabel?.length).toBeGreaterThan(3);
    expect(['Queued now', 'Owned now']).toContain(broadView?.inboxRoutingSummary?.stateLabel);
    expect(['Ready to start', 'Work in motion']).toContain(broadView?.inboxRoutingSummary?.actionabilityLabel);

    const deployIntent = createIntent({ text: 'Fix the broken deploy on production' });
    routeStoredIntent(deployIntent.id);
    const deployView = getIntentView(deployIntent.id);
    expect(deployView?.modeDisplay?.mode).toBe('direct');
    expect(deployView?.modeDisplay?.confidenceTone).toBe('high');
  });

  it('supports delegate, escalate, block, and complete actions on a run', () => {
    const intent = createIntent({ text: 'Fix the broken deploy on production' });
    const routed = routeStoredIntent(intent.id);
    const runId = routed?.run?.id;
    expect(runId).toBeTruthy();
    const initialView = getIntentView(intent.id);
    expect(initialView?.actionCandidates.some((candidate: { agent: { id: string } }) => candidate.agent.id === 'agent_cto')).toBe(true);
    expect(initialView?.actionCandidates[0]?.agent.id).toBe('agent_cto');
    expect(initialView?.actionCandidates.some((candidate: { quickLabel?: string }) => Boolean(candidate.quickLabel))).toBe(true);

    const delegated = applyDelegationAction(runId!, {
      action: 'delegate',
      toAgentId: 'agent_cto',
      summary: 'Infra issue needs manager triage first.'
    });
    expect(delegated && !('error' in delegated)).toBe(true);
    if (!delegated || 'error' in delegated) throw new Error('delegate failed');
    expect(delegated.run?.currentAgentId).toBe('agent_cto');
    expect(delegated.orders.length).toBe(2);
    expect(delegated.orders[delegated.orders.length - 1]?.toAgentId).toBe('agent_cto');
    expect(delegated.dispatchRecords.length).toBe(2);
    expect(delegated.dispatchRecords[delegated.dispatchRecords.length - 1]?.toAgentId).toBe('agent_cto');
    expect(delegated.events[delegated.events.length - 1]?.type).toBe('run.delegated');
    expect(delegated.events[delegated.events.length - 1]?.delegationOrderId).toBe(delegated.orders[delegated.orders.length - 1]?.id);
    expect(delegated.executionUpdates[delegated.executionUpdates.length - 1]?.status).toBe('running');
    expect(delegated.events[delegated.events.length - 1]?.metadata?.dispatchReceipt).toBeTruthy();
    expect(delegated.events[delegated.events.length - 1]?.metadata?.dispatchRecordId).toBe(delegated.dispatchRecords[delegated.dispatchRecords.length - 1]?.id);
    expect(delegated.actionCandidates.some((candidate: { agent: { id: string } }) => candidate.agent.id === 'agent_ceo')).toBe(true);
    expect(delegated.actionCandidates[0]?.agent.id).toBe('agent_ceo');
    expect(delegated.actionCandidates.some((candidate: { quickLabel?: string }) => Boolean(candidate.quickLabel))).toBe(true);
    expect(delegated.inboxRoutingSummary?.stateLabel).toBe('Owned now');
    expect(delegated.inboxRoutingSummary?.actionabilityLabel).toBe('Work in motion');

    const escalated = applyDelegationAction(runId!, { action: 'escalate' });
    expect(escalated && !('error' in escalated)).toBe(true);
    if (!escalated || 'error' in escalated) throw new Error('escalate failed');
    expect(escalated.run?.currentAgentId).toBe('agent_ceo');
    expect(escalated.run?.status).toBe('blocked');
    expect(escalated.orders.length).toBe(3);
    expect(escalated.orders[escalated.orders.length - 1]?.toAgentId).toBe('agent_ceo');
    expect(escalated.dispatchRecords.length).toBe(3);
    expect(escalated.dispatchRecords[escalated.dispatchRecords.length - 1]?.toAgentId).toBe('agent_ceo');
    expect(escalated.events[escalated.events.length - 1]?.type).toBe('run.escalated');
    expect(escalated.events[escalated.events.length - 1]?.delegationOrderId).toBe(escalated.orders[escalated.orders.length - 1]?.id);
    expect(escalated.executionUpdates[escalated.executionUpdates.length - 1]?.status).toBe('blocked');
    expect(escalated.events[escalated.events.length - 1]?.metadata?.dispatchReceipt).toBeTruthy();
    expect(escalated.events[escalated.events.length - 1]?.metadata?.dispatchRecordId).toBe(escalated.dispatchRecords[escalated.dispatchRecords.length - 1]?.id);
    expect(escalated.inboxRoutingSummary?.stateLabel).toBe('Blocked now');
    expect(escalated.inboxRoutingSummary?.actionabilityLabel).toBe('Needs intervention');

    const needsInput = applyDelegationAction(runId!, {
      action: 'needs_input',
      summary: 'Need the failing request payload.',
      needsInput: 'Please attach the failing OAuth callback URL and response body.',
      artifactRefs: [{ label: 'Repro command', kind: 'command', value: 'pnpm test auth-oauth.spec.ts' }]
    });
    expect(needsInput && !('error' in needsInput)).toBe(true);
    if (!needsInput || 'error' in needsInput) throw new Error('needs_input failed');
    expect(needsInput.run?.status).toBe('running');
    expect(needsInput.intent.status).toBe('pending');
    expect(needsInput.executionUpdates[needsInput.executionUpdates.length - 1]?.status).toBe('needs_input');
    expect(needsInput.executionUpdates[needsInput.executionUpdates.length - 1]?.dispatchRecordId).toBeNull();
    expect(needsInput.executionUpdates[needsInput.executionUpdates.length - 1]?.needsInput).toContain('OAuth callback URL');
    expect(needsInput.executionUpdates[needsInput.executionUpdates.length - 1]?.artifactRefs?.[0]?.kind).toBe('command');

    const replied = applyDelegationAction(runId!, {
      action: 'reply_to_input',
      summary: 'Attached the failing callback URL and raw response body.',
      artifactRefs: [{ label: 'User reply', kind: 'note', value: 'GET /auth/callback?code=bad123 returned 500 with missing redirect_uri.' }]
    });
    expect(replied && !('error' in replied)).toBe(true);
    if (!replied || 'error' in replied) throw new Error('reply_to_input failed');
    expect(replied.run?.status).toBe('running');
    expect(replied.intent.status).toBe('running');
    expect(replied.events[replied.events.length - 1]?.type).toBe('run.input_received');
    expect(replied.executionUpdates[replied.executionUpdates.length - 1]?.status).toBe('running');
    expect(replied.executionUpdates[replied.executionUpdates.length - 1]?.artifactRefs?.[0]?.label).toBe('User reply');
    expect(replied.inboxRoutingSummary?.stateLabel).toBe('Owned now');
    expect(replied.inboxRoutingSummary?.actionabilityLabel).toBe('Work in motion');

    const blocked = applyDelegationAction(runId!, { action: 'block', summary: 'Waiting on production logs.' });
    expect(blocked && !('error' in blocked)).toBe(true);
    if (!blocked || 'error' in blocked) throw new Error('block failed');
    expect(blocked.run?.status).toBe('blocked');
    expect(blocked.events[blocked.events.length - 1]?.type).toBe('run.blocked');
    expect(blocked.executionUpdates[blocked.executionUpdates.length - 1]?.blocker).toContain('Waiting on production logs');

    const completed = applyDelegationAction(runId!, { action: 'complete' });
    expect(completed && !('error' in completed)).toBe(true);
    if (!completed || 'error' in completed) throw new Error('complete failed');
    expect(completed.run?.status).toBe('done');
    expect(completed.intent.status).toBe('done');
    expect(completed.events[completed.events.length - 1]?.type).toBe('run.completed');
    expect(completed.executionUpdates[completed.executionUpdates.length - 1]?.status).toBe('done');
    expect(completed.inboxRoutingSummary?.stateLabel).toBe('Completed');
    expect(completed.inboxRoutingSummary?.actionabilityLabel).toBe('Closed loop');
  });

  it('lists dispatch-record history for receipt-first consumers', () => {
    const first = createIntent({ text: 'Fix the broken deploy on production' });
    const second = createIntent({ text: 'Rewrite the homepage hero copy so the value prop is clearer' });
    routeStoredIntent(first.id);
    routeStoredIntent(second.id);

    const all = listDispatchRecords();
    const firstOnly = listDispatchRecords({ intentId: first.id });
    const firstView = getIntentView(first.id);
    const firstRunId = firstView?.run?.id;
    const firstOrderId = firstView?.orders[0]?.id;

    expect(all.dispatchRecords.length).toBeGreaterThanOrEqual(2);
    expect(firstOnly.dispatchRecords).toHaveLength(1);
    expect(firstOnly.dispatchRecords[0]?.intentId).toBe(first.id);
    expect(firstRunId).toBeTruthy();
    expect(firstOrderId).toBeTruthy();
    expect(listDispatchRecords({ runId: firstRunId }).dispatchRecords[0]?.delegationRunId).toBe(firstRunId);
    expect(listDispatchRecords({ orderId: firstOrderId }).dispatchRecords[0]?.delegationOrderId).toBe(firstOrderId);
  });

  it('refreshes dispatch-record history in bulk by intent or run with summary counts', () => {
    const intent = createIntent({ text: 'Fix the broken deploy on production' });
    routeStoredIntent(intent.id);
    const before = listDispatchRecords({ intentId: intent.id }).dispatchRecords;
    expect(before).toHaveLength(1);

    const beforeView = getIntentView(intent.id);
    const beforeEventCount = beforeView?.events.length ?? 0;

    const refreshedByIntent = refreshDispatchRecords({ intentId: intent.id });
    expect(refreshedByIntent.dispatchRecords).toHaveLength(1);
    expect(['running', 'completed', 'error']).toContain(refreshedByIntent.dispatchRecords[0]?.status);
    expect(refreshedByIntent.summary.requestedCount).toBe(1);
    expect(refreshedByIntent.summary.refreshedCount).toBe(1);
    expect(refreshedByIntent.summary.successCount + refreshedByIntent.summary.errorCount).toBe(1);
    expect(Object.values(refreshedByIntent.summary.statuses).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(1);

    const afterView = getIntentView(intent.id);
    expect((afterView?.events.length ?? 0)).toBeGreaterThanOrEqual(beforeEventCount);
    const runtimeTransitionEvents = afterView?.events.filter((event) => event.metadata?.source === 'dispatch-refresh') ?? [];
    expect(runtimeTransitionEvents.length).toBeGreaterThanOrEqual(1);
    expect(runtimeTransitionEvents[0]?.delegationOrderId).toBe(afterView?.dispatchRecords[0]?.delegationOrderId);
    expect(runtimeTransitionEvents[0]?.metadata?.dispatchRecordId).toBe(afterView?.dispatchRecords[0]?.id);
    expect(runtimeTransitionEvents[0]?.metadata?.nextStatus).toBe(afterView?.dispatchRecords[0]?.status);

    const runId = getIntentView(intent.id)?.run?.id;
    expect(runId).toBeTruthy();
    const refreshedByRun = refreshDispatchRecords({ runId });
    expect(refreshedByRun.dispatchRecords).toHaveLength(1);
    expect(refreshedByRun.dispatchRecords[0]?.delegationRunId).toBe(runId);
    expect(refreshedByRun.summary.requestedCount).toBe(1);
  });

  it('exports an IDP-shaped trace payload for routed intents', () => {
    const intent = createIntent({ text: 'Fix the broken deploy on production' });
    routeStoredIntent(intent.id);
    const view = getIntentView(intent.id);
    const exportPayload = getIntentIdpExport(intent.id);

    expect(exportPayload?.version).toBe('idp.v0');
    expect(exportPayload?.intent.type).toBe('intent');
    expect(exportPayload?.routing_decision?.type).toBe('routing_decision');
    expect(exportPayload?.routing_decision?.selected_owner?.id).toBe('agent_infra');
    expect(exportPayload?.run?.id).toBe(view?.run?.id);
    expect(exportPayload?.delegation_orders.length).toBe(1);
    expect(exportPayload?.delegation_orders[0]?.to_actor.id).toBe('agent_infra');
    expect(exportPayload?.delegation_orders[0]?.dispatch_receipt?.dispatch_record_id).toBe(view?.dispatchRecords[0]?.id);
    expect(exportPayload?.delegation_orders[0]?.dispatch_receipt?.receipt_id).toBe(view?.dispatchRecords[0]?.receiptId);
    expect(exportPayload?.delegation_orders[0]?.dispatch_receipt?.log_key).toBe(view?.dispatchRecords[0]?.logKey);
    expect(view?.dispatchRecords.length).toBe(1);
    expect(view?.dispatchRecords[0]?.receiptId).toContain(exportPayload?.delegation_orders[0]?.id ?? '');
    expect(exportPayload?.delegation_events.some((event) => event.event_type === 'intent.routed')).toBe(true);
    expect(exportPayload?.delegation_events.find((event) => event.event_type === 'intent.routed')?.order_id).toBe(exportPayload?.delegation_orders[0]?.id);
    expect(exportPayload?.delegation_events.find((event) => event.event_type === 'run.dispatched')?.order_id).toBe(exportPayload?.delegation_orders[0]?.id);
    expect(exportPayload?.execution_updates[0]?.type).toBe('execution_update');
    expect(exportPayload?.execution_updates[0]?.dispatch_record_id).toBe(view?.dispatchRecords[0]?.id);
    expect(exportPayload?.execution_updates[0]?.needs_input).toBe(false);
  });

  it('exports clarify-mode intents without fake run objects', () => {
    const intent = createIntent({ text: 'Handle that weird thing from earlier' });
    routeStoredIntent(intent.id);
    const exportPayload = getIntentIdpExport(intent.id);

    expect(exportPayload?.routing_decision?.routing_mode).toBe('clarify');
    expect(exportPayload?.routing_decision?.selected_owner).toBeNull();
    expect(exportPayload?.run).toBeNull();
    expect(exportPayload?.delegation_orders).toEqual([]);
    expect(exportPayload?.delegation_events[0]?.event_type).toBe('intent.clarification_requested');
    expect(exportPayload?.execution_updates).toEqual([]);
  });

  it('builds a machine-readable IDP schema manifest for external consumers', () => {
    const schema = buildIdpSchemaManifest();

    expect(schema.version).toBe('idp.v0');
    expect(schema.objects.map((object) => object.key)).toEqual([
      'intent',
      'routing_decision',
      'run',
      'delegation_orders',
      'delegation_events',
      'execution_updates'
    ]);
    expect(schema.objects.find((object) => object.key === 'routing_decision')?.kind).toBe('nullable-object');
    expect(schema.objects.find((object) => object.key === 'run')?.description.toLowerCase()).toContain('clarify');
    expect(schema.objects.find((object) => object.key === 'delegation_orders')?.fields.some((field) => field.name === 'dispatch_receipt')).toBe(true);
    expect(schema.objects.find((object) => object.key === 'execution_updates')?.fields.some((field) => field.name === 'dispatch_record_id')).toBe(true);
    expect(schema.objects.find((object) => object.key === 'execution_updates')?.fields.some((field) => field.name === 'artifact_refs')).toBe(true);
  });

  it('provides concrete IDP example payloads for direct, manager-first, and clarify flows', () => {
    const examples = listIdpExamples();

    expect(examples.map((example) => example.key)).toEqual(['direct', 'manager_first', 'clarify']);
    expect(examples[0]?.export.routing_decision?.routing_mode).toBe('direct');
    expect(examples[0]?.export.run?.current_owner?.id).toBe('agent_infra');
    expect(examples[0]?.export.delegation_orders[0]?.dispatch_receipt?.receipt_id).toBe('receipt_order_example_direct');
    expect(examples[0]?.export.execution_updates[0]?.dispatch_record_id).toBe('dispatch_example_direct');
    expect(examples[1]?.export.routing_decision?.routing_mode).toBe('manager_first');
    expect(examples[1]?.export.delegation_orders[0]?.dispatch_receipt?.dispatch_record_id).toBe('dispatch_example_manager');
    expect(examples[1]?.export.execution_updates[0]?.status).toBe('needs_input');
    expect(examples[2]?.export.routing_decision?.routing_mode).toBe('clarify');
    expect(examples[2]?.export.run).toBeNull();
    expect(examples[2]?.export.delegation_orders).toEqual([]);
  });

  it('builds a machine-readable core API contract for create/submit/route/action flows', () => {
    const contract = buildApiContractManifest();

    expect(contract.version).toBe('good-intent.api.v0');
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/intents' && endpoint.method === 'POST')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/intents/submit' && endpoint.method === 'POST')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/intents/:id/route' && endpoint.method === 'POST')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/delegation-runs/:id/actions' && endpoint.method === 'POST')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/api/contract' && endpoint.method === 'GET')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/dispatch-records' && endpoint.method === 'GET')).toBe(true);
    expect(contract.endpoints.some((endpoint) => endpoint.path === '/dispatch-records/refresh' && endpoint.method === 'POST')).toBe(true);

    const submitEndpoint = contract.endpoints.find((endpoint) => endpoint.path === '/intents/submit');
    expect(submitEndpoint?.response.type).toBe('IntentView');
    expect(submitEndpoint?.examples?.some((example) => example.name.toLowerCase().includes('submit'))).toBe(true);
    const submitExample = submitEndpoint?.examples?.[0]?.response as {
      initialHandoff?: { order?: { id?: string }; dispatchRecord?: { delegationOrderId?: string } };
    };
    expect(submitExample.initialHandoff?.order?.id).toBe('order_example_submit');
    expect(submitExample.initialHandoff?.dispatchRecord?.delegationOrderId).toBe('order_example_submit');

    const routeEndpoint = contract.endpoints.find((endpoint) => endpoint.path === '/intents/:id/route');
    const routeExample = routeEndpoint?.examples?.[0]?.response as {
      initialHandoff?: { order?: { id?: string }; dispatchRecord?: { delegationOrderId?: string; processPid?: number } };
    };
    expect(routeExample.initialHandoff?.order?.id).toBe('order_example_direct');
    expect(routeExample.initialHandoff?.dispatchRecord?.delegationOrderId).toBe('order_example_direct');
    expect(routeExample.initialHandoff?.dispatchRecord?.processPid).toBe(4242);

    const actionEndpoint = contract.endpoints.find((endpoint) => endpoint.path === '/delegation-runs/:id/actions');
    expect(actionEndpoint?.requestBody?.fields.some((field) => field.name === 'action')).toBe(true);
    expect(actionEndpoint?.examples?.some((example) => example.name === 'request more input')).toBe(true);

    const dispatchEndpoint = contract.endpoints.find((endpoint) => endpoint.path === '/dispatch-records');
    expect(dispatchEndpoint?.response.type).toBe('DispatchRecordHistory');
    expect(dispatchEndpoint?.examples?.[0]?.request).toEqual({
      query: {
        intentId: 'intent_example_create'
      }
    });
    expect(Array.isArray((dispatchEndpoint?.examples?.[0]?.response as { dispatchRecords?: unknown[] })?.dispatchRecords)).toBe(true);

    const bulkRefreshEndpoint = contract.endpoints.find((endpoint) => endpoint.path === '/dispatch-records/refresh');
    expect(bulkRefreshEndpoint?.requestBody?.fields.some((field) => field.name === 'runId')).toBe(true);
    expect((bulkRefreshEndpoint?.examples?.[0]?.response as { dispatchRecords?: unknown[] })?.dispatchRecords?.length).toBeGreaterThan(0);
    expect((bulkRefreshEndpoint?.examples?.[0]?.response as { summary?: { refreshedCount?: number } })?.summary?.refreshedCount).toBe(1);
  });

  it('exposes the resolved sqlite database path for repeatable local setup', () => {
    const status = getDbStatus();
    expect(status.path).toMatch(/good-intent\.db$/);
  });
});

describe('one-call submit flow', () => {
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

  beforeEach(() => {
    resetDatabase();
    ensureInitialized();
  });

  it('submits an intent and returns the routed owner plus trace skeleton in one call', async () => {
    const { createApp } = await import('./server');
    const app = createApp();

    const response = await request(app)
      .post('/intents/submit')
      .send({ text: 'Fix the broken deploy on production' })
      .expect(201);

    expect(response.body.intent.status).toBe('routed');
    expect(response.body.selectedAgent.id).toBe('agent_infra');
    expect(response.body.decision.routingMode).toBe('direct');
    expect(response.body.run.currentAgentId).toBe('agent_infra');
    expect(response.body.orders).toHaveLength(1);
    expect(response.body.initialHandoff.order.id).toBe(response.body.orders[0].id);
    expect(response.body.initialHandoff.dispatchRecord.id).toBe(response.body.dispatchRecords[0].id);
    expect(response.body.initialHandoff.toAgent.id).toBe('agent_infra');
    expect(response.body.initialHandoff.dispatchRecord.runtime).toBe('command-runtime');
    expect(response.body.initialHandoff.dispatchRecord.logKey).toContain('worker://');
    expect(response.body.initialHandoff.dispatchRecord.status).toBe('running');
    expect(response.body.initialHandoff.dispatchRecord.launchedAt).toBeTruthy();
    expect(response.body.initialHandoff.dispatchRecord.artifactRefs.some((artifact: { label: string }) => artifact.label === 'Runtime update file')).toBe(true);
    expect(response.body.events.some((event: { type: string }) => event.type === 'intent.routed')).toBe(true);
    expect(response.body.events.some((event: { type: string }) => event.type === 'run.dispatched')).toBe(true);
    expect(response.body.executionUpdates[0].artifactRefs.some((artifact: { label: string }) => artifact.label === 'Runtime update file')).toBe(true);
    expect(response.body.executionUpdates[0].summary).toContain('Launched handoff');

  });

});
