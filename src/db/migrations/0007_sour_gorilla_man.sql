CREATE TYPE "public"."work_mode" AS ENUM('remote', 'onsite', 'hybrid');--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "work_mode" "work_mode";