import type { Agent, DelegationActionCandidate, DelegationEvent, DelegationRun, DispatchRecord, InitialHandoffView, InboxBadge, InboxRoutingSummary, Intent, IntentView, RouteIntentResult, RoutingDecision as SharedRoutingDecision, RoutingMode, RoutingModeDisplay, RuntimeDispatchSummary } from '@good-intent/shared';

export function buildActionCandidates(view: {
  selectedAgent: Agent | null;
  routingCandidates: import('@good-intent/shared').RoutingCandidateView[];
}, helpers: {
  getAgentById: (agentId: string | null | undefined) => Agent | null;
}): DelegationActionCandidate[] {
  const candidates: DelegationActionCandidate[] = [];
  const seen = new Set<string>();

  const addCandidate = (agent: Agent | null, reason: string) => {
    if (!agent || seen.has(agent.id)) return;
    seen.add(agent.id);
    candidates.push({
      agent,
      reason,
      quickLabel: `To ${agent.title}`
    });
  };

  if (view.selectedAgent?.reportsTo) {
    addCandidate(helpers.getAgentById(view.selectedAgent.reportsTo), 'Manager in the current org chain');
  }

  for (const candidate of view.routingCandidates) {
    if (!candidate.isSelected) {
      addCandidate(candidate.agent, candidate.reasons[0] ?? 'Strong routing alternative');
    }
  }

  return candidates;
}

export function buildModeDisplay(mode: RoutingMode | null, confidence: number | null): RoutingModeDisplay | undefined {
  if (!mode || confidence == null) return undefined;

  const confidencePct = `${Math.round(confidence * 100)}% confidence`;

  if (mode === 'direct') {
    return {
      mode,
      badgeLabel: 'Direct specialist route',
      headline: 'The router found a clear specialist owner.',
      hint: 'This intent mapped strongly to one specialist, so the system routed it directly instead of bouncing through management.',
      confidenceLabel: `${confidencePct} · strong routing signal`,
      confidenceTone: 'high'
    };
  }

  if (mode === 'manager_first') {
    return {
      mode,
      badgeLabel: 'Manager-first delegation',
      headline: 'The router picked a manager to own the first pass.',
      hint: 'The request is broad enough that a lead should decide the downstream split instead of assigning a specialist immediately.',
      confidenceLabel: `${confidencePct} · manager review confidence`,
      confidenceTone: 'medium'
    };
  }

  if (mode === 'org_top') {
    return {
      mode,
      badgeLabel: 'Org-top handoff',
      headline: 'The router escalated this to the top of the org.',
      hint: 'This looks cross-functional or strategic, so the system routed it to the top owner instead of pretending there is a narrow specialist fit.',
      confidenceLabel: `${confidencePct} · org-top confidence`,
      confidenceTone: 'medium'
    };
  }

  return {
    mode,
    badgeLabel: 'Clarification required',
    headline: 'The router refused to fake an owner.',
    hint: 'This ask is underspecified enough that a fake assignment would be misleading, so the system asked for clarification first.',
    confidenceLabel: `${confidencePct} · better to ask first`,
    confidenceTone: 'low'
  };
}

function getArtifactValue(artifactRefs: DispatchRecord['artifactRefs'], label: string) {
  return artifactRefs.find((artifact) => artifact.label === label)?.value ?? null;
}

export function buildRuntimeSummary(dispatchRecords: DispatchRecord[]): RuntimeDispatchSummary | undefined {
  if (dispatchRecords.length === 0) return undefined;

  const latest = [...dispatchRecords].sort((left, right) => right.dispatchedAt.localeCompare(left.dispatchedAt))[0];
  const errorCount = dispatchRecords.filter((record) => record.status === 'error').length;
  const runningCount = dispatchRecords.filter((record) => record.status === 'running').length;
  const queuedCount = dispatchRecords.filter((record) => record.status === 'queued').length;
  const completedCount = dispatchRecords.filter((record) => record.status === 'completed').length;
  const latestWorkerDomain = getArtifactValue(latest.artifactRefs, 'Worker domain');
  const latestWorkerSummary = getArtifactValue(latest.artifactRefs, 'Worker summary');
  const latestWorkerObjective = getArtifactValue(latest.artifactRefs, 'Worker objective');
  const latestWorkerArtifactPath = getArtifactValue(latest.artifactRefs, 'Worker artifact');
  const latestWorkerTracePath = getArtifactValue(latest.artifactRefs, 'Worker trace file');
  const latestWorkerState = getArtifactValue(latest.artifactRefs, 'Worker state');

  const latestStatus = latest?.status ?? 'idle';
  const statusLabel = latestStatus === 'running'
    ? 'Runtime active'
    : latestStatus === 'completed'
      ? 'Runtime completed'
      : latestStatus === 'error'
        ? 'Runtime error'
        : latestStatus === 'queued'
          ? 'Runtime queued'
          : 'No runtime handoff';

  const detailParts: string[] = [];
  if (latestWorkerDomain) {
    detailParts.push(`worker ${latestWorkerDomain}`);
  }
  if (latestWorkerSummary) {
    detailParts.push(latestWorkerSummary);
  }
  if (latestWorkerState && latestWorkerState !== latestStatus) {
    detailParts.push(latestWorkerState);
  }
  if (dispatchRecords.length > 1) {
    detailParts.push(`${dispatchRecords.length} receipts total`);
  }
  if (runningCount > 0) {
    detailParts.push(`${runningCount} running`);
  }
  if (queuedCount > 0) {
    detailParts.push(`${queuedCount} queued`);
  }
  if (completedCount > 0) {
    detailParts.push(`${completedCount} completed`);
  }
  if (errorCount > 0) {
    detailParts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  }

  const tone = latestStatus === 'error'
    ? 'low'
    : latestStatus === 'running' || latestStatus === 'completed'
      ? 'high'
      : latestStatus === 'queued'
        ? 'medium'
        : 'neutral';

  return {
    totalCount: dispatchRecords.length,
    latestStatus,
    latestSummary: latest.summary,
    latestRuntime: latest.runtime,
    latestChannel: latest.channel,
    latestDispatchedAt: latest.dispatchedAt,
    latestLaunchedAt: latest.launchedAt ?? null,
    latestEndedAt: latest.endedAt ?? null,
    latestProcessPid: latest.processPid ?? null,
    latestExitCode: latest.exitCode ?? null,
    latestReceiptId: latest.receiptId,
    latestLogKey: latest.logKey,
    latestWorkerDomain,
    latestWorkerSummary,
    latestWorkerObjective,
    latestWorkerArtifactPath,
    latestWorkerTracePath,
    latestWorkerState,
    errorCount,
    runningCount,
    queuedCount,
    completedCount,
    statusLabel,
    detailLabel: detailParts.join(' · ') || latest.summary,
    tone
  };
}

export function buildInitialHandoff(orders: import('@good-intent/shared').DelegationOrder[], dispatchRecords: DispatchRecord[], helpers: {
  getAgentById: (agentId: string | null | undefined) => Agent | null;
}): InitialHandoffView | undefined {
  if (orders.length === 0) return undefined;

  const firstOrder = [...orders].sort((left, right) => left.issuedAt.localeCompare(right.issuedAt))[0];
  const matchingDispatchRecord = dispatchRecords.find((record) => record.delegationOrderId === firstOrder.id) ?? null;

  return {
    order: firstOrder,
    toAgent: helpers.getAgentById(firstOrder.toAgentId),
    fromAgent: helpers.getAgentById(firstOrder.fromAgentId),
    dispatchRecord: matchingDispatchRecord
  };
}

export function buildInboxBadges(view: {
  decision: SharedRoutingDecision | null;
  run: DelegationRun | null;
  selectedAgent: Agent | null;
  runtimeSummary?: RuntimeDispatchSummary;
}): InboxBadge[] {
  const badges: InboxBadge[] = [];

  if (view.decision?.routingMode === 'direct') {
    badges.push({ label: 'Direct specialist route', tone: 'high' });
  } else if (view.decision?.routingMode === 'manager_first') {
    badges.push({ label: 'Manager-first delegation', tone: 'medium' });
  } else if (view.decision?.routingMode === 'org_top') {
    badges.push({ label: 'Org-top handoff', tone: 'medium' });
  } else if (view.decision?.routingMode === 'clarify') {
    badges.push({ label: 'Clarification required', tone: 'low' });
  }

  if (view.run?.status === 'queued') {
    badges.push({ label: 'Run queued', tone: 'neutral' });
  } else if (view.run?.status === 'running') {
    badges.push({ label: 'Run active', tone: 'high' });
  } else if (view.run?.status === 'blocked') {
    badges.push({ label: 'Blocked', tone: 'low' });
  } else if (view.run?.status === 'done') {
    badges.push({ label: 'Done', tone: 'high' });
  } else if (view.decision?.routingMode === 'clarify') {
    badges.push({ label: 'Needs detail', tone: 'low' });
  }

  if (view.runtimeSummary) {
    badges.push({ label: view.runtimeSummary.statusLabel, tone: view.runtimeSummary.tone });
  }

  if (view.selectedAgent) {
    badges.push({ label: view.selectedAgent.title, tone: 'neutral' });
  }

  return badges;
}

export function buildInboxRoutingSummary(view: {
  decision: SharedRoutingDecision | null;
  selectedAgent: Agent | null;
  routingCandidates: import('@good-intent/shared').RoutingCandidateView[];
  run: DelegationRun | null;
}): InboxRoutingSummary | undefined {
  if (!view.decision) return undefined;

  const selectedTitle = view.selectedAgent?.title ?? 'No owner';
  const alternatives = view.routingCandidates.filter((candidate) => !candidate.isSelected).length;
  const stateLabel = view.run?.status === 'done'
    ? 'Completed'
    : view.run?.status === 'blocked'
      ? 'Blocked now'
      : view.run?.status === 'running'
        ? 'Owned now'
        : view.run?.status === 'queued'
          ? 'Queued now'
          : 'Awaiting detail';
  const actionabilityLabel = view.run?.status === 'done'
    ? 'Closed loop'
    : view.run?.status === 'blocked'
      ? 'Needs intervention'
      : view.run?.status === 'running'
        ? 'Work in motion'
        : view.run?.status === 'queued'
          ? 'Ready to start'
          : 'Needs more context';

  if (view.decision.routingMode === 'clarify') {
    return {
      label: 'Needs detail before routing',
      detail: 'The router held off instead of faking ownership.',
      tone: 'clarify',
      ownerLabel: 'No owner selected',
      supportLabel: 'Clarification required',
      stateLabel,
      actionabilityLabel
    };
  }

  if (view.decision.routingMode === 'manager_first') {
    return {
      label: `${selectedTitle} holds the first pass`,
      detail: alternatives > 0 ? `${alternatives} downstream alternatives were kept in reserve.` : 'Manager route chosen over a direct specialist handoff.',
      tone: 'manager',
      ownerLabel: selectedTitle,
      supportLabel: alternatives > 0 ? `First pass over ${alternatives} alternative${alternatives === 1 ? '' : 's'}` : 'Manager-first delegation',
      stateLabel,
      actionabilityLabel
    };
  }

  if (view.decision.routingMode === 'org_top') {
    return {
      label: `${selectedTitle} took the org-top handoff`,
      detail: alternatives > 0 ? `${alternatives} narrower owners stayed as backup options.` : 'Top-level delegation beat narrower specialist fits.',
      tone: 'org_top',
      ownerLabel: selectedTitle,
      supportLabel: alternatives > 0 ? `Org-top over ${alternatives} narrower option${alternatives === 1 ? '' : 's'}` : 'Top-level delegation route',
      stateLabel,
      actionabilityLabel
    };
  }

  return {
    label: `${selectedTitle} won directly`,
    detail: alternatives > 0 ? `${alternatives} alternatives considered.` : 'Top specialist signal with no close alternative.',
    tone: 'direct',
    ownerLabel: selectedTitle,
    supportLabel: alternatives > 0 ? `Won over ${alternatives} alternative${alternatives === 1 ? '' : 's'}` : 'Top specialist signal',
    stateLabel,
    actionabilityLabel
  };
}

export function buildClarificationPreviewEvent(intentId: string, decision: SharedRoutingDecision | null): DelegationEvent[] {
  if (decision?.routingMode !== 'clarify') return [];
  return [{
    id: `evt_preview_${intentId}`,
    delegationRunId: `clarify_${intentId}`,
    type: 'intent.clarification_requested',
    fromAgentId: null,
    toAgentId: null,
    summary: decision.reasoningSummary,
    metadata: { intentId },
    createdAt: decision.createdAt
  }];
}

export function buildIntentView(intent: Intent, options: {
  previewEvents?: DelegationEvent[];
  hideClarifyCandidates?: boolean;
} = {}, deps: {
  getAllAgents: () => Agent[];
  getRoutingDecisionByIntentId: (intentId: string) => SharedRoutingDecision | null;
  getRunByIntentId: (intentId: string) => DelegationRun | null;
  getOrdersByRunId: (runId: string) => import('@good-intent/shared').DelegationOrder[];
  getEventsByRunId: (runId: string) => DelegationEvent[];
  getDispatchRecordsByRunId: (runId: string) => import('@good-intent/shared').DispatchRecord[];
  getExecutionUpdatesByRunId: (runId: string) => import('@good-intent/shared').ExecutionUpdate[];
  getAgentById: (agentId: string | null | undefined) => Agent | null;
}): IntentView {
  const agents = deps.getAllAgents();
  const decision = deps.getRoutingDecisionByIntentId(intent.id);
  const run = deps.getRunByIntentId(intent.id);
  const orders = run ? deps.getOrdersByRunId(run.id) : [];
  const dispatchRecords = run ? deps.getDispatchRecordsByRunId(run.id) : [];
  const initialHandoff = buildInitialHandoff(orders, dispatchRecords, { getAgentById: deps.getAgentById });
  const runtimeSummary = buildRuntimeSummary(dispatchRecords);
  const events = options.previewEvents ?? (run ? deps.getEventsByRunId(run.id) : []);
  const executionUpdates = run ? deps.getExecutionUpdatesByRunId(run.id) : [];
  const selectedAgent = decision?.selectedAgentId ? agents.find((agent) => agent.id === decision.selectedAgentId) ?? null : null;

  const routingCandidates: import('@good-intent/shared').RoutingCandidateView[] = options.hideClarifyCandidates && decision?.routingMode === 'clarify'
    ? []
    : decision
      ? decision.candidateSnapshot.map((candidate) => {
          const agent = agents.find((entry) => entry.id === candidate.agentId);
          if (!agent) return null;
          return {
            agent,
            score: candidate.score,
            reasons: candidate.reasons,
            isSelected: candidate.agentId === decision.selectedAgentId
          };
        }).filter(Boolean) as import('@good-intent/shared').RoutingCandidateView[]
      : [];

  const actionCandidates = run
    ? buildActionCandidates({ selectedAgent: deps.getAgentById(run.currentAgentId), routingCandidates }, { getAgentById: deps.getAgentById })
    : [];
  const modeDisplay = buildModeDisplay(decision?.routingMode ?? null, decision?.confidence ?? null);
  const inboxBadges = buildInboxBadges({ decision, run, selectedAgent, runtimeSummary });
  const inboxRoutingSummary = buildInboxRoutingSummary({ decision, selectedAgent, routingCandidates, run });

  return {
    intent,
    decision,
    selectedAgent,
    run,
    orders,
    dispatchRecords,
    initialHandoff,
    runtimeSummary,
    events,
    executionUpdates,
    actionCandidates,
    routingCandidates,
    modeDisplay,
    inboxBadges,
    inboxRoutingSummary
  };
}

export function toRouteIntentResult(view: IntentView): RouteIntentResult {
  return view as RouteIntentResult;
}
