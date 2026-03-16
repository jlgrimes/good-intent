export type AgentStatus = 'active' | 'paused' | 'terminated';
export type RoutingMode = 'direct' | 'manager_first' | 'org_top' | 'clarify';
export type IntentStatus = 'pending' | 'routed' | 'running' | 'blocked' | 'done';
export type DelegationRunStatus = 'queued' | 'running' | 'blocked' | 'done' | 'cancelled';
export type DelegationEventType =
  | 'intent.created'
  | 'intent.routed'
  | 'run.dispatched'
  | 'run.delegated'
  | 'run.escalated'
  | 'run.blocked'
  | 'run.completed'
  | 'run.needs_input'
  | 'run.input_received'
  | 'intent.clarification_requested';

export type ExecutionUpdateStatus = 'queued' | 'running' | 'blocked' | 'done' | 'needs_input';
export type DelegationActionType = 'delegate' | 'escalate' | 'block' | 'complete' | 'needs_input' | 'reply_to_input';

export interface ArtifactRef {
  label: string;
  kind: 'url' | 'file' | 'note' | 'command';
  value: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  title: string;
  reportsTo: string | null;
  capabilities: string[];
  status: AgentStatus;
}

export interface IntentInput {
  text: string;
  urgency?: 'low' | 'normal' | 'high';
  project?: string;
  constraints?: string[];
}

export interface Intent extends IntentInput {
  id: string;
  status: IntentStatus;
  createdAt: string;
}

export interface RoutingCandidate {
  agentId: string;
  agentName: string;
  score: number;
  reasons: string[];
}

export interface RoutingDecision {
  id: string;
  intentId: string;
  selectedAgentId: string | null;
  routingMode: RoutingMode;
  confidence: number;
  reasoningSummary: string;
  candidateSnapshot: RoutingCandidate[];
  createdAt: string;
}

export interface DelegationRun {
  id: string;
  intentId: string;
  currentAgentId: string | null;
  status: DelegationRunStatus;
  rootRoutingDecisionId: string;
  createdAt: string;
  updatedAt: string;
}

export type DispatchRecordStatus = 'queued' | 'running' | 'completed' | 'error';

export interface DispatchRecord {
  id: string;
  delegationOrderId: string;
  delegationRunId: string;
  intentId: string;
  toAgentId: string;
  runtime: 'command-runtime' | 'stub-runtime';
  channel: string;
  status: DispatchRecordStatus;
  receiptId: string;
  summary: string;
  command: string;
  logKey: string;
  artifactRefs: ArtifactRef[];
  dispatchedAt: string;
  launchedAt?: string | null;
  endedAt?: string | null;
  processPid?: number | null;
  exitCode?: number | null;
  lastError?: string | null;
}

export interface DelegationOrder {
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
}

export interface DelegationEvent {
  id: string;
  delegationRunId: string;
  type: DelegationEventType;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  delegationOrderId?: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionUpdate {
  id: string;
  delegationRunId: string;
  dispatchRecordId?: string | null;
  agentId?: string | null;
  status: ExecutionUpdateStatus;
  summary: string;
  progress?: number | null;
  blocker?: string | null;
  needsInput?: string | null;
  artifactRefs?: ArtifactRef[];
  createdAt: string;
}

export interface DelegationActionCandidate {
  agent: Agent;
  reason: string;
  quickLabel?: string;
}

export interface RoutingCandidateView {
  agent: Agent;
  score: number;
  reasons: string[];
  isSelected: boolean;
}

export interface RuntimeDispatchSummary {
  totalCount: number;
  latestStatus: DispatchRecordStatus | 'idle';
  latestSummary: string;
  latestRuntime: DispatchRecord['runtime'] | null;
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
}

export interface InitialHandoffView {
  order: DelegationOrder;
  toAgent: Agent | null;
  fromAgent: Agent | null;
  dispatchRecord: DispatchRecord | null;
}

export interface RouteIntentResult {
  decision: RoutingDecision;
  selectedAgent: Agent | null;
  run: DelegationRun | null;
  events: DelegationEvent[];
}

export interface RoutingModeDisplay {
  mode: RoutingMode;
  badgeLabel: string;
  headline: string;
  hint: string;
  confidenceLabel: string;
  confidenceTone: 'high' | 'medium' | 'low';
}

export interface InboxBadge {
  label: string;
  tone: 'neutral' | 'high' | 'medium' | 'low';
}

export interface InboxRoutingSummary {
  label: string;
  detail: string;
  tone?: 'neutral' | 'direct' | 'manager' | 'org_top' | 'clarify';
  ownerLabel?: string;
  supportLabel?: string;
  stateLabel?: string;
  actionabilityLabel?: string;
}

export interface IntentView {
  intent: Intent;
  decision: RoutingDecision | null;
  selectedAgent: Agent | null;
  run: DelegationRun | null;
  orders: DelegationOrder[];
  dispatchRecords: DispatchRecord[];
  initialHandoff?: InitialHandoffView;
  runtimeSummary?: RuntimeDispatchSummary;
  events: DelegationEvent[];
  executionUpdates: ExecutionUpdate[];
  actionCandidates: DelegationActionCandidate[];
  routingCandidates: RoutingCandidateView[];
  modeDisplay?: RoutingModeDisplay;
  inboxBadges?: InboxBadge[];
  inboxRoutingSummary?: InboxRoutingSummary;
}

export interface DispatchRecordHistory {
  dispatchRecords: DispatchRecord[];
}

export interface DispatchRefreshSummary {
  requestedCount: number;
  refreshedCount: number;
  successCount: number;
  errorCount: number;
  unchangedCount: number;
  statuses: Partial<Record<DispatchRecordStatus, number>>;
}

export interface BulkDispatchRefreshResult {
  dispatchRecords: DispatchRecord[];
  summary: DispatchRefreshSummary;
}

export interface DelegationActionInput {
  action: DelegationActionType;
  toAgentId?: string;
  summary?: string;
  needsInput?: string;
  artifactRefs?: ArtifactRef[];
}

export interface PersistedState {
  agents: Agent[];
  intents: Intent[];
  routingDecisions: RoutingDecision[];
  delegationRuns: DelegationRun[];
  delegationOrders: DelegationOrder[];
  dispatchRecords: DispatchRecord[];
  delegationEvents: DelegationEvent[];
  executionUpdates: ExecutionUpdate[];
}
