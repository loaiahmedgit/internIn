CREATE TABLE "challenge_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"resource_type" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"mime_type" text,
	"file_extension" text,
	"storage_path" text,
	"external_url" text,
	"size_bytes" integer,
	"description" text,
	"content_spec" jsonb,
	"generation_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"requirement_id" text,
	"input_mode" text NOT NULL,
	"artifact_kind" text NOT NULL,
	"label" text NOT NULL,
	"original_filename" text,
	"mime_type" text,
	"size_bytes" integer,
	"storage_path" text,
	"external_url" text,
	"text_content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_versions" ADD COLUMN "submission_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge_resources" ADD CONSTRAINT "challenge_resources_challenge_version_id_challenge_versions_id_fk" FOREIGN KEY ("challenge_version_id") REFERENCES "public"."challenge_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_artifacts" ADD CONSTRAINT "submission_artifacts_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_resources_version_idx" ON "challenge_resources" USING btree ("challenge_version_id");--> statement-breakpoint
CREATE INDEX "submission_artifacts_submission_idx" ON "submission_artifacts" USING btree ("submission_id");