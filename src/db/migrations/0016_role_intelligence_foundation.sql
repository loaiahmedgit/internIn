CREATE TYPE "public"."role_evidence_type" AS ENUM('description', 'task', 'work_activity', 'skill', 'knowledge', 'tool', 'work_environment', 'competency', 'deliverable', 'safety_constraint');--> statement-breakpoint
CREATE TYPE "public"."role_knowledge_source" AS ENUM('onet', 'esco', 'internin_curated');--> statement-breakpoint
CREATE TYPE "public"."role_mapping_relation" AS ENUM('exact', 'narrower', 'broader', 'related');--> statement-breakpoint
CREATE TYPE "public"."role_profile_kind" AS ENUM('source_occupation', 'internship_overlay');--> statement-breakpoint
CREATE TABLE "role_profile_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"source" "role_knowledge_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"evidence_type" "role_evidence_type" NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"importance" integer DEFAULT 50 NOT NULL,
	"source" "role_knowledge_source" NOT NULL,
	"external_ref" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_search_documents" (
	"role_profile_id" uuid PRIMARY KEY NOT NULL,
	"search_text" text NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profile_source_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_profile_id" uuid NOT NULL,
	"source_release_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"relation" "role_mapping_relation" NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_key" text NOT NULL,
	"kind" "role_profile_kind" NOT NULL,
	"canonical_title" text NOT NULL,
	"internship_title" text,
	"occupation_family" text NOT NULL,
	"description" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_profiles_stable_key_unique" UNIQUE("stable_key")
);
--> statement-breakpoint
CREATE TABLE "role_source_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "role_knowledge_source" NOT NULL,
	"version" text NOT NULL,
	"published_at" timestamp with time zone,
	"checksum" text,
	"attribution" text NOT NULL,
	"license_url" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_profile_aliases" ADD CONSTRAINT "role_profile_aliases_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_evidence" ADD CONSTRAINT "role_profile_evidence_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_search_documents" ADD CONSTRAINT "role_profile_search_documents_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_source_mappings" ADD CONSTRAINT "role_profile_source_mappings_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_profile_source_mappings" ADD CONSTRAINT "role_profile_source_mappings_source_release_id_role_source_releases_id_fk" FOREIGN KEY ("source_release_id") REFERENCES "public"."role_source_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_profile_aliases_profile_alias_locale_uidx" ON "role_profile_aliases" USING btree ("role_profile_id","normalized_alias","locale");--> statement-breakpoint
CREATE INDEX "role_profile_aliases_normalized_idx" ON "role_profile_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE INDEX "role_profile_evidence_profile_type_idx" ON "role_profile_evidence" USING btree ("role_profile_id","evidence_type");--> statement-breakpoint
CREATE INDEX "role_profile_evidence_normalized_idx" ON "role_profile_evidence" USING btree ("normalized_text");--> statement-breakpoint
CREATE UNIQUE INDEX "role_profile_source_mappings_profile_source_external_uidx" ON "role_profile_source_mappings" USING btree ("role_profile_id","source_release_id","external_id");--> statement-breakpoint
CREATE INDEX "role_profile_source_mappings_external_idx" ON "role_profile_source_mappings" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "role_profiles_family_idx" ON "role_profiles" USING btree ("occupation_family");--> statement-breakpoint
CREATE INDEX "role_profiles_active_idx" ON "role_profiles" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "role_source_releases_source_version_uidx" ON "role_source_releases" USING btree ("source","version");--> statement-breakpoint

-- Task/activity text is the primary lexical retrieval surface. PostgreSQL
-- full-text search is local, requires no extension, and keeps runtime role
-- discovery independent from the upstream occupation APIs.
CREATE INDEX "role_profile_search_documents_fts_idx"
ON "role_profile_search_documents"
USING gin (to_tsvector('english', "search_text"));--> statement-breakpoint

ALTER TABLE "role_profile_evidence"
ADD CONSTRAINT "role_profile_evidence_importance_check"
CHECK ("importance" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE "role_profile_source_mappings"
ADD CONSTRAINT "role_profile_source_mappings_weight_check"
CHECK ("weight" BETWEEN 0 AND 100);--> statement-breakpoint

-- These are server-managed reference tables. The app queries them through
-- its privileged Drizzle connection; they must not become directly writable
-- or enumerable through Supabase's public Data API.
ALTER TABLE "role_source_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_profile_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_profile_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_profile_source_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_profile_search_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON
  "role_source_releases",
  "role_profiles",
  "role_profile_aliases",
  "role_profile_evidence",
  "role_profile_source_mappings",
  "role_profile_search_documents"
FROM anon, authenticated;
