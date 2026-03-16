import type { Agent, DelegationEvent, DelegationOrder, ExecutionUpdate, Intent, RoutingDecision } from '@good-intent/shared';
import { buildIdpExport, type IdpExport } from './idp.js';

export function buildIntentIdpExport(params: {
  intent: Intent;
  decision: RoutingDecision | null;
  run: {
    id: string;
    intentId: string;
    currentAgentId: string | null;
    status: string;
    rootRoutingDecisionId: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  orders: DelegationOrder[];
  events: DelegationEvent[];
  executionUpdates: ExecutionUpdate[];
  dispatchRecords?: import('@good-intent/shared').DispatchRecord[];
  agents: Agent[];
}): IdpExport {
  return buildIdpExport(params);
}
