ALTER TABLE "challenge_versions" ADD COLUMN "ai_usage_policy" "ai_usage_mode" DEFAULT 'ai_allowed' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "what_you_will_learn" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "nice_to_have" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "require_cv" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "application_questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;