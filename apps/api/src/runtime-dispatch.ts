import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArtifactRef, DelegationOrder, DelegationRun, Agent, DispatchRecord, DispatchRecordStatus } from '@good-intent/shared';

export type DispatchReceipt = {
  runtime: 'command-runtime' | 'stub-runtime';
  channel: string;
  dispatchedAt: string;
  status: DispatchRecordStatus;
  receiptId: string;
  summary: string;
  command: string;
  logKey: string;
  artifactRefs: ArtifactRef[];
  launchedAt?: string | null;
  endedAt?: string | null;
  processPid?: number | null;
  exitCode?: number | null;
  lastError?: string | null;
};

export type RuntimeDispatchRequest = {
  order: DelegationOrder;
  run: DelegationRun;
  targetAgent: Agent;
};

export type DispatchRefresh = {
  status: DispatchRecordStatus;
  summary: string;
  progress?: number;
  launchedAt?: string | null;
  endedAt?: string | null;
  processPid?: number | null;
  exitCode?: number | null;
  lastError?: string | null;
  artifactRefs?: ArtifactRef[];
};

export type RuntimeDispatcher = {
  dispatch(input: RuntimeDispatchRequest): DispatchReceipt;
  refresh?(record: DispatchRecord): DispatchRefresh | null;
};

export type CommandRuntimeOptions = {
  binary?: string;
  channel?: string;
  logNamespace?: string;
  launchMode?: 'queued' | 'running' | 'error';
  launchErrorMessage?: string;
  refreshMode?: 'inherit' | 'running' | 'completed' | 'error';
  refreshErrorMessage?: string;
  spawnMode?: 'synthetic' | 'process';
  processCommand?: string;
};

type WorkerUpdateFile = {
  status: 'running' | 'completed' | 'error';
  summary: string;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  artifactPath?: string;
  artifacts?: ArtifactRef[];
  error?: string;
};

const runtimeWorkerPath = fileURLToPath(new URL('./runtime-worker.ts', import.meta.url));
const runtimeArtifactsRoot = resolve(process.cwd(), 'data/runtime-artifacts');

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `"'"'`)}'`;
}

function buildDispatchArtifacts(input: RuntimeDispatchRequest, command: string, receiptId: string, logKey: string, launchArtifacts: ArtifactRef[]) {
  return [
    {
      label: 'Dispatch receipt',
      kind: 'note' as const,
      value: receiptId
    },
    {
      label: 'Runtime target',
      kind: 'note' as const,
      value: `${input.targetAgent.id} (${input.targetAgent.title})`
    },
    {
      label: 'Dispatch command',
      kind: 'command' as const,
      value: command
    },
    {
      label: 'Runtime log stream',
      kind: 'url' as const,
      value: logKey
    },
    ...launchArtifacts
  ];
}

function launchProcess(command: string): number {
  const child = spawn('/bin/sh', ['-lc', command], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  if (typeof child.pid !== 'number') {
    throw new Error('Runtime process launch did not return a PID.');
  }

  return child.pid;
}

function upsertArtifact(artifactRefs: ArtifactRef[], label: string, kind: ArtifactRef['kind'], value: string) {
  const next = artifactRefs.filter((artifact) => artifact.label !== label);
  next.push({ label, kind, value });
  return next;
}

function removeArtifacts(artifactRefs: ArtifactRef[], labels: string[]) {
  const blocked = new Set(labels);
  return artifactRefs.filter((artifact) => !blocked.has(artifact.label));
}

function readProcessExitCode(pid: number) {
  const statusPath = `/proc/${pid}/status`;
  if (!existsSync(statusPath)) {
    return 0;
  }

  const statusText = readFileSync(statusPath, 'utf8');
  if (/^State:\s+Z/m.test(statusText)) {
    return 0;
  }

  return null;
}

function makeWorkerUpdatePath(runId: string, orderId: string) {
  return resolve(runtimeArtifactsRoot, runId, `${orderId}.json`);
}

function readWorkerUpdate(logKey: string): WorkerUpdateFile | null {
  const prefix = 'worker://';
  if (!logKey.startsWith(prefix)) {
    return null;
  }

  const outputPath = logKey.slice(prefix.length);
  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8')) as WorkerUpdateFile;
    return parsed;
  } catch {
    return null;
  }
}

export function createCommandRuntimeDispatcher(options: CommandRuntimeOptions = {}): RuntimeDispatcher {
  const binary = options.binary ?? process.env.GOOD_INTENT_RUNTIME_BIN ?? 'good-intent-runtime';
  const channel = options.channel ?? process.env.GOOD_INTENT_RUNTIME_CHANNEL ?? 'delegation-orders';
  const logNamespace = options.logNamespace ?? process.env.GOOD_INTENT_RUNTIME_LOG_NAMESPACE ?? 'command-runtime';
  const launchMode = options.launchMode ?? (process.env.GOOD_INTENT_RUNTIME_LAUNCH_MODE as CommandRuntimeOptions['launchMode'] | undefined) ?? 'running';
  const launchErrorMessage = options.launchErrorMessage ?? process.env.GOOD_INTENT_RUNTIME_LAUNCH_ERROR ?? 'Runtime launch failed before worker start.';
  const refreshMode = options.refreshMode ?? (process.env.GOOD_INTENT_RUNTIME_REFRESH_MODE as CommandRuntimeOptions['refreshMode'] | undefined) ?? 'inherit';
  const refreshErrorMessage = options.refreshErrorMessage ?? process.env.GOOD_INTENT_RUNTIME_REFRESH_ERROR ?? 'Runtime reported a terminal launch error.';
  const spawnMode = options.spawnMode ?? (process.env.GOOD_INTENT_RUNTIME_SPAWN_MODE as CommandRuntimeOptions['spawnMode'] | undefined) ?? 'synthetic';
  const processCommand = options.processCommand ?? process.env.GOOD_INTENT_RUNTIME_PROCESS_COMMAND ?? 'sleep 2';

  return {
    dispatch(input) {
      const dispatchedAt = new Date().toISOString();
      const receiptId = `receipt_${input.order.id}`;
      const objectiveSlug = makeSlug(input.order.objective) || 'delegation-order';
      const dispatchCommand = [
        shellQuote(binary),
        '--agent',
        shellQuote(input.targetAgent.id),
        '--run',
        shellQuote(input.run.id),
        '--order',
        shellQuote(input.order.id),
        '--objective',
        shellQuote(input.order.objective)
      ].join(' ');

      const runtime: DispatchReceipt['runtime'] = binary === 'good-intent-runtime' && spawnMode !== 'process' ? 'stub-runtime' : 'command-runtime';
      let status: DispatchRecordStatus = launchMode === 'error' ? 'error' : launchMode === 'running' ? 'running' : 'queued';
      let launchedAt: string | null = status === 'running' ? new Date().toISOString() : null;
      let endedAt: string | null = null;
      let processPid: number | null = null;
      let exitCode: number | null = status === 'error' ? 1 : null;
      let lastError: string | null = status === 'error' ? launchErrorMessage : null;
      let logKey = `${logNamespace}://${input.run.id}/${input.order.id}/${objectiveSlug}`;
      let launchArtifacts: ArtifactRef[] = [];

      if (spawnMode === 'process') {
        const outputPath = makeWorkerUpdatePath(input.run.id, input.order.id);
        mkdirSync(dirname(outputPath), { recursive: true });
        const payload = JSON.stringify({
          intentId: input.order.intentId,
          runId: input.run.id,
          orderId: input.order.id,
          agentId: input.targetAgent.id,
          objective: input.order.objective,
          outputPath
        });
        const launchedCommand = `${shellQuote(binary)} ${shellQuote(runtimeWorkerPath)} ${shellQuote(payload)} >/dev/null 2>&1`;
        try {
          const pid = launchProcess(launchedCommand);
          processPid = pid;
          status = 'running';
          launchedAt = new Date().toISOString();
          endedAt = null;
          exitCode = null;
          lastError = null;
          logKey = `worker://${outputPath}`;
          launchArtifacts = [
            {
              label: 'Runtime process pid',
              kind: 'note',
              value: String(pid)
            },
            {
              label: 'Runtime process command',
              kind: 'command',
              value: launchedCommand
            },
            {
              label: 'Runtime update file',
              kind: 'file',
              value: outputPath
            },
            {
              label: 'Runtime launch timestamp',
              kind: 'note',
              value: launchedAt
            }
          ];
        } catch (error) {
          status = 'error';
          launchedAt = null;
          endedAt = new Date().toISOString();
          exitCode = 1;
          lastError = error instanceof Error ? error.message : launchErrorMessage;
          launchArtifacts = [{
            label: 'Runtime launch error',
            kind: 'note',
            value: lastError
          }];
        }
      } else if (launchedAt) {
        launchArtifacts = [{
          label: 'Runtime launch timestamp',
          kind: 'note',
          value: launchedAt
        }];
      } else if (status === 'error') {
        endedAt = new Date().toISOString();
        launchArtifacts = [{
          label: 'Runtime launch error',
          kind: 'note',
          value: lastError ?? launchErrorMessage
        }];
      }

      if (endedAt) {
        launchArtifacts = upsertArtifact(launchArtifacts, 'Runtime ended timestamp', 'note', endedAt);
      }
      if (processPid != null) {
        launchArtifacts = upsertArtifact(launchArtifacts, 'Runtime process pid', 'note', String(processPid));
      }
      if (exitCode != null) {
        launchArtifacts = upsertArtifact(launchArtifacts, 'Runtime exit code', 'note', String(exitCode));
      }

      const summary =
        status === 'running'
          ? `Launched handoff to ${input.targetAgent.title} via ${binary}.`
          : status === 'error'
            ? `Failed to launch handoff to ${input.targetAgent.title} via ${binary}.`
            : `Queued handoff to ${input.targetAgent.title} via ${binary}.`;

      return {
        runtime,
        channel,
        dispatchedAt,
        status,
        receiptId,
        summary,
        command: dispatchCommand,
        logKey,
        launchedAt,
        endedAt,
        processPid,
        exitCode,
        lastError,
        artifactRefs: buildDispatchArtifacts(input, dispatchCommand, receiptId, logKey, launchArtifacts)
      };
    },
    refresh(record) {
      const workerUpdate = readWorkerUpdate(record.logKey);
      if (workerUpdate) {
        let artifactRefs = removeArtifacts(record.artifactRefs, ['Runtime refresh status', 'Runtime refresh error', 'Runtime ended timestamp', 'Runtime exit code']);
        artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh status', 'note', workerUpdate.status);
        if (workerUpdate.artifactPath) {
          artifactRefs = upsertArtifact(artifactRefs, 'Worker artifact', 'file', workerUpdate.artifactPath);
        }
        for (const artifact of workerUpdate.artifacts ?? []) {
          artifactRefs = upsertArtifact(artifactRefs, artifact.label, artifact.kind, artifact.value);
        }
        if (workerUpdate.completedAt) {
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime ended timestamp', 'note', workerUpdate.completedAt);
        }
        if (workerUpdate.error) {
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh error', 'note', workerUpdate.error);
        }

        return {
          status: workerUpdate.status,
          summary: workerUpdate.summary,
          progress: workerUpdate.progress,
          launchedAt: workerUpdate.startedAt ?? record.launchedAt ?? null,
          endedAt: workerUpdate.completedAt ?? (workerUpdate.status === 'completed' || workerUpdate.status === 'error' ? new Date().toISOString() : null),
          processPid: record.processPid ?? null,
          exitCode: workerUpdate.status === 'completed' ? 0 : workerUpdate.status === 'error' ? 1 : null,
          lastError: workerUpdate.error ?? null,
          artifactRefs
        };
      }

      if (record.logKey.startsWith('process://')) {
        const pid = Number(record.logKey.slice('process://'.length));
        if (!Number.isFinite(pid)) {
          return {
            status: 'error',
            summary: `Runtime process metadata for ${record.toAgentId} is invalid.`,
            launchedAt: record.launchedAt ?? null,
            endedAt: new Date().toISOString(),
            processPid: record.processPid ?? null,
            exitCode: 1,
            lastError: 'Invalid process pid in runtime log key.',
            artifactRefs: upsertArtifact(
              removeArtifacts(record.artifactRefs, ['Runtime refresh status', 'Runtime refresh error', 'Runtime ended timestamp', 'Runtime exit code']),
              'Runtime refresh error',
              'note',
              'Invalid process pid in runtime log key.'
            )
          };
        }

        try {
          process.kill(pid, 0);
          let artifactRefs = removeArtifacts(record.artifactRefs, ['Runtime refresh status', 'Runtime refresh error', 'Runtime ended timestamp', 'Runtime exit code']);
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh status', 'note', 'running');
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime process pid', 'note', String(pid));
          return {
            status: 'running',
            summary: `Runtime process ${pid} is still handling the handoff for ${record.toAgentId}.`,
            launchedAt: record.launchedAt ?? null,
            endedAt: null,
            processPid: pid,
            exitCode: null,
            lastError: null,
            artifactRefs
          };
        } catch {
          const endedAt = new Date().toISOString();
          const exitCode = readProcessExitCode(pid);
          let artifactRefs = removeArtifacts(record.artifactRefs, ['Runtime refresh status', 'Runtime refresh error']);
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh status', 'note', 'completed');
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime process pid', 'note', String(pid));
          artifactRefs = upsertArtifact(artifactRefs, 'Runtime ended timestamp', 'note', endedAt);
          if (exitCode != null) {
            artifactRefs = upsertArtifact(artifactRefs, 'Runtime exit code', 'note', String(exitCode));
          }
          return {
            status: 'completed',
            summary: `Runtime process ${pid} completed the handoff for ${record.toAgentId}.`,
            launchedAt: record.launchedAt ?? null,
            endedAt,
            processPid: pid,
            exitCode,
            lastError: null,
            artifactRefs
          };
        }
      }

      const mode = refreshMode === 'inherit' ? record.status : refreshMode;
      const launchedAt = mode === 'queued' || mode === 'error' ? record.launchedAt ?? null : record.launchedAt ?? new Date().toISOString();
      const endedAt = mode === 'completed' || mode === 'error' ? record.endedAt ?? new Date().toISOString() : null;
      const exitCode = mode === 'completed' ? record.exitCode ?? 0 : mode === 'error' ? record.exitCode ?? 1 : null;
      const summary =
        mode === 'completed'
          ? `Runtime completed handoff for ${record.toAgentId} via ${binary}.`
          : mode === 'error'
            ? `Runtime failed handoff for ${record.toAgentId} via ${binary}.`
            : mode === 'running'
              ? `Runtime confirms ${record.toAgentId} is actively handling the handoff via ${binary}.`
              : record.summary;
      let artifactRefs: ArtifactRef[] = removeArtifacts(record.artifactRefs, ['Runtime refresh status', 'Runtime refresh error', 'Runtime ended timestamp', 'Runtime exit code']);
      artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh status', 'note', mode);

      if (endedAt) {
        artifactRefs = upsertArtifact(artifactRefs, 'Runtime ended timestamp', 'note', endedAt);
      }
      if (record.processPid != null) {
        artifactRefs = upsertArtifact(artifactRefs, 'Runtime process pid', 'note', String(record.processPid));
      }
      if (exitCode != null) {
        artifactRefs = upsertArtifact(artifactRefs, 'Runtime exit code', 'note', String(exitCode));
      }
      if (mode === 'error') {
        artifactRefs = upsertArtifact(artifactRefs, 'Runtime refresh error', 'note', refreshErrorMessage);
      }

      return {
        status: mode,
        summary,
        launchedAt,
        endedAt,
        processPid: record.processPid ?? null,
        exitCode,
        lastError: mode === 'error' ? refreshErrorMessage : null,
        artifactRefs
      };
    }
  };
}

let defaultDispatcher: RuntimeDispatcher | null = null;

export function getDefaultRuntimeDispatcher() {
  if (!defaultDispatcher) {
    defaultDispatcher = createCommandRuntimeDispatcher();
  }
  return defaultDispatcher;
}

export function setDefaultRuntimeDispatcher(dispatcher: RuntimeDispatcher | null) {
  defaultDispatcher = dispatcher;
}
