CREATE TABLE `outlook_states` (
	`state` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`verifier` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outlook_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted` text NOT NULL
);
