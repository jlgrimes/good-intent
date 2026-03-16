export interface IdpSchemaManifest {
  version: 'idp.v0';
  exported_at: string;
  objects: Array<{
    key:
      | 'intent'
      | 'routing_decision'
      | 'run'
      | 'delegation_orders'
      | 'delegation_events'
      | 'execution_updates';
    kind: 'object' | 'array' | 'nullable-object';
    description: string;
    required: boolean;
    fields: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  }>;
}

export function buildIdpSchemaManifest(): IdpSchemaManifest {
  return {
    version: 'idp.v0',
    exported_at: new Date().toISOString(),
    objects: [
      {
        key: 'intent',
        kind: 'object',
        required: true,
        description: 'Canonical human ask as submitted to Good Intent.',
        fields: [
          { name: 'type', type: '"intent"', description: 'Protocol object discriminator.' },
          { name: 'version', type: '"idp.v0"', description: 'Protocol version for this object shape.' },
          { name: 'id', type: 'string', description: 'Stable intent identifier.' },
          { name: 'created_at', type: 'ISO-8601 string', description: 'Intent creation timestamp.' },
          { name: 'created_by', type: 'actor', description: 'Actor that originated the intent in the product.' },
          { name: 'source', type: 'object', description: 'Product/surface metadata for the submission source.' },
          { name: 'text', type: 'string', description: 'Raw user phrasing of the requested work.' },
          { name: 'project', type: 'string?', description: 'Optional project scope attached to the intent.' },
          { name: 'urgency', type: 'string?', description: 'Optional urgency bucket from the app input.' },
          { name: 'constraints', type: 'string[]', description: 'Optional execution constraints preserved from the ask.' },
          { name: 'context', type: 'object', description: 'Current app-specific summary context such as intent status.' },
          { name: 'metadata', type: 'object', description: 'Extension bag for future product/runtime fields.' }
        ]
      },
      {
        key: 'routing_decision',
        kind: 'nullable-object',
        required: false,
        description: 'Ownership decision emitted by the router, including confidence and candidate evidence.',
        fields: [
          { name: 'type', type: '"routing_decision"', description: 'Protocol object discriminator.' },
          { name: 'version', type: '"idp.v0"', description: 'Protocol version for this object shape.' },
          { name: 'id', type: 'string', description: 'Stable routing decision identifier.' },
          { name: 'intent_id', type: 'string', description: 'Intent this decision belongs to.' },
          { name: 'created_at', type: 'ISO-8601 string', description: 'Decision timestamp.' },
          { name: 'routing_mode', type: 'direct | manager_first | org_top | clarify', description: 'Routing policy outcome.' },
          { name: 'selected_owner', type: 'actor | null', description: 'Chosen owner, or null when the router refused to fake ownership.' },
          { name: 'confidence', type: 'number', description: '0-1 routing confidence score.' },
          { name: 'reason', type: 'string', description: 'Compact human-readable explanation for the route.' },
          { name: 'candidate_set', type: 'array', description: 'Top structured candidates considered by the router.' },
          { name: 'policy_version', type: 'string', description: 'Version tag for the routing rule set.' },
          { name: 'metadata', type: 'object', description: 'Extension bag for future product/runtime fields.' }
        ]
      },
      {
        key: 'run',
        kind: 'nullable-object',
        required: false,
        description: 'Current execution container for the routed intent. Null for clarify-mode intents.',
        fields: [
          { name: 'id', type: 'string', description: 'Stable run identifier.' },
          { name: 'intent_id', type: 'string', description: 'Intent attached to this run.' },
          { name: 'root_routing_decision_id', type: 'string | null', description: 'Initial routing decision that created the run.' },
          { name: 'current_owner', type: 'actor | null', description: 'Current owner at the head of the delegation chain.' },
          { name: 'status', type: 'string', description: 'Current summarized run status.' },
          { name: 'created_at', type: 'ISO-8601 string', description: 'Run creation timestamp.' },
          { name: 'updated_at', type: 'ISO-8601 string', description: 'Last run mutation timestamp.' }
        ]
      },
      {
        key: 'delegation_orders',
        kind: 'array',
        required: true,
        description: 'Explicit handoff objects representing system/manager delegation orders.',
        fields: [
          { name: 'type', type: '"delegation_order"', description: 'Protocol object discriminator.' },
          { name: 'version', type: '"idp.v0"', description: 'Protocol version for this object shape.' },
          { name: 'id', type: 'string', description: 'Stable delegation order identifier.' },
          { name: 'intent_id', type: 'string', description: 'Intent attached to the order.' },
          { name: 'routing_decision_id', type: 'string | null', description: 'Source routing decision when the order came from auto-routing.' },
          { name: 'run_id', type: 'string', description: 'Delegation run that owns the order.' },
          { name: 'issued_at', type: 'ISO-8601 string', description: 'Order issuance timestamp.' },
          { name: 'from_actor', type: 'actor', description: 'Actor handing the work off.' },
          { name: 'to_actor', type: 'actor', description: 'Actor receiving the work.' },
          { name: 'objective', type: 'string', description: 'Objective statement for the handoff.' },
          { name: 'success_criteria', type: 'string[]', description: 'Compact success checklist for the receiver.' },
          { name: 'constraints', type: 'string[]', description: 'Constraints preserved on the handoff.' },
          { name: 'priority', type: 'string', description: 'Low/normal/high urgency preserved from app state.' },
          { name: 'dispatch_receipt', type: 'object | null', description: 'Optional receipt-level runtime handoff reference tied to the delegation order, including launch/completion/error process facts when available.' },
          { name: 'metadata', type: 'object', description: 'Extension bag for future product/runtime fields.' }
        ]
      },
      {
        key: 'delegation_events',
        kind: 'array',
        required: true,
        description: 'Append-only ownership trace for routing, delegation, escalation, and completion.',
        fields: [
          { name: 'type', type: '"delegation_event"', description: 'Protocol object discriminator.' },
          { name: 'version', type: '"idp.v0"', description: 'Protocol version for this object shape.' },
          { name: 'id', type: 'string', description: 'Stable event identifier.' },
          { name: 'run_id', type: 'string', description: 'Delegation run the event belongs to.' },
          { name: 'intent_id', type: 'string', description: 'Parent intent identifier.' },
          { name: 'order_id', type: 'string | null', description: 'Related delegation order when present.' },
          { name: 'timestamp', type: 'ISO-8601 string', description: 'Event timestamp.' },
          { name: 'event_type', type: 'string', description: 'Lifecycle event name such as intent.routed or run.delegated.' },
          { name: 'from_actor', type: 'actor?', description: 'Actor handing off or emitting the event.' },
          { name: 'to_actor', type: 'actor?', description: 'Receiving actor when applicable.' },
          { name: 'status', type: 'string?', description: 'Current summarized run status at export time.' },
          { name: 'summary', type: 'string', description: 'Compact human-readable event description.' },
          { name: 'metadata', type: 'object', description: 'Event-specific extension metadata.' }
        ]
      },
      {
        key: 'execution_updates',
        kind: 'array',
        required: true,
        description: 'Runtime progress checkpoints distinct from ownership changes.',
        fields: [
          { name: 'type', type: '"execution_update"', description: 'Protocol object discriminator.' },
          { name: 'version', type: '"idp.v0"', description: 'Protocol version for this object shape.' },
          { name: 'id', type: 'string', description: 'Stable execution update identifier.' },
          { name: 'run_id', type: 'string', description: 'Delegation run the update belongs to.' },
          { name: 'dispatch_record_id', type: 'string | null', description: 'Optional stable dispatch receipt reference for runtime-first consumers.' },
          { name: 'timestamp', type: 'ISO-8601 string', description: 'Checkpoint timestamp.' },
          { name: 'status', type: 'queued | running | blocked | done | needs_input', description: 'Current execution checkpoint status.' },
          { name: 'progress', type: 'number | null', description: 'Optional 0-1 progress signal.' },
          { name: 'summary', type: 'string', description: 'Compact execution summary for humans.' },
          { name: 'artifact_refs', type: 'array', description: 'Optional artifacts/commands/files/notes attached to the checkpoint.' },
          { name: 'needs_input', type: 'boolean', description: 'Whether this checkpoint is explicitly waiting on more input.' },
          { name: 'blocker', type: 'string | null', description: 'Optional blocker summary when execution is blocked.' },
          { name: 'metadata', type: 'object', description: 'Execution-specific extension metadata.' }
        ]
      }
    ]
  };
}
