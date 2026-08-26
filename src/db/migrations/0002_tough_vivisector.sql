CREATE TYPE "public"."education_stage" AS ENUM('high_school', 'university', 'graduate', 'vocational', 'other');--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "size" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_members" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "education_stage" "education_stage";--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "opportunity_types" jsonb DEFAULT '[]'::jsonb NOT NULL;