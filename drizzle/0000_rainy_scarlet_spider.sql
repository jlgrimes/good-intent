CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`title` text NOT NULL,
	`reports_to` text,
	`capabilities_json` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delegation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`delegation_run_id` text NOT NULL,
	`type` text NOT NULL,
	`from_agent_id` text,
	`to_agent_id` text,
	`summary` text NOT NULL,
	`metadata_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `execution_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`delegation_run_id` text NOT NULL,
	`agent_id` text,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`progress` real,
	`blocker` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delegation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`current_agent_id` text,
	`status` text NOT NULL,
	`root_routing_decision_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delegation_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`routing_decision_id` text,
	`delegation_run_id` text NOT NULL,
	`from_agent_id` text,
	`to_agent_id` text NOT NULL,
	`objective` text NOT NULL,
	`success_criteria_json` text NOT NULL,
	`constraints_json` text NOT NULL,
	`priority` text NOT NULL,
	`issued_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `intents` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`urgency` text NOT NULL,
	`project` text,
	`constraints_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routing_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`selected_agent_id` text,
	`routing_mode` text NOT NULL,
	`confidence` real NOT NULL,
	`reasoning_summary` text NOT NULL,
	`candidate_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL
);
