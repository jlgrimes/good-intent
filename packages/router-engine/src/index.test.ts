import { describe, expect, it } from 'vitest';
import { routeIntent } from './index';
import agents from '../../../data/seed-org.json';

describe('routeIntent', () => {
  it('routes infra asks to infra/cto side', () => {
    const result = routeIntent({ text: 'Fix the broken deploy on production' }, agents as any);
    expect(['agent_infra', 'agent_cto']).toContain(result.selectedAgent?.id);
    expect(result.decisionDraft.reasoningSummary.toLowerCase()).toContain('infrastructure');
  });

  it('routes copy asks to designer', () => {
    const result = routeIntent({ text: 'Rewrite the homepage hero copy so the value prop is clearer' }, agents as any);
    expect(result.selectedAgent?.id).toBe('agent_designer');
  });

  it('routes ambiguous strategic asks to top-level delegation', () => {
    const result = routeIntent({ text: 'Figure out why onboarding conversion dropped this week' }, agents as any);
    expect(['org_top', 'manager_first']).toContain(result.decisionDraft.routingMode);
    expect(['agent_ceo', 'agent_growth']).toContain(result.selectedAgent?.id);
  });

  it('routes oauth bug to product engineer', () => {
    const result = routeIntent({ text: 'Fix the OAuth callback bug in the app' }, agents as any);
    expect(result.selectedAgent?.id).toBe('agent_product_eng');
    expect(result.decisionDraft.routingMode).toBe('direct');
  });

  it('asks for clarification on underspecified input', () => {
    const result = routeIntent({ text: 'Handle that weird thing from earlier' }, agents as any);
    expect(result.selectedAgent).toBeNull();
    expect(result.decisionDraft.routingMode).toBe('clarify');
  });
});
