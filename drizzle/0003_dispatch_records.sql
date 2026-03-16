CREATE TABLE `dispatch_records` (
  `id` text PRIMARY KEY NOT NULL,
  `delegation_order_id` text NOT NULL,
  `delegation_run_id` text NOT NULL,
  `intent_id` text NOT NULL,
  `to_agent_id` text NOT NULL,
  `runtime` text NOT NULL,
  `channel` text NOT NULL,
  `status` text NOT NULL,
  `receipt_id` text NOT NULL,
  `summary` text NOT NULL,
  `command` text NOT NULL,
  `log_key` text NOT NULL,
  `artifact_refs_json` text DEFAULT '[]' NOT NULL,
  `dispatched_at` text NOT NULL
);
