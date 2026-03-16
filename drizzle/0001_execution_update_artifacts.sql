ALTER TABLE `execution_updates` ADD `needs_input` text;
--> statement-breakpoint
ALTER TABLE `execution_updates` ADD `artifact_refs_json` text NOT NULL DEFAULT '[]';
