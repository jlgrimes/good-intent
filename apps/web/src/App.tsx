import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FormEvent } from 'react';
import './App.css';

type Agent = {
  id: string;
  name: string;
  role: string;
  title: string;
  reportsTo: string | null;
  capabilities: string[];
  status: string;
};

type IdpExportPayload = {
  version: string;
  exported_at: string;
  intent: { type: string; id: string };
  routing_decision: null | { type: string; id: string; routing_mode: string };
  run: null | { id: string; status: string };
  delegation_orders: Array<{ id: string; type: string }>;
  delegation_events: Array<{ id: string; type: string; event_type: string }>;
  execution_updates: Array<{ id: string; type: string; status: string }>;
};

type DispatchRecord = {
  id: string;
  delegationOrderId: string;
  delegationRunId: string;
  intentId: string;
  toAgentId: string;
  runtime: 'stub-runtime' | 'command-runtime';
  channel: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  receiptId: string;
  summary: string;
  command: string;
  logKey: string;
  artifactRefs: Array<{
    label: string;
    kind: string;
    value: string;
  }>;
  dispatchedAt: string;
  launchedAt?: string | null;
  endedAt?: string | null;
  processPid?: number | null;
  exitCode?: number | null;
  lastError?: string | null;
};

type DelegationOrder = {
  id: string;
  intentId: string;
  routingDecisionId?: string | null;
  delegationRunId: string;
  fromAgentId?: string | null;
  toAgentId: string;
  objective: string;
  successCriteria: string[];
  constraints: string[];
  priority: 'low' | 'normal' | 'high';
  issuedAt: string;
};

type InitialHandoff = {
  order: DelegationOrder;
  toAgent: Agent | null;
  fromAgent: Agent | null;
  dispatchRecord: DispatchRecord | null;
};

type BulkRefreshSummary = {
  requestedCount: number;
  refreshedCount: number;
  successCount: number;
  errorCount: number;
  unchangedCount: number;
  statuses: Partial<Record<'queued' | 'running' | 'completed' | 'error', number>>;
};

type RoutingView = {
  inboxBadges?: Array<{
    label: string;
    tone: 'neutral' | 'high' | 'medium' | 'low';
  }>;
  inboxRoutingSummary?: {
    label: string;
    detail: string;
    tone?: 'neutral' | 'direct' | 'manager' | 'org_top' | 'clarify';
    ownerLabel?: string;
    supportLabel?: string;
    stateLabel?: string;
    actionabilityLabel?: string;
  };
  intent: {
    id: string;
    text: string;
    urgency?: string;
    status: string;
    createdAt: string;
  };
  decision: null | {
    selectedAgentId: string | null;
    routingMode: string;
    confidence: number;
    reasoningSummary: string;
  };
  selectedAgent: Agent | null;
  run: null | {
    id: string;
    status: string;
    currentAgentId?: string | null;
  };
  orders: DelegationOrder[];
  dispatchRecords: DispatchRecord[];
  initialHandoff?: InitialHandoff;
  runtimeSummary?: {
    totalCount: number;
    latestStatus: 'queued' | 'running' | 'completed' | 'error' | 'idle';
    latestSummary: string;
    latestRuntime: 'stub-runtime' | 'command-runtime' | null;
    latestChannel: string | null;
    latestDispatchedAt: string | null;
    latestLaunchedAt: string | null;
    latestEndedAt: string | null;
    latestProcessPid: number | null;
    latestExitCode: number | null;
    latestReceiptId: string | null;
    latestLogKey: string | null;
    latestWorkerDomain: string | null;
    latestWorkerSummary: string | null;
    latestWorkerObjective: string | null;
    latestWorkerArtifactPath: string | null;
    latestWorkerTracePath: string | null;
    latestWorkerState: string | null;
    errorCount: number;
    runningCount: number;
    queuedCount: number;
    completedCount: number;
    statusLabel: string;
    detailLabel: string;
    tone: 'neutral' | 'high' | 'medium' | 'low';
  };
  events: Array<{
    id: string;
    type: string;
    summary: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
  executionUpdates: Array<{
    id: string;
    delegationRunId: string;
    agentId?: string | null;
    status: string;
    summary: string;
    progress?: number | null;
    blocker?: string | null;
    needsInput?: string | null;
    artifactRefs?: Array<{
      label: string;
      kind: string;
      value: string;
    }>;
    createdAt: string;
  }>;
  actionCandidates: Array<{
    agent: Agent;
    reason: string;
    quickLabel?: string;
  }>;
  routingCandidates: Array<{
    agent: Agent;
    score: number;
    reasons: string[];
    isSelected: boolean;
  }>;
  modeDisplay?: {
    mode: string;
    badgeLabel: string;
    headline: string;
    hint: string;
    confidenceLabel: string;
    confidenceTone: 'high' | 'medium' | 'low';
  };
};

type RefreshSummaryTone = 'success' | 'mixed' | 'error';

type RefreshSummaryView = {
  message: string;
  detail?: string;
  tone: RefreshSummaryTone;
};

type ArtifactRef = DispatchRecord['artifactRefs'][number];

type WorkerArtifactSummary = {
  domain: string | null;
  summary: string | null;
  objective: string | null;
  artifactPath: string | null;
  tracePath: string | null;
  state: string | null;
};

const API_BASE = 'http://localhost:4010';
const EXAMPLES = [
  'Fix the broken deploy on production',
  'Rewrite the homepage hero copy so the value prop is clearer',
  'Figure out why onboarding conversion dropped this week',
  'Fix the OAuth callback bug in the app'
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatArtifactLabel(kind: string, value: string) {
  if (kind === 'command' && value.length > 96) {
    return `${value.slice(0, 93)}...`;
  }
  return value;
}

function buildBulkRefreshMessage(summary: BulkRefreshSummary) {
  const parts: string[] = [];
  if (summary.successCount > 0) {
    parts.push(`${summary.successCount} receipt${summary.successCount === 1 ? '' : 's'} reconciled`);
  }
  if (summary.errorCount > 0) {
    parts.push(`${summary.errorCount} failed`);
  }
  if (summary.unchangedCount > 0) {
    parts.push(`${summary.unchangedCount} unchanged`);
  }
  return parts.join(', ') || `Checked ${summary.requestedCount} receipt${summary.requestedCount === 1 ? '' : 's'}`;
}

function buildBulkRefreshDetail(summary: BulkRefreshSummary) {
  const entries = Object.entries(summary.statuses)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([status, count]) => `${count} ${status}`);
  return entries.join(' · ');
}

function buildRefreshSummaryView(summary: BulkRefreshSummary): RefreshSummaryView {
  return {
    message: buildBulkRefreshMessage(summary),
    detail: buildBulkRefreshDetail(summary),
    tone: summary.errorCount > 0 ? (summary.successCount > 0 ? 'mixed' : 'error') : 'success'
  };
}

function isRuntimeTransitionEvent(event: RoutingView['events'][number]) {
  return event.metadata?.source === 'dispatch-refresh';
}

function renderTimelineEventLabel(event: RoutingView['events'][number]) {
  if (!isRuntimeTransitionEvent(event)) {
    return event.type;
  }

  const nextStatus = typeof event.metadata?.nextStatus === 'string' ? event.metadata.nextStatus : null;
  if (nextStatus === 'completed') return 'runtime.completed';
  if (nextStatus === 'error') return 'runtime.error';
  if (nextStatus === 'running') return 'runtime.running';
  return 'runtime.refresh';
}

function renderTimelineEventDetail(event: RoutingView['events'][number]) {
  if (!isRuntimeTransitionEvent(event)) {
    return null;
  }

  const previousStatus = typeof event.metadata?.previousStatus === 'string' ? event.metadata.previousStatus : null;
  const nextStatus = typeof event.metadata?.nextStatus === 'string' ? event.metadata.nextStatus : null;
  const receiptId = typeof event.metadata?.receiptId === 'string' ? event.metadata.receiptId : null;
  const launchedAt = typeof event.metadata?.launchedAt === 'string' ? event.metadata.launchedAt : null;
  const endedAt = typeof event.metadata?.endedAt === 'string' ? event.metadata.endedAt : null;
  const processPid = typeof event.metadata?.processPid === 'number' ? event.metadata.processPid : null;
  const exitCode = typeof event.metadata?.exitCode === 'number' ? event.metadata.exitCode : null;
  const lastError = typeof event.metadata?.lastError === 'string' ? event.metadata.lastError : null;

  const parts: string[] = [];
  if (previousStatus && nextStatus) {
    parts.push(`${previousStatus} → ${nextStatus}`);
  } else if (nextStatus) {
    parts.push(nextStatus);
  }
  if (receiptId) {
    parts.push(receiptId);
  }
  if (processPid != null) {
    parts.push(`pid ${processPid}`);
  }
  if (launchedAt) {
    parts.push(`launched ${formatTimestamp(launchedAt)}`);
  }
  if (endedAt) {
    parts.push(`ended ${formatTimestamp(endedAt)}`);
  }
  if (exitCode != null) {
    parts.push(`exit ${exitCode}`);
  }
  if (lastError) {
    parts.push(lastError);
  }

  return parts.join(' · ');
}

function runtimeSummaryExtra(summary: NonNullable<RoutingView['runtimeSummary']>) {
  const parts: string[] = [];
  if (summary.latestWorkerDomain) parts.push(`${formatWorkerDomain(summary.latestWorkerDomain)} domain`);
  if (summary.latestWorkerState) parts.push(summary.latestWorkerState);
  if (summary.latestProcessPid != null) parts.push(`pid ${summary.latestProcessPid}`);
  if (summary.latestExitCode != null) parts.push(`exit ${summary.latestExitCode}`);
  if (summary.latestEndedAt) parts.push(`ended ${formatTimestamp(summary.latestEndedAt)}`);
  return parts.join(' · ');
}

function getArtifactValue(artifactRefs: ArtifactRef[] | undefined, label: string) {
  return artifactRefs?.find((artifact) => artifact.label === label)?.value ?? null;
}

function buildWorkerArtifactSummary(artifactRefs: ArtifactRef[] | undefined): WorkerArtifactSummary | null {
  if (!artifactRefs?.length) return null;
  const domain = getArtifactValue(artifactRefs, 'Worker domain');
  const summary = getArtifactValue(artifactRefs, 'Worker summary');
  const objective = getArtifactValue(artifactRefs, 'Worker objective');
  const artifactPath = getArtifactValue(artifactRefs, 'Worker artifact');
  const tracePath = getArtifactValue(artifactRefs, 'Worker trace file');
  const state = getArtifactValue(artifactRefs, 'Worker state');

  if (!domain && !summary && !objective && !artifactPath && !tracePath && !state) {
    return null;
  }

  return {
    domain,
    summary,
    objective,
    artifactPath,
    tracePath,
    state
  };
}

function formatWorkerDomain(domain: string | null) {
  if (!domain) return 'General';
  return domain
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function workerSummaryTone(domain: string | null): 'high' | 'medium' | 'neutral' {
  if (!domain) return 'neutral';
  if (domain === 'infrastructure' || domain === 'growth') return 'high';
  return 'medium';
}

function App() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<RoutingView | null>(null);
  const [recentIntents, setRecentIntents] = useState<RoutingView[]>([]);
  const [idpExport, setIdpExport] = useState<string>('');
  const [idpExportPayload, setIdpExportPayload] = useState<IdpExportPayload | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [refreshingDispatchRecordIds, setRefreshingDispatchRecordIds] = useState<string[]>([]);
  const [dispatchRefreshErrors, setDispatchRefreshErrors] = useState<Record<string, string>>({});
  const [dispatchRefreshSuccessIds, setDispatchRefreshSuccessIds] = useState<string[]>([]);
  const [bulkRefreshSummary, setBulkRefreshSummary] = useState<RefreshSummaryView | null>(null);
  const [inboxRefreshSummaries, setInboxRefreshSummaries] = useState<Record<string, RefreshSummaryView>>({});

  async function refreshOrg() {
    await fetch(`${API_BASE}/org`);
  }

  async function refreshRecentIntents(selectId?: string) {
    setSidebarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/intents`);
      const data = await res.json();
      const intents = (data.intents ?? []) as RoutingView[];
      setRecentIntents(intents);

      if (selectId) {
        const selected = intents.find((entry) => entry.intent.id === selectId);
        if (selected) {
          setView(selected);
        }
      } else if (!view && intents.length > 0) {
        setView(intents[0]);
      }
    } finally {
      setSidebarLoading(false);
    }
  }

  useEffect(() => {
    void refreshOrg();
    void refreshRecentIntents();
  }, []);

  const applyLoadedIntent = useCallback((detail: RoutingView, exportPayload: IdpExportPayload) => {
    setView(detail);
    setIdpExportPayload(exportPayload);
    setIdpExport(JSON.stringify(exportPayload, null, 2));
    setCopyState('idle');
  }, []);

  const patchRecentIntent = useCallback((nextView: RoutingView) => {
    setRecentIntents((current) => {
      const existing = current.find((entry) => entry.intent.id === nextView.intent.id);
      if (!existing) {
        return current;
      }
      return current.map((entry) => (entry.intent.id === nextView.intent.id ? nextView : entry));
    });
  }, []);

  async function loadIntent(id: string) {
    const [detailRes, exportRes] = await Promise.all([
      fetch(`${API_BASE}/intents/${id}`),
      fetch(`${API_BASE}/intents/${id}/idp-export`)
    ]);
    if (!detailRes.ok) throw new Error('Failed to load routed intent');
    if (!exportRes.ok) throw new Error('Failed to load IDP export');
    const detail = await detailRes.json();
    const exportPayload = await exportRes.json();
    applyLoadedIntent(detail, exportPayload);
  }

  async function refreshDispatchRecord(recordId: string) {
    if (!view) return;
    setRefreshingDispatchRecordIds((current) => (current.includes(recordId) ? current : [...current, recordId]));
    setDispatchRefreshErrors((current) => {
      const next = { ...current };
      delete next[recordId];
      return next;
    });
    setDispatchRefreshSuccessIds((current) => current.filter((id) => id !== recordId));
    setBulkRefreshSummary(null);
    setError(null);

    try {
      const refreshRes = await fetch(`${API_BASE}/dispatch-records/${recordId}/refresh`, { method: 'POST' });
      const refreshPayload = await refreshRes.json().catch(() => ({}));
      if (!refreshRes.ok) {
        throw new Error(refreshPayload.error ?? 'Failed to refresh dispatch receipt');
      }

      const refreshedRecord = (refreshPayload.dispatchRecord ?? refreshPayload.record ?? null) as DispatchRecord | null;
      const runStatus = typeof refreshPayload.runStatus === 'string' ? refreshPayload.runStatus : null;
      const intentStatus = typeof refreshPayload.intentStatus === 'string' ? refreshPayload.intentStatus : null;

      if (refreshedRecord) {
        const nextView: RoutingView = {
          ...view,
          intent: intentStatus ? { ...view.intent, status: intentStatus } : view.intent,
          run: view.run && runStatus ? { ...view.run, status: runStatus } : view.run,
          dispatchRecords: view.dispatchRecords.map((record) => (record.id === recordId ? refreshedRecord : record)),
          initialHandoff: view.initialHandoff?.dispatchRecord?.id === recordId
            ? {
                ...view.initialHandoff,
                dispatchRecord: refreshedRecord
              }
            : view.initialHandoff
        };
        setView(nextView);
        patchRecentIntent(nextView);
      } else {
        await loadIntent(view.intent.id);
        await refreshRecentIntents(view.intent.id);
      }

      setDispatchRefreshSuccessIds((current) => (current.includes(recordId) ? current : [...current, recordId]));
      window.setTimeout(() => {
        setDispatchRefreshSuccessIds((current) => current.filter((id) => id !== recordId));
      }, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setDispatchRefreshErrors((current) => ({ ...current, [recordId]: message }));
    } finally {
      setRefreshingDispatchRecordIds((current) => current.filter((id) => id !== recordId));
    }
  }

  async function refreshAllDispatchRecords() {
    if (!view || view.dispatchRecords.length === 0) return;

    const recordIds = view.dispatchRecords.map((record) => record.id);
    setRefreshingDispatchRecordIds((current) => Array.from(new Set([...current, ...recordIds])));
    setDispatchRefreshErrors((current) => {
      const next = { ...current };
      for (const recordId of recordIds) delete next[recordId];
      return next;
    });
    setDispatchRefreshSuccessIds((current) => current.filter((id) => !recordIds.includes(id)));
    setBulkRefreshSummary(null);
    setError(null);

    try {
      const body = view.run?.id ? { runId: view.run.id } : { intentId: view.intent.id };
      const refreshRes = await fetch(`${API_BASE}/dispatch-records/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await refreshRes.json().catch(() => ({}));
      if (!refreshRes.ok) {
        throw new Error(payload.error ?? 'Failed to refresh dispatch receipts');
      }

      const refreshedRecords = (payload.dispatchRecords ?? []) as DispatchRecord[];
      const summary = (payload.summary ?? null) as BulkRefreshSummary | null;
      const refreshedById = new Map(refreshedRecords.map((record) => [record.id, record]));
      const refreshedIds = refreshedRecords.map((record) => record.id);
      const nextInitialHandoffDispatchRecord = view.initialHandoff?.dispatchRecord
        ? refreshedById.get(view.initialHandoff.dispatchRecord.id) ?? view.initialHandoff.dispatchRecord
        : view.initialHandoff?.dispatchRecord ?? null;

      const nextView: RoutingView = {
        ...view,
        dispatchRecords: view.dispatchRecords.map((record) => refreshedById.get(record.id) ?? record),
        initialHandoff: view.initialHandoff
          ? {
              ...view.initialHandoff,
              dispatchRecord: nextInitialHandoffDispatchRecord
            }
          : view.initialHandoff
      };
      setView(nextView);
      patchRecentIntent(nextView);
      setDispatchRefreshSuccessIds((current) => Array.from(new Set([...current.filter((id) => !recordIds.includes(id)), ...refreshedIds])));
      if (summary) {
        const nextSummary = buildRefreshSummaryView(summary);
        setBulkRefreshSummary(nextSummary);
        setInboxRefreshSummaries((current) => ({
          ...current,
          [view.intent.id]: nextSummary
        }));
      }
      window.setTimeout(() => {
        setDispatchRefreshSuccessIds((current) => current.filter((id) => !refreshedIds.includes(id)));
      }, 1800);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const nextErrors: Record<string, string> = {};
      for (const recordId of recordIds) {
        nextErrors[recordId] = message;
      }
      setDispatchRefreshErrors((current) => ({ ...current, ...nextErrors }));
      const errorSummary: RefreshSummaryView = { message, tone: 'error' };
      setBulkRefreshSummary(errorSummary);
      setInboxRefreshSummaries((current) => ({
        ...current,
        [view.intent.id]: errorSummary
      }));
    } finally {
      setRefreshingDispatchRecordIds((current) => current.filter((id) => !recordIds.includes(id)));
    }
  }

  async function submitIntent(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setBulkRefreshSummary(null);

    try {
      const submitRes = await fetch(`${API_BASE}/intents/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const submitted = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitted.error ?? 'Failed to submit intent');

      setView(submitted);
      setText('');
      await refreshRecentIntents(submitted.intent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function runDelegationAction(action: 'delegate' | 'escalate' | 'block' | 'complete' | 'needs_input' | 'reply_to_input', toAgentId?: string, targetView?: RoutingView, overrideBody?: Record<string, unknown>) {
    const actionView = targetView ?? view;
    if (!actionView?.run?.id) return;
    setLoading(true);
    setError(null);
    setBulkRefreshSummary(null);

    try {
      const res = await fetch(`${API_BASE}/delegation-runs/${actionView.run.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          overrideBody
            ?? (action === 'needs_input'
              ? {
                  action,
                  toAgentId,
                  summary: 'Need more input before continuing.',
                  needsInput: 'Share the missing context or failing artifact so the current owner can proceed.',
                  artifactRefs: [{ label: 'What to send', kind: 'note', value: 'Repro steps, screenshots, logs, or failing payload.' }]
                }
              : { action, toAgentId })
        )
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to apply delegation action');
      if ((targetView?.intent.id ?? view?.intent.id) === data.intent.id) {
        setView(data);
      }
      await refreshRecentIntents(data.intent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const latestNeedsInput = useMemo(() => {
    if (!view) return null;
    return [...view.executionUpdates].reverse().find((update) => update.status === 'needs_input') ?? null;
  }, [view]);

  const selectedIntentId = view?.intent.id;

  const exportSummary = useMemo(() => {
    if (!idpExportPayload) return null;
    return [
      { label: 'Version', value: idpExportPayload.version },
      { label: 'Intent', value: idpExportPayload.intent.id },
      { label: 'Route', value: idpExportPayload.routing_decision?.routing_mode ?? 'clarify / none' },
      { label: 'Run', value: idpExportPayload.run?.status ?? 'no run' },
      { label: 'Orders', value: String(idpExportPayload.delegation_orders.length) },
      { label: 'Events', value: String(idpExportPayload.delegation_events.length) },
      { label: 'Updates', value: String(idpExportPayload.execution_updates.length) }
    ];
  }, [idpExportPayload]);

  async function copyIdpExport() {
    try {
      await navigator.clipboard.writeText(idpExport);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  function downloadIdpExport() {
    if (!view || !idpExport) return;
    const blob = new Blob([idpExport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `good-intent-${view.intent.id}-idp-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleExportKeydown(event: KeyboardEvent<HTMLPreElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      void copyIdpExport();
    }
  }

  return (
    <div className="page">
      <div className="hero">
        <p className="eyebrow">Good Intent</p>
        <h1>Intent in. Automatic delegation out.</h1>
        <p className="subcopy">Primary flow has no assignee picker. Say what needs doing; the org chooses an owner and shows why.</p>
      </div>

      <div className="layout">
        <section className="card composer">
          <h2>Submit intent</h2>
          <form onSubmit={submitIntent}>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder="What needs to get done?" />
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button type="button" key={example} className="chip" onClick={() => setText(example)}>
                  {example}
                </button>
              ))}
            </div>
            <button type="submit" disabled={loading || !text.trim()}>
              {loading ? 'Routing…' : 'Route automatically'}
            </button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card result">
          <h2>Routing result</h2>
          {!view ? (
            <p className="muted">Submit an intent to see the chosen owner, confidence, explanation, and delegation trace.</p>
          ) : (
            <>
              {view.modeDisplay ? (
                <div className={`mode-callout tone-${view.modeDisplay.confidenceTone}`}>
                  <div className="mode-header">
                    <span className="mode-badge">{view.modeDisplay.badgeLabel}</span>
                    <strong>{view.modeDisplay.headline}</strong>
                  </div>
                  <p className="mode-hint">{view.modeDisplay.hint}</p>
                  <small>{view.modeDisplay.confidenceLabel}</small>
                </div>
              ) : null}

              <div className="result-grid">
                <div>
                  <span className="label">Owner</span>
                  <strong>{view.selectedAgent ? `${view.selectedAgent.title} — ${view.selectedAgent.name}` : 'Clarification required'}</strong>
                </div>
                <div>
                  <span className="label">Mode</span>
                  <strong>{view.modeDisplay?.badgeLabel ?? view.decision?.routingMode ?? 'n/a'}</strong>
                </div>
                <div>
                  <span className="label">Confidence</span>
                  <strong>{view.modeDisplay?.confidenceLabel ?? (view.decision ? `${Math.round(view.decision.confidence * 100)}%` : 'n/a')}</strong>
                </div>
                <div>
                  <span className="label">Run status</span>
                  <strong>{view.run?.status ?? 'awaiting clarification'}</strong>
                </div>
              </div>
              <p className="explanation">{view.decision?.reasoningSummary}</p>
              <div>
                <span className="label">Intent</span>
                <p>{view.intent.text}</p>
              </div>
              {view.initialHandoff ? (
                <div>
                  <span className="label">Initial handoff proof</span>
                  <div className="bulk-refresh-summary tone-high">
                    <strong>{view.initialHandoff.toAgent ? `${view.initialHandoff.toAgent.title} owns the first handoff.` : 'First delegation order issued.'}</strong>
                    <small>
                      {view.initialHandoff.fromAgent
                        ? `From ${view.initialHandoff.fromAgent.title} to ${view.initialHandoff.toAgent?.title ?? view.initialHandoff.order.toAgentId}`
                        : `System issued order ${view.initialHandoff.order.id} to ${view.initialHandoff.toAgent?.title ?? view.initialHandoff.order.toAgentId}`}
                    </small>
                  </div>
                  <div className="dispatch-grid">
                    <div>
                      <span className="label">Delegation order</span>
                      <strong>{view.initialHandoff.order.id}</strong>
                    </div>
                    <div>
                      <span className="label">Priority</span>
                      <strong>{view.initialHandoff.order.priority}</strong>
                    </div>
                    <div>
                      <span className="label">Issued</span>
                      <strong>{formatTimestamp(view.initialHandoff.order.issuedAt)}</strong>
                    </div>
                    <div>
                      <span className="label">Objective</span>
                      <strong>{view.initialHandoff.order.objective}</strong>
                    </div>
                  </div>
                  {view.initialHandoff.dispatchRecord ? (
                    <div className="dispatch-grid">
                      <div>
                        <span className="label">Dispatch receipt</span>
                        <strong>{view.initialHandoff.dispatchRecord.receiptId}</strong>
                      </div>
                      <div>
                        <span className="label">Runtime</span>
                        <strong>{view.initialHandoff.dispatchRecord.runtime}</strong>
                      </div>
                      <div>
                        <span className="label">Channel</span>
                        <strong>{view.initialHandoff.dispatchRecord.channel}</strong>
                      </div>
                      <div>
                        <span className="label">Latest target</span>
                        <strong>{view.initialHandoff.toAgent ? view.initialHandoff.toAgent.title : view.initialHandoff.dispatchRecord.toAgentId}</strong>
                      </div>
                      <div>
                        <span className="label">PID</span>
                        <strong>{view.initialHandoff.dispatchRecord.processPid ?? 'n/a'}</strong>
                      </div>
                      <div>
                        <span className="label">Exit code</span>
                        <strong>{view.initialHandoff.dispatchRecord.exitCode ?? 'running'}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {view.routingCandidates.length > 0 ? (
                <div>
                  <span className="label">Why this owner won</span>
                  <ul className="timeline">
                    {view.routingCandidates.map((candidate) => (
                      <li key={`route-candidate-${candidate.agent.id}`}>
                        <strong>
                          {candidate.agent.title}
                          {candidate.isSelected ? ' · selected' : ''}
                        </strong>
                        <span>Score {candidate.score.toFixed(1)} · {candidate.reasons.slice(0, 2).join(' · ') || 'No explicit reasons captured'}</span>
                        <small>{candidate.agent.name}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {view.run ? (
                <div>
                  <span className="label">Delegation actions</span>
                  <div className="examples">
                    {view.actionCandidates.map((candidate) => (
                      <button
                        type="button"
                        key={candidate.agent.id}
                        className="chip"
                        disabled={loading}
                        title={candidate.reason}
                        onClick={() => void runDelegationAction('delegate', candidate.agent.id)}
                      >
                        Delegate to {candidate.agent.title}
                      </button>
                    ))}
                    <button type="button" className="chip" disabled={loading} onClick={() => void runDelegationAction('escalate')}>
                      Escalate
                    </button>
                    <button type="button" className="chip" disabled={loading} onClick={() => void runDelegationAction('block')}>
                      Mark blocked
                    </button>
                    <button type="button" className="chip" disabled={loading} onClick={() => void runDelegationAction('complete')}>
                      Complete
                    </button>
                    <button type="button" className="chip" disabled={loading} onClick={() => void runDelegationAction('needs_input')}>
                      Need input
                    </button>
                  </div>
                  {view.actionCandidates.length > 0 ? (
                    <ul className="timeline">
                      {view.actionCandidates.map((candidate) => (
                        <li key={`candidate-${candidate.agent.id}`}>
                          <strong>{candidate.agent.title}</strong>
                          <span>{candidate.reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {view.runtimeSummary ? (
                <div>
                  <span className="label">Runtime handoff summary</span>
                  <div className={`bulk-refresh-summary tone-${view.runtimeSummary.tone}`}>
                    <strong>{view.runtimeSummary.statusLabel}</strong>
                    <small>{view.runtimeSummary.detailLabel}</small>
                    <small>{view.runtimeSummary.latestSummary}</small>
                    {view.runtimeSummary.latestWorkerSummary ? <small>Worker summary: {view.runtimeSummary.latestWorkerSummary}</small> : null}
                    {view.runtimeSummary.latestWorkerObjective ? <small>Objective: {view.runtimeSummary.latestWorkerObjective}</small> : null}
                    {runtimeSummaryExtra(view.runtimeSummary) ? <small>{runtimeSummaryExtra(view.runtimeSummary)}</small> : null}
                    {(view.runtimeSummary.latestWorkerArtifactPath || view.runtimeSummary.latestWorkerTracePath) ? (
                      <div className="artifact-list worker-proof-artifacts runtime-summary-artifacts">
                        {view.runtimeSummary.latestWorkerArtifactPath ? (
                          <span className="artifact-chip">Artifact: {view.runtimeSummary.latestWorkerArtifactPath}</span>
                        ) : null}
                        {view.runtimeSummary.latestWorkerTracePath ? (
                          <span className="artifact-chip">Trace: {view.runtimeSummary.latestWorkerTracePath}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {view.dispatchRecords.length > 0 ? (
                <div>
                  <div className="section-heading">
                    <span className="label">Runtime handoff receipts</span>
                    <button type="button" className="chip" disabled={refreshingDispatchRecordIds.length > 0} onClick={() => void refreshAllDispatchRecords()}>
                      Refresh receipts
                    </button>
                  </div>
                  {bulkRefreshSummary ? (
                    <div className={`bulk-refresh-summary tone-${bulkRefreshSummary.tone}`}>
                      <strong>{bulkRefreshSummary.message}</strong>
                      {bulkRefreshSummary.detail ? <small>{bulkRefreshSummary.detail}</small> : null}
                    </div>
                  ) : null}
                  <ul className="timeline">
                    {view.dispatchRecords.map((record) => {
                      const isRefreshing = refreshingDispatchRecordIds.includes(record.id);
                      const refreshError = dispatchRefreshErrors[record.id];
                      const refreshSuccess = dispatchRefreshSuccessIds.includes(record.id);
                      const workerSummary = buildWorkerArtifactSummary(record.artifactRefs);
                      return (
                        <li key={record.id} className={refreshSuccess ? 'dispatch-row refreshed' : 'dispatch-row'}>
                          <div className="section-heading">
                            <strong>{record.receiptId}</strong>
                            <button type="button" className="chip" disabled={isRefreshing} onClick={() => void refreshDispatchRecord(record.id)}>
                              {isRefreshing ? 'Refreshing…' : 'Refresh'}
                            </button>
                          </div>
                          <span>{record.summary}</span>
                          <small>{record.runtime} · {record.channel} · {record.status}</small>
                          <small>Log {record.logKey}</small>
                          {record.processPid != null ? <small>PID {record.processPid}</small> : null}
                          {record.launchedAt ? <small>Launched {formatTimestamp(record.launchedAt)}</small> : null}
                          {record.endedAt ? <small>Ended {formatTimestamp(record.endedAt)}</small> : null}
                          {record.exitCode != null ? <small>Exit code {record.exitCode}</small> : null}
                          {record.lastError ? <small className="error">{record.lastError}</small> : null}
                          <small>Order {record.delegationOrderId}</small>
                          {workerSummary ? (
                            <div className={`worker-proof-card tone-${workerSummaryTone(workerSummary.domain)}`}>
                              <div className="worker-proof-header">
                                <strong>{formatWorkerDomain(workerSummary.domain)} owner proof</strong>
                                {workerSummary.state ? <span>{workerSummary.state}</span> : null}
                              </div>
                              {workerSummary.summary ? <small>{workerSummary.summary}</small> : null}
                              {workerSummary.objective ? <small>Objective: {workerSummary.objective}</small> : null}
                              {(workerSummary.artifactPath || workerSummary.tracePath) ? (
                                <div className="artifact-list worker-proof-artifacts">
                                  {workerSummary.artifactPath ? (
                                    <span className="artifact-chip">Artifact: {workerSummary.artifactPath}</span>
                                  ) : null}
                                  {workerSummary.tracePath ? (
                                    <span className="artifact-chip">Trace: {workerSummary.tracePath}</span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <small className="command-preview">{record.command}</small>
                          <div className="artifact-list">
                            {record.artifactRefs.map((artifact) => (
                              <span key={`${record.id}-${artifact.label}-${artifact.value}`} className="artifact-chip">
                                {artifact.label}: {formatArtifactLabel(artifact.kind, artifact.value)}
                              </span>
                            ))}
                          </div>
                          {refreshError ? <small className="error">{refreshError}</small> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <div>
                <span className="label">Execution updates</span>
                <ul className="timeline">
                  {view.executionUpdates.map((update) => {
                    const workerSummary = buildWorkerArtifactSummary(update.artifactRefs);
                    return (
                      <li key={update.id}>
                        <strong>{update.status}</strong>
                        <span>{update.summary}</span>
                        {workerSummary ? (
                          <div className={`worker-proof-card tone-${workerSummaryTone(workerSummary.domain)}`}>
                            <div className="worker-proof-header">
                              <strong>{formatWorkerDomain(workerSummary.domain)} worker checkpoint</strong>
                              {workerSummary.state ? <span>{workerSummary.state}</span> : null}
                            </div>
                            {workerSummary.summary ? <small>{workerSummary.summary}</small> : null}
                            {workerSummary.objective ? <small>Objective: {workerSummary.objective}</small> : null}
                            {(workerSummary.artifactPath || workerSummary.tracePath) ? (
                              <div className="artifact-list worker-proof-artifacts">
                                {workerSummary.artifactPath ? (
                                  <span className="artifact-chip">Artifact: {workerSummary.artifactPath}</span>
                                ) : null}
                                {workerSummary.tracePath ? (
                                  <span className="artifact-chip">Trace: {workerSummary.tracePath}</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {update.needsInput ? <small>Needs input: {update.needsInput}</small> : null}
                        {update.blocker ? <small>Blocker: {update.blocker}</small> : null}
                        {update.artifactRefs?.length ? (
                          <div className="artifact-list">
                            {update.artifactRefs.map((artifact) => (
                              <span key={`${update.id}-${artifact.label}-${artifact.value}`} className="artifact-chip">
                                {artifact.label}: {formatArtifactLabel(artifact.kind, artifact.value)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {latestNeedsInput ? (
                <div>
                  <span className="label">Reply to current input request</span>
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    if (!replyText.trim()) return;
                    void runDelegationAction('reply_to_input', undefined, view, {
                      action: 'reply_to_input',
                      summary: replyText.trim(),
                      artifactRefs: [{ label: 'User reply', kind: 'note', value: replyText.trim() }]
                    }).then(() => setReplyText(''));
                  }}>
                    <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder={latestNeedsInput.needsInput ?? 'Reply with the missing context'} />
                    <button type="submit" disabled={loading || !replyText.trim()}>
                      Send reply
                    </button>
                  </form>
                </div>
              ) : null}
              <div>
                <span className="label">Delegation timeline</span>
                <ul className="timeline">
                  {view.events.map((event) => (
                    <li key={event.id} className={isRuntimeTransitionEvent(event) ? 'runtime-event' : undefined}>
                      <strong>{renderTimelineEventLabel(event)}</strong>
                      <span>{event.summary}</span>
                      {renderTimelineEventDetail(event) ? <small>{renderTimelineEventDetail(event)}</small> : null}
                      <small>{formatTimestamp(event.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <aside className="card sidebar">
          <div className="section-heading">
            <h2>Recent intents</h2>
            {sidebarLoading ? <small>Refreshing…</small> : null}
          </div>
          <ul className="intent-list">
            {recentIntents.map((item) => {
              const isActive = item.intent.id === selectedIntentId;
              const inboxRefresh = inboxRefreshSummaries[item.intent.id];
              return (
                <li key={item.intent.id}>
                  <button type="button" className={isActive ? 'intent-row active' : 'intent-row'} onClick={() => void loadIntent(item.intent.id)}>
                    <div className="intent-row-top">
                      <strong>{item.inboxRoutingSummary?.ownerLabel ?? item.selectedAgent?.title ?? 'No owner selected'}</strong>
                      <small>{formatTimestamp(item.intent.createdAt)}</small>
                    </div>
                    <span>{item.intent.text}</span>
                    {item.inboxRoutingSummary?.supportLabel ? <small>{item.inboxRoutingSummary.supportLabel}</small> : null}
                    {item.inboxRoutingSummary?.label ? <small>{item.inboxRoutingSummary.label}</small> : null}
                    {item.inboxRoutingSummary?.detail ? <small>{item.inboxRoutingSummary.detail}</small> : null}
                    {item.inboxRoutingSummary?.stateLabel || item.inboxRoutingSummary?.actionabilityLabel ? (
                      <small>{[item.inboxRoutingSummary?.stateLabel, item.inboxRoutingSummary?.actionabilityLabel].filter(Boolean).join(' · ')}</small>
                    ) : null}
                    {item.runtimeSummary ? (
                      <>
                        <small>
                          {item.runtimeSummary.statusLabel}
                          {runtimeSummaryExtra(item.runtimeSummary) ? ` · ${runtimeSummaryExtra(item.runtimeSummary)}` : ''}
                        </small>
                        {item.runtimeSummary.latestWorkerSummary ? (
                          <small className="runtime-worker-inline">
                            {item.runtimeSummary.latestWorkerSummary}
                          </small>
                        ) : null}
                        {(item.runtimeSummary.latestWorkerArtifactPath || item.runtimeSummary.latestWorkerTracePath) ? (
                          <small className="runtime-worker-inline">
                            {item.runtimeSummary.latestWorkerArtifactPath ? `Artifact ${item.runtimeSummary.latestWorkerArtifactPath}` : ''}
                            {item.runtimeSummary.latestWorkerArtifactPath && item.runtimeSummary.latestWorkerTracePath ? ' · ' : ''}
                            {item.runtimeSummary.latestWorkerTracePath ? `Trace ${item.runtimeSummary.latestWorkerTracePath}` : ''}
                          </small>
                        ) : null}
                      </>
                    ) : null}
                    {inboxRefresh ? <small className={`refresh-inline tone-${inboxRefresh.tone}`}>{inboxRefresh.message}</small> : null}
                    <div className="badge-row">
                      {(item.inboxBadges ?? []).map((badge) => (
                        <span key={`${item.intent.id}-${badge.label}`} className={`badge tone-${badge.tone}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <section className="card export-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Portable trace</p>
            <h2>IDP export</h2>
          </div>
          <div className="export-actions">
            <button type="button" className="chip" onClick={() => void copyIdpExport()} disabled={!idpExport}>
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy JSON'}
            </button>
            <button type="button" className="chip" onClick={downloadIdpExport} disabled={!idpExport}>
              Download
            </button>
          </div>
        </div>
        {!view || !idpExportPayload ? (
          <p className="muted">Route an intent to inspect the machine-readable delegation protocol export.</p>
        ) : (
          <>
            <div className="result-grid export-summary-grid">
              {exportSummary?.map((entry) => (
                <div key={entry.label}>
                  <span className="label">{entry.label}</span>
                  <strong>{entry.value}</strong>
                </div>
              ))}
            </div>
            <pre className="export-panel" tabIndex={0} onKeyDown={handleExportKeydown}>{idpExport}</pre>
          </>
        )}
      </section>
    </div>
  );
}

export default App;
