export interface ApiContractManifest {
  version: 'good-intent.api.v0';
  exported_at: string;
  endpoints: Array<{
    method: 'GET' | 'POST';
    path: string;
    summary: string;
    requestBody?: {
      required: boolean;
      contentType: 'application/json';
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
      }>;
    };
    response: {
      type: string;
      description: string;
    };
    examples?: Array<{
      name: string;
      request?: Record<string, unknown>;
      response: Record<string, unknown>;
    }>;
  }>;
}

export function buildApiContractManifest(): ApiContractManifest {
  return {
    version: 'good-intent.api.v0',
    exported_at: new Date().toISOString(),
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        summary: 'Health check for the API service.',
        response: {
          type: '{ ok: true }',
          description: 'Simple service health status.'
        },
        examples: [
          {
            name: 'service healthy',
            response: { ok: true }
          }
        ]
      },
      {
        method: 'GET',
        path: '/org',
        summary: 'Return the current seed org / agent directory used for routing.',
        response: {
          type: '{ agents: Agent[] }',
          description: 'List of active agents with roles, titles, reportsTo, capabilities, and status.'
        }
      },
      {
        method: 'GET',
        path: '/intents',
        summary: 'List recent intent views with routing summary, current run state, and trace snippets.',
        response: {
          type: '{ intents: IntentView[] }',
          description: 'App-shaped inbox/detail summaries for recent intents.'
        }
      },
      {
        method: 'POST',
        path: '/intents',
        summary: 'Create a new intent with no assignee field in the primary flow.',
        requestBody: {
          required: true,
          contentType: 'application/json',
          fields: [
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Raw user ask to route.'
            },
            {
              name: 'urgency',
              type: '"low" | "normal" | "high"',
              required: false,
              description: 'Optional urgency bucket preserved on the intent.'
            },
            {
              name: 'project',
              type: 'string',
              required: false,
              description: 'Optional project scope.'
            },
            {
              name: 'constraints',
              type: 'string[]',
              required: false,
              description: 'Optional execution constraints copied onto the intent/order.'
            }
          ]
        },
        response: {
          type: '{ intent: Intent }',
          description: 'Created intent record before routing.'
        },
        examples: [
          {
            name: 'create deploy intent',
            request: {
              text: 'Fix the broken deploy on production',
              urgency: 'high'
            },
            response: {
              intent: {
                id: 'intent_example_create',
                text: 'Fix the broken deploy on production',
                urgency: 'high',
                status: 'pending'
              }
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/intents/submit',
        summary: 'Create and auto-route an intent in one call so the primary flow never needs a manual assignee picker.',
        requestBody: {
          required: true,
          contentType: 'application/json',
          fields: [
            {
              name: 'text',
              type: 'string',
              required: true,
              description: 'Raw user ask to route immediately.'
            },
            {
              name: 'urgency',
              type: '"low" | "normal" | "high"',
              required: false,
              description: 'Optional urgency bucket preserved on the intent.'
            },
            {
              name: 'project',
              type: 'string',
              required: false,
              description: 'Optional project scope.'
            },
            {
              name: 'constraints',
              type: 'string[]',
              required: false,
              description: 'Optional execution constraints copied onto the intent/order.'
            }
          ]
        },
        response: {
          type: 'IntentView',
          description: 'Created intent plus selected owner, explanation, initial delegation order, and first dispatch receipt proof.'
        },
        examples: [
          {
            name: 'submit deploy intent and auto-route',
            request: {
              text: 'Fix the broken deploy on production',
              urgency: 'high'
            },
            response: {
              intent: { id: 'intent_example_submit', status: 'routed', text: 'Fix the broken deploy on production' },
              decision: {
                selectedAgentId: 'agent_infra',
                routingMode: 'direct',
                confidence: 0.94,
                reasoningSummary: 'Routed to Infra Engineer because this request most strongly matches infrastructure work they are equipped to own.'
              },
              selectedAgent: { id: 'agent_infra', title: 'Infra Engineer' },
              run: { id: 'run_example_submit', status: 'running', currentAgentId: 'agent_infra' },
              orders: [{ id: 'order_example_submit', toAgentId: 'agent_infra', priority: 'high' }],
              dispatchRecords: [
                {
                  id: 'dispatch_example_submit',
                  delegationOrderId: 'order_example_submit',
                  receiptId: 'receipt_order_example_submit',
                  runtime: 'command-runtime',
                  channel: 'delegation-orders',
                  status: 'running',
                  logKey: 'process://4242',
                  launchedAt: '2026-03-11T04:00:03Z',
                  processPid: 4242,
                  exitCode: null,
                  endedAt: null,
                  lastError: null
                }
              ],
              initialHandoff: {
                order: {
                  id: 'order_example_submit',
                  delegationRunId: 'run_example_submit',
                  toAgentId: 'agent_infra',
                  objective: 'Fix the broken deploy on production',
                  priority: 'high',
                  issuedAt: '2026-03-11T04:00:02Z'
                },
                toAgent: { id: 'agent_infra', title: 'Infra Engineer' },
                fromAgent: null,
                dispatchRecord: {
                  id: 'dispatch_example_submit',
                  delegationOrderId: 'order_example_submit',
                  receiptId: 'receipt_order_example_submit',
                  runtime: 'command-runtime',
                  channel: 'delegation-orders',
                  status: 'running',
                  logKey: 'process://4242',
                  launchedAt: '2026-03-11T04:00:03Z',
                  processPid: 4242,
                  exitCode: null,
                  endedAt: null,
                  lastError: null
                }
              },
              events: [
                { type: 'intent.routed', summary: 'Routed to Infra Engineer because this request most strongly matches infrastructure work they are equipped to own.' },
                { type: 'run.dispatched', summary: 'Launched handoff to Infra Engineer via good-intent-runtime-dev.' }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/intents/:id/route',
        summary: 'Route an existing intent automatically and persist owner + explanation + trace skeleton.',
        response: {
          type: 'IntentView',
          description: 'Full routed intent view with selected owner, mode framing, candidates, run, initial handoff proof, orders, events, and execution updates.'
        },
        examples: [
          {
            name: 'direct specialist route',
            response: {
              intent: { id: 'intent_example_create', status: 'running' },
              decision: {
                selectedAgentId: 'agent_infra',
                routingMode: 'direct',
                confidence: 0.94,
                reasoningSummary: 'Routed to Infra Engineer because this request most strongly matches infrastructure work they are equipped to own.'
              },
              selectedAgent: {
                id: 'agent_infra',
                title: 'Infra Engineer'
              },
              run: {
                id: 'run_example_direct',
                status: 'running',
                currentAgentId: 'agent_infra'
              },
              initialHandoff: {
                order: {
                  id: 'order_example_direct',
                  delegationRunId: 'run_example_direct',
                  toAgentId: 'agent_infra',
                  objective: 'Fix the broken deploy on production',
                  priority: 'high',
                  issuedAt: '2026-03-11T04:00:02Z'
                },
                toAgent: {
                  id: 'agent_infra',
                  title: 'Infra Engineer'
                },
                fromAgent: null,
                dispatchRecord: {
                  id: 'dispatch_example_direct',
                  delegationOrderId: 'order_example_direct',
                  receiptId: 'receipt_order_example_direct',
                  runtime: 'command-runtime',
                  channel: 'delegation-orders',
                  status: 'running',
                  logKey: 'process://4242',
                  launchedAt: '2026-03-11T04:00:03Z',
                  processPid: 4242,
                  exitCode: null,
                  endedAt: null,
                  lastError: null
                }
              },
              orders: [
                {
                  id: 'order_example_direct',
                  toAgentId: 'agent_infra',
                  dispatchReceipt: {
                    dispatchRecordId: 'dispatch_example_direct',
                    runtime: 'command-runtime',
                    receiptId: 'receipt_order_example_direct',
                    logKey: 'process://4242',
                    channel: 'delegation-orders',
                    launchedAt: '2026-03-11T04:00:03Z',
                    processPid: 4242,
                    endedAt: null,
                    exitCode: null,
                    lastError: null
                  }
                }
              ]
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/intents/:id',
        summary: 'Fetch a full intent detail view including routing result and delegation trace.',
        response: {
          type: 'IntentView',
          description: 'Current app-shaped detail payload for a single intent, including first-class initial handoff proof.'
        }
      },
      {
        method: 'GET',
        path: '/intents/:id/idp-export',
        summary: 'Fetch the portable protocol export for a routed or clarify-mode intent.',
        response: {
          type: 'IdpExport',
          description: 'Protocol-shaped export with intent, routing_decision, run, orders (including receipt-level dispatch refs), events, and updates.'
        }
      },
      {
        method: 'GET',
        path: '/dispatch-records',
        summary: 'List persisted runtime handoff receipts for receipt-first consumers without starting from intent detail.',
        response: {
          type: 'DispatchRecordHistory',
          description: 'Dispatch-record history, optionally filtered by intentId, runId, or orderId.'
        },
        examples: [
          {
            name: 'list dispatch receipts for a routed intent',
            request: {
              query: {
                intentId: 'intent_example_create'
              }
            },
            response: {
              dispatchRecords: [
                {
                  id: 'dispatch_example_direct',
                  delegationOrderId: 'order_example_direct',
                  delegationRunId: 'run_example_direct',
                  intentId: 'intent_example_create',
                  toAgentId: 'agent_infra',
                  runtime: 'command-runtime',
                  channel: 'delegation-orders',
                  status: 'running',
                  receiptId: 'receipt_order_example_direct',
                  summary: 'Launched handoff to Infra Engineer via good-intent-runtime-dev.',
                  command: "'good-intent-runtime-dev' --agent 'agent_infra' --run 'run_example_direct' --order 'order_example_direct' --objective 'Fix the broken deploy on production'",
                  logKey: 'process://4242',
                  dispatchedAt: '2026-03-11T04:00:03Z',
                  launchedAt: '2026-03-11T04:00:03Z',
                  endedAt: null,
                  processPid: 4242,
                  exitCode: null,
                  lastError: null,
                  artifactRefs: [
                    {
                      label: 'Dispatch receipt',
                      kind: 'note',
                      value: 'receipt_order_example_direct'
                    },
                    {
                      label: 'Runtime process pid',
                      kind: 'note',
                      value: '4242'
                    }
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/dispatch-records/refresh',
        summary: 'Refresh multiple persisted runtime handoff receipts in one call, filtered by intentId, runId, or orderId.',
        requestBody: {
          required: true,
          contentType: 'application/json',
          fields: [
            {
              name: 'intentId',
              type: 'string',
              required: false,
              description: 'Refresh all dispatch receipts attached to one intent.'
            },
            {
              name: 'runId',
              type: 'string',
              required: false,
              description: 'Refresh all dispatch receipts attached to one delegation run.'
            },
            {
              name: 'orderId',
              type: 'string',
              required: false,
              description: 'Refresh dispatch receipts for a specific delegation order.'
            }
          ]
        },
        response: {
          type: 'BulkDispatchRefreshResult',
          description: 'The refreshed dispatch receipt rows plus aggregate reconciliation counts/status buckets.'
        },
        examples: [
          {
            name: 'refresh all receipts for one run',
            request: {
              runId: 'run_example_direct'
            },
            response: {
              dispatchRecords: [
                {
                  id: 'dispatch_example_direct',
                  delegationOrderId: 'order_example_direct',
                  delegationRunId: 'run_example_direct',
                  intentId: 'intent_example_create',
                  toAgentId: 'agent_infra',
                  runtime: 'command-runtime',
                  channel: 'delegation-orders',
                  status: 'completed',
                  receiptId: 'receipt_order_example_direct',
                  summary: 'Runtime completed handoff for agent_infra via good-intent-runtime-dev.',
                  command: "'good-intent-runtime-dev' --agent 'agent_infra' --run 'run_example_direct' --order 'order_example_direct' --objective 'Fix the broken deploy on production'",
                  logKey: 'process://4242',
                  dispatchedAt: '2026-03-11T04:00:03Z',
                  launchedAt: '2026-03-11T04:00:04Z',
                  endedAt: '2026-03-11T04:00:06Z',
                  processPid: 4242,
                  exitCode: 0,
                  lastError: null,
                  artifactRefs: [
                    {
                      label: 'Dispatch receipt',
                      kind: 'note',
                      value: 'receipt_order_example_direct'
                    }
                  ]
                }
              ],
              summary: {
                requestedCount: 1,
                refreshedCount: 1,
                successCount: 1,
                errorCount: 0,
                unchangedCount: 0,
                statuses: {
                  completed: 1
                }
              }
            }
          }
        ]
      },
      {
        method: 'POST',
        path: '/delegation-runs/:id/actions',
        summary: 'Mutate a live delegation run via delegate/escalate/block/complete/needs_input/reply_to_input.',
        requestBody: {
          required: true,
          contentType: 'application/json',
          fields: [
            {
              name: 'action',
              type: '"delegate" | "escalate" | "block" | "complete" | "needs_input" | "reply_to_input"',
              required: true,
              description: 'Run mutation to apply.'
            },
            {
              name: 'toAgentId',
              type: 'string',
              required: false,
              description: 'Explicit next owner for delegate actions.'
            },
            {
              name: 'summary',
              type: 'string',
              required: false,
              description: 'Human-readable reason / update summary attached to the action.'
            },
            {
              name: 'needsInput',
              type: 'string',
              required: false,
              description: 'Explicit context request when action=needs_input.'
            },
            {
              name: 'artifactRefs',
              type: 'ArtifactRef[]',
              required: false,
              description: 'Optional attached notes/files/commands carried with the execution update.'
            }
          ]
        },
        response: {
          type: 'IntentView',
          description: 'Updated intent detail after the run mutation.'
        },
        examples: [
          {
            name: 'request more input',
            request: {
              action: 'needs_input',
              summary: 'Need the failing OAuth callback URL.',
              needsInput: 'Please attach the failing callback URL and response body.',
              artifactRefs: [
                {
                  label: 'Repro command',
                  kind: 'command',
                  value: 'pnpm test auth-oauth.spec.ts'
                }
              ]
            },
            response: {
              run: {
                id: 'run_example_direct',
                status: 'running'
              },
              executionUpdates: [
                {
                  status: 'needs_input',
                  summary: 'Need the failing OAuth callback URL.',
                  needsInput: 'Please attach the failing callback URL and response body.'
                }
              ]
            }
          },
          {
            name: 'reply to requested input',
            request: {
              action: 'reply_to_input',
              summary: 'Attached the failing callback URL and response body.',
              artifactRefs: [
                {
                  label: 'User reply',
                  kind: 'note',
                  value: 'GET /auth/callback?code=bad123 returned 500 with missing redirect_uri.'
                }
              ]
            },
            response: {
              run: {
                id: 'run_example_direct',
                status: 'running'
              },
              events: [
                {
                  type: 'run.input_received'
                }
              ]
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/idp/schema',
        summary: 'Return the machine-readable schema manifest for IDP exports.',
        response: {
          type: 'IdpSchemaManifest',
          description: 'Protocol export object inventory and field descriptions.'
        }
      },
      {
        method: 'GET',
        path: '/idp/examples',
        summary: 'Return stable sample IDP exports for direct, manager_first, and clarify flows.',
        response: {
          type: '{ version: "idp.v0", examples: IdpExamplePayload[] }',
          description: 'Concrete protocol fixtures for downstream consumers.'
        }
      },
      {
        method: 'GET',
        path: '/api/contract',
        summary: 'Return the machine-readable Good Intent app API contract for create/route/action discovery.',
        response: {
          type: 'ApiContractManifest',
          description: 'Endpoint-level contract summary with request/response descriptions and examples.'
        }
      }
    ]
  };
}
