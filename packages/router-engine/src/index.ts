import type { Agent, IntentInput, RouteIntentResult, RoutingCandidate, RoutingDecision, RoutingMode } from '@good-intent/shared';

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  infrastructure: ['deploy', 'deployment', 'infra', 'server', 'build', 'ci', 'cd', 'pipeline', 'observability', 'metrics', 'logs', 'hosting', 'docker', 'kubernetes', 'ssl', 'dns', 'production'],
  engineering: ['bug', 'fix', 'api', 'auth', 'oauth', 'backend', 'frontend', 'feature', 'refactor', 'database', 'schema', 'typescript', 'react', 'app'],
  design: ['design', 'ux', 'ui', 'copy', 'hero', 'landing page', 'visual', 'brand', 'layout', 'homepage'],
  growth: ['growth', 'activation', 'onboarding', 'conversion', 'funnel', 'retention', 'experiment', 'signup', 'acquisition'],
  product: ['roadmap', 'prioritize', 'spec', 'flow', 'product', 'user problem', 'requirements'],
  strategy: ['strategy', 'plan', 'tradeoff', 'direction', 'org', 'who should own', 'next move', 'decide'],
  research: ['research', 'compare', 'analyze', 'investigate', 'benchmark', 'explore', 'figure out']
};

const ROLE_PRIORS: Record<string, Partial<Record<keyof typeof DOMAIN_KEYWORDS, number>>> = {
  ceo: { strategy: 2.4, product: 1.2, research: 1.2 },
  cto: { infrastructure: 2.2, engineering: 1.5, strategy: 0.8, research: 0.6 },
  infra_engineer: { infrastructure: 2.8, engineering: 0.8 },
  product_engineer: { engineering: 2.8, infrastructure: 0.7 },
  designer: { design: 3, growth: 0.6 },
  growth_lead: { growth: 3, product: 1.4, research: 0.8 }
};

function normalize(text: string) {
  return text.toLowerCase();
}

function countMatches(text: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
}

function classify(text: string) {
  const normalized = normalize(text);
  const domainHits = Object.entries(DOMAIN_KEYWORDS).map(([domain, keywords]) => ({
    domain,
    hits: countMatches(normalized, keywords)
  }));
  const activeDomains = domainHits.filter((item) => item.hits > 0);
  const broad = /figure out|what should we do|plan|strategy|why .* dropped|why .* fell|investigate/.test(normalized);
  const ambiguous = activeDomains.length === 0 || /(that|this) weird thing|from earlier|handle that/.test(normalized);
  return { normalized, domainHits, activeDomains, broad, ambiguous };
}

function scoreAgent(agent: Agent, text: string, broad: boolean, domainHits: { domain: string; hits: number }[]): RoutingCandidate {
  let score = 0;
  const reasons: string[] = [];

  for (const { domain, hits } of domainHits) {
    if (!hits) continue;
    const prior = ROLE_PRIORS[agent.role]?.[domain as keyof typeof DOMAIN_KEYWORDS] ?? 0;
    if (prior > 0) {
      score += prior * hits;
      reasons.push(`${domain} role prior`);
    }
    const capabilityMatches = agent.capabilities.filter((capability) => text.includes(capability.toLowerCase()));
    if (capabilityMatches.length > 0) {
      score += capabilityMatches.length * 1.6;
      reasons.push(`capability match: ${capabilityMatches.join(', ')}`);
    }
  }

  if (broad) {
    if (agent.role === 'ceo' || agent.role === 'cto' || agent.role === 'growth_lead') {
      score += 1.2;
      reasons.push('broad task manager bias');
    }
  } else if (agent.role === 'infra_engineer' || agent.role === 'product_engineer' || agent.role === 'designer') {
    score += 0.4;
    reasons.push('execution specialist bias');
  }

  if (agent.status !== 'active') {
    score -= 100;
    reasons.push('inactive');
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    score,
    reasons
  };
}

function decideMode(topScore: number, secondScore: number, broad: boolean, ambiguous: boolean): { mode: RoutingMode; confidence: number } {
  if (ambiguous && topScore < 2) {
    return { mode: 'clarify', confidence: 0.35 };
  }

  const gap = Math.max(0, topScore - secondScore);
  const baseConfidence = Math.min(0.98, 0.45 + topScore / 10 + gap / 8);

  if (baseConfidence >= 0.8 && !broad) {
    return { mode: 'direct', confidence: baseConfidence };
  }

  if (baseConfidence < 0.55) {
    return { mode: 'clarify', confidence: baseConfidence };
  }

  return { mode: broad ? 'org_top' : 'manager_first', confidence: baseConfidence };
}

function buildExplanation(agent: Agent | null, mode: RoutingMode, text: string, domains: string[]) {
  if (!agent) {
    return 'Clarification required because the request is too underspecified to route responsibly.';
  }

  const lead = domains[0] ?? 'general';
  if (mode === 'org_top') {
    return `Routed to ${agent.title} because this request is broad or cross-functional and needs top-level delegation around ${lead}.`;
  }
  if (mode === 'manager_first') {
    return `Routed to ${agent.title} because the request clusters around ${lead} but is broad enough to benefit from manager-led delegation.`;
  }
  return `Routed to ${agent.title} because this request most strongly matches ${lead} work they are equipped to own.`;
}

export function routeIntent(input: IntentInput, agents: Agent[]): Omit<RouteIntentResult, 'decision' | 'run' | 'events'> & { decisionDraft: Omit<RoutingDecision, 'id' | 'intentId' | 'createdAt'> } {
  const classification = classify(input.text);
  const candidates = agents
    .map((agent) => scoreAgent(agent, classification.normalized, classification.broad, classification.domainHits))
    .sort((a, b) => b.score - a.score);

  const [top, second] = [candidates[0], candidates[1]];
  const { mode, confidence } = decideMode(top?.score ?? 0, second?.score ?? 0, classification.broad, classification.ambiguous);
  const selectedAgent = mode === 'clarify' ? null : agents.find((agent) => agent.id === top.agentId) ?? null;
  const explanation = buildExplanation(selectedAgent, mode, input.text, classification.activeDomains.map((entry) => entry.domain));

  return {
    selectedAgent,
    decisionDraft: {
      selectedAgentId: selectedAgent?.id ?? null,
      routingMode: mode,
      confidence,
      reasoningSummary: explanation,
      candidateSnapshot: candidates.slice(0, 3)
    }
  };
}
