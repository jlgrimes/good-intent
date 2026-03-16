import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

type WorkerPayload = {
  intentId: string;
  runId: string;
  orderId: string;
  agentId: string;
  objective: string;
  outputPath: string;
};

type WorkerArtifact = {
  label: string;
  kind: 'note' | 'file';
  value: string;
};

type WorkerUpdate = {
  status: 'running' | 'completed' | 'error';
  summary: string;
  progress: number;
  artifacts: WorkerArtifact[];
  startedAt: string;
  completedAt?: string;
  artifactPath?: string;
  error?: string;
};

function writeUpdate(path: string, update: WorkerUpdate) {
  writeFileSync(path, JSON.stringify(update), 'utf8');
}

function main() {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error('Missing worker payload JSON argument.');
  }

  const payload = JSON.parse(raw) as WorkerPayload;
  const startedAt = new Date().toISOString();
  const safeObjective = payload.objective.trim().replace(/\s+/g, ' ').slice(0, 160);
  const artifactPath = payload.outputPath.replace(/\.json$/i, '.md');
  const tracePath = payload.outputPath.replace(/\.json$/i, '.trace.json');
  const objectiveTokens = safeObjective.toLowerCase();
  const inferredDomain = objectiveTokens.includes('deploy') || objectiveTokens.includes('infra')
    ? 'infrastructure'
    : objectiveTokens.includes('copy') || objectiveTokens.includes('hero') || objectiveTokens.includes('design')
      ? 'design'
      : objectiveTokens.includes('onboarding') || objectiveTokens.includes('conversion') || objectiveTokens.includes('growth')
        ? 'growth'
        : 'general';

  mkdirSync(dirname(payload.outputPath), { recursive: true });
  mkdirSync(dirname(artifactPath), { recursive: true });

  writeUpdate(payload.outputPath, {
    status: 'running',
    summary: `Worker accepted ${payload.agentId}'s delegation order and is preparing an artifact.`,
    progress: 0.35,
    startedAt,
    artifacts: [
      {
        label: 'Worker objective',
        kind: 'note',
        value: safeObjective
      },
      {
        label: 'Worker state',
        kind: 'note',
        value: 'accepted delegation order'
      },
      {
        label: 'Worker domain',
        kind: 'note',
        value: inferredDomain
      },
      {
        label: 'Worker trace file',
        kind: 'file',
        value: tracePath
      }
    ]
  });

  const artifactBody = [
    `# Worker handoff artifact`,
    '',
    `- intent: ${payload.intentId}`,
    `- run: ${payload.runId}`,
    `- order: ${payload.orderId}`,
    `- agent: ${payload.agentId}`,
    `- objective: ${safeObjective}`,
    `- inferred-domain: ${inferredDomain}`,
    '',
    '## Suggested owner-facing summary',
    `- ${payload.agentId} accepted the delegation order automatically.`,
    `- The worker classified this as ${inferredDomain} work.`,
    '- A compact artifact and machine-readable trace were written for downstream inspection.',
    '',
    '## Simulated progress notes',
    '- Worker accepted the delegation order.',
    '- Worker generated a compact artifact for trace proof.',
    '- Worker is ready for richer real-runtime integration next.'
  ].join('\n');

  writeFileSync(artifactPath, artifactBody, 'utf8');
  writeFileSync(tracePath, JSON.stringify({
    intentId: payload.intentId,
    runId: payload.runId,
    orderId: payload.orderId,
    agentId: payload.agentId,
    objective: safeObjective,
    inferredDomain,
    checkpoints: [
      { at: startedAt, state: 'accepted' },
      { at: new Date().toISOString(), state: 'artifact_generated' }
    ]
  }, null, 2), 'utf8');

  const update: WorkerUpdate = {
    status: 'completed',
    summary: `Worker completed initial handoff artifact for ${payload.agentId}.`,
    progress: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    artifactPath,
    artifacts: [
      {
        label: 'Worker artifact',
        kind: 'file',
        value: artifactPath
      },
      {
        label: 'Worker trace file',
        kind: 'file',
        value: tracePath
      },
      {
        label: 'Worker objective',
        kind: 'note',
        value: safeObjective
      },
      {
        label: 'Worker state',
        kind: 'note',
        value: 'artifact generated'
      },
      {
        label: 'Worker domain',
        kind: 'note',
        value: inferredDomain
      },
      {
        label: 'Worker summary',
        kind: 'note',
        value: `${payload.agentId} owns the first pass for this ${inferredDomain} request.`
      }
    ]
  };

  writeUpdate(payload.outputPath, update);
}

main();
