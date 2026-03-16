import type { IdpExamplePayload, IdpExport } from './idp';

function createBaseIntent(params: {
  id: string;
  text: string;
  status: string;
  urgency?: string;
}): IdpExport['intent'] {
  return {
    type: 'intent',
    version: 'idp.v0',
    id: params.id,
    created_at: '2026-03-11T21:00:00.000Z',
    created_by: { type: 'system', id: 'good-intent-user' },
    source: { product: 'good-intent', surface: 'web' },
    text: params.text,
    urgency: params.urgency,
    constraints: [],
    context: {
      app_intent_status: params.status
    },
    metadata: {}
  };
}

const directExample: IdpExport = {
  version: 'idp.v0',
  exported_at: '2026-03-11T21:00:02.000Z',
  intent: createBaseIntent({
    id: 'intent_example_direct',
    text: 'Fix the broken deploy on production.',
    status: 'running',
    urgency: 'high'
  }),
  routing_decision: {
    type: 'routing_decision',
    version: 'idp.v0',
    id: 'route_example_direct',
    intent_id: 'intent_example_direct',
    created_at: '2026-03-11T21:00:01.000Z',
    routing_mode: 'direct',
    selected_owner: { type: 'agent', id: 'agent_infra' },
    confidence: 0.94,
    reason: 'Routed to Infra Engineer because the request is about deployment and production reliability.',
    candidate_set: [
      {
        actor: { type: 'agent', id: 'agent_infra' },
        score: 0.94,
        summary: 'Strong infra keyword match · specialist execution fit'
      },
      {
        actor: { type: 'agent', id: 'agent_cto' },
        score: 0.78,
        summary: 'Managerial infra oversight · escalation fallback'
      }
    ],
    policy_version: 'routing-rules.v0',
    metadata: {}
  },
  run: {
    id: 'run_example_direct',
    intent_id: 'intent_example_direct',
    root_routing_decision_id: 'route_example_direct',
    current_owner: { type: 'agent', id: 'agent_infra' },
    status: 'running',
    created_at: '2026-03-11T21:00:01.500Z',
    updated_at: '2026-03-11T21:00:05.000Z'
  },
  delegation_orders: [
    {
      type: 'delegation_order',
      version: 'idp.v0',
      id: 'order_example_direct',
      intent_id: 'intent_example_direct',
      routing_decision_id: 'route_example_direct',
      run_id: 'run_example_direct',
      issued_at: '2026-03-11T21:00:01.500Z',
      from_actor: { type: 'system', id: 'good-intent-router' },
      to_actor: { type: 'agent', id: 'agent_infra' },
      objective: 'Fix the broken deploy on production.',
      success_criteria: ['Deploy recovers', 'Root cause identified', 'Status reported back'],
      constraints: ['Minimize downtime'],
      priority: 'high',
      dispatch_receipt: {
        dispatch_record_id: 'dispatch_example_direct',
        runtime: 'command-runtime',
        channel: 'delegation-orders',
        status: 'queued',
        receipt_id: 'receipt_order_example_direct',
        log_key: 'command-runtime://run_example_direct/order_example_direct/fix-the-broken-deploy-on-production',
        command: "'good-intent-runtime-dev' --agent 'agent_infra' --run 'run_example_direct' --order 'order_example_direct' --objective 'Fix the broken deploy on production.'",
        dispatched_at: '2026-03-11T21:00:02.000Z',
        summary: 'Queued handoff to Infra Engineer via good-intent-runtime-dev.',
        artifact_refs: [
          {
            label: 'Dispatch receipt',
            kind: 'note',
            value: 'receipt_order_example_direct'
          }
        ]
      },
      metadata: {}
    }
  ],
  delegation_events: [
    {
      type: 'delegation_event',
      version: 'idp.v0',
      id: 'event_example_direct_routed',
      run_id: 'run_example_direct',
      intent_id: 'intent_example_direct',
      order_id: 'order_example_direct',
      timestamp: '2026-03-11T21:00:01.500Z',
      event_type: 'intent.routed',
      to_actor: { type: 'agent', id: 'agent_infra' },
      status: 'running',
      summary: 'Intent routed to Infra Engineer.',
      metadata: { routing_mode: 'direct', confidence: 0.94 }
    },
    {
      type: 'delegation_event',
      version: 'idp.v0',
      id: 'event_example_direct_dispatched',
      run_id: 'run_example_direct',
      intent_id: 'intent_example_direct',
      order_id: 'order_example_direct',
      timestamp: '2026-03-11T21:00:02.000Z',
      event_type: 'run.dispatched',
      to_actor: { type: 'agent', id: 'agent_infra' },
      status: 'running',
      summary: 'Delegation order issued to Infra Engineer.',
      metadata: {}
    }
  ],
  execution_updates: [
    {
      type: 'execution_update',
      version: 'idp.v0',
      id: 'update_example_direct_running',
      run_id: 'run_example_direct',
      dispatch_record_id: 'dispatch_example_direct',
      timestamp: '2026-03-11T21:00:05.000Z',
      status: 'running',
      progress: 0.35,
      summary: 'Reviewing deployment logs and recent config changes.',
      artifact_refs: [
        {
          label: 'Deploy logs',
          kind: 'file',
          value: '/var/log/good-intent/deploy.log'
        }
      ],
      needs_input: false,
      blocker: null,
      metadata: {}
    }
  ]
};

const managerFirstExample: IdpExport = {
  version: 'idp.v0',
  exported_at: '2026-03-11T21:05:00.000Z',
  intent: createBaseIntent({
    id: 'intent_example_manager',
    text: 'Figure out why onboarding conversion dropped this week and what to do about it.',
    status: 'running',
    urgency: 'normal'
  }),
  routing_decision: {
    type: 'routing_decision',
    version: 'idp.v0',
    id: 'route_example_manager',
    intent_id: 'intent_example_manager',
    created_at: '2026-03-11T21:04:59.000Z',
    routing_mode: 'manager_first',
    selected_owner: { type: 'agent', id: 'agent_growth' },
    confidence: 0.68,
    reason: 'Routed to Growth Lead first because the request is broad, funnel-oriented, and likely needs downstream delegation.',
    candidate_set: [
      {
        actor: { type: 'agent', id: 'agent_growth' },
        score: 0.68,
        summary: 'Strong growth/funnel match · manager first-pass bias'
      },
      {
        actor: { type: 'agent', id: 'agent_ceo' },
        score: 0.61,
        summary: 'Cross-functional fallback · broader org authority'
      },
      {
        actor: { type: 'agent', id: 'agent_designer' },
        score: 0.39,
        summary: 'Landing-page relevance only'
      }
    ],
    policy_version: 'routing-rules.v0',
    metadata: {}
  },
  run: {
    id: 'run_example_manager',
    intent_id: 'intent_example_manager',
    root_routing_decision_id: 'route_example_manager',
    current_owner: { type: 'agent', id: 'agent_growth' },
    status: 'running',
    created_at: '2026-03-11T21:05:00.000Z',
    updated_at: '2026-03-11T21:06:00.000Z'
  },
  delegation_orders: [
    {
      type: 'delegation_order',
      version: 'idp.v0',
      id: 'order_example_manager',
      intent_id: 'intent_example_manager',
      routing_decision_id: 'route_example_manager',
      run_id: 'run_example_manager',
      issued_at: '2026-03-11T21:05:00.000Z',
      from_actor: { type: 'system', id: 'good-intent-router' },
      to_actor: { type: 'agent', id: 'agent_growth' },
      objective: 'Figure out why onboarding conversion dropped this week and what to do about it.',
      success_criteria: ['Drop explained', 'Likely owner/next steps identified'],
      constraints: [],
      priority: 'normal',
      dispatch_receipt: {
        dispatch_record_id: 'dispatch_example_manager',
        runtime: 'command-runtime',
        channel: 'delegation-orders',
        status: 'running',
        receipt_id: 'receipt_order_example_manager',
        log_key: 'process://4343',
        command: "'good-intent-runtime-dev' --agent 'agent_growth' --run 'run_example_manager' --order 'order_example_manager' --objective 'Figure out why onboarding conversion dropped this week and what to do about it.'",
        dispatched_at: '2026-03-11T21:05:00.000Z',
        launched_at: '2026-03-11T21:05:00.050Z',
        ended_at: null,
        process_pid: 4343,
        exit_code: null,
        last_error: null,
        summary: 'Launched handoff to Growth Lead via good-intent-runtime-dev.',
        artifact_refs: [
          {
            label: 'Dispatch receipt',
            kind: 'note',
            value: 'receipt_order_example_manager'
          }
        ]
      },
      metadata: {}
    }
  ],
  delegation_events: [
    {
      type: 'delegation_event',
      version: 'idp.v0',
      id: 'event_example_manager_routed',
      run_id: 'run_example_manager',
      intent_id: 'intent_example_manager',
      order_id: 'order_example_manager',
      timestamp: '2026-03-11T21:05:00.000Z',
      event_type: 'intent.routed',
      to_actor: { type: 'agent', id: 'agent_growth' },
      status: 'running',
      summary: 'Intent routed to Growth Lead for manager-first triage.',
      metadata: { routing_mode: 'manager_first', confidence: 0.68 }
    }
  ],
  execution_updates: [
    {
      type: 'execution_update',
      version: 'idp.v0',
      id: 'update_example_manager_input',
      run_id: 'run_example_manager',
      dispatch_record_id: 'dispatch_example_manager',
      timestamp: '2026-03-11T21:06:00.000Z',
      status: 'needs_input',
      progress: 0.1,
      summary: 'Need last week vs this week funnel breakdown before delegating further.',
      artifact_refs: [
        {
          label: 'Requested metric slice',
          kind: 'note',
          value: 'Signup -> onboarding step 3 conversion by day'
        }
      ],
      needs_input: true,
      blocker: 'Waiting on funnel breakdown.',
      metadata: {}
    }
  ]
};

const clarifyExample: IdpExport = {
  version: 'idp.v0',
  exported_at: '2026-03-11T21:10:00.000Z',
  intent: createBaseIntent({
    id: 'intent_example_clarify',
    text: 'Handle that weird thing from earlier.',
    status: 'pending',
    urgency: 'normal'
  }),
  routing_decision: {
    type: 'routing_decision',
    version: 'idp.v0',
    id: 'route_example_clarify',
    intent_id: 'intent_example_clarify',
    created_at: '2026-03-11T21:09:59.000Z',
    routing_mode: 'clarify',
    selected_owner: null,
    confidence: 0.24,
    reason: 'Needs clarification because the request is underspecified and no owner has a strong routing signal.',
    candidate_set: [],
    policy_version: 'routing-rules.v0',
    metadata: {}
  },
  run: null,
  delegation_orders: [],
  delegation_events: [
    {
      type: 'delegation_event',
      version: 'idp.v0',
      id: 'event_example_clarify_requested',
      run_id: 'intent_example_clarify',
      intent_id: 'intent_example_clarify',
      order_id: null,
      timestamp: '2026-03-11T21:10:00.000Z',
      event_type: 'intent.clarification_requested',
      status: 'pending',
      summary: 'Clarification requested before routing.',
      metadata: {}
    }
  ],
  execution_updates: []
};

const EXAMPLES: IdpExamplePayload[] = [
  {
    key: 'direct',
    title: 'Direct specialist route',
    description: 'A narrow execution task routes straight to the best specialist with a live run.',
    export: directExample
  },
  {
    key: 'manager_first',
    title: 'Manager-first delegation',
    description: 'A broad domain task routes to the relevant manager first and can request more context before delegating further.',
    export: managerFirstExample
  },
  {
    key: 'clarify',
    title: 'Clarification before ownership',
    description: 'An underspecified ask records a routing decision but intentionally avoids creating fake run/order state.',
    export: clarifyExample
  }
];

export function listIdpExamples(): IdpExamplePayload[] {
  return EXAMPLES;
}
