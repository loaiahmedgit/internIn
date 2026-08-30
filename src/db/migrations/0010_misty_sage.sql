ALTER TABLE "companies" ADD COLUMN "office_locations" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "evidence_ai_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN "submission_notifications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN "offer_notifications" boolean DEFAULT true NOT NULL;