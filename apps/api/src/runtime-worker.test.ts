import { existsSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('runtime worker entrypoint', () => {
  it('writes richer artifact and trace fields for downstream refresh consumers', () => {
    const workspaceRoot = join(process.cwd(), '..', '..');
    const apiRoot = join(workspaceRoot, 'apps/api');
    const root = mkdtempSync(join(tmpdir(), 'good-intent-worker-'));
    const outputPath = join(root, 'run_test', 'order_test.json');
    mkdirSync(dirname(outputPath), { recursive: true });

    const payload = JSON.stringify({
      intentId: 'intent_test',
      runId: 'run_test',
      orderId: 'order_test',
      agentId: 'agent_infra',
      objective: 'Fix the broken deploy on production',
      outputPath
    }).replace(/'/g, `'"'"'`);

    execSync(`${process.execPath} ${join(apiRoot, 'src/runtime-worker.ts')} '${payload}'`, {
      cwd: apiRoot,
      stdio: 'pipe'
    });

    const updatePayload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      status: string;
      summary: string;
      artifacts: Array<{ label: string; value: string }>;
      artifactPath?: string;
    };

    expect(updatePayload.status).toBe('completed');
    expect(updatePayload.summary).toContain('Worker completed initial handoff artifact');
    expect(updatePayload.artifacts.some((artifact) => artifact.label === 'Worker domain' && artifact.value === 'infrastructure')).toBe(true);
    expect(updatePayload.artifacts.some((artifact) => artifact.label === 'Worker summary' && artifact.value.includes('owns the first pass'))).toBe(true);
    expect(updatePayload.artifacts.some((artifact) => artifact.label === 'Worker trace file')).toBe(true);
    expect(updatePayload.artifactPath && existsSync(updatePayload.artifactPath)).toBe(true);

    const tracePath = updatePayload.artifacts.find((artifact) => artifact.label === 'Worker trace file')?.value;
    expect(tracePath && existsSync(tracePath)).toBe(true);
    const tracePayload = JSON.parse(readFileSync(tracePath!, 'utf8')) as { inferredDomain: string; checkpoints: Array<{ state: string }> };
    expect(tracePayload.inferredDomain).toBe('infrastructure');
    expect(tracePayload.checkpoints.map((checkpoint) => checkpoint.state)).toContain('artifact_generated');
  });
});
