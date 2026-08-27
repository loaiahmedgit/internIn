import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Cross-cutting conventions (see docs/ and the approved Phase 1 plan):
 * - every table gets created_at/updated_at
 * - nothing is hard-deleted; status/soft-delete fields instead
 * - AI-generated content is versioned (challenge_versions), never overwritten in place
 * - event_log is the append-only audit trail for product-critical lifecycle events
 * - authorization is enforced in application code per query — these FKs make that
 *   possible, they do not enforce it by themselves
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["student", "company"]);
export const companyMemberRoleEnum = pgEnum("company_member_role", ["owner", "admin", "member"]);
export const educationStageEnum = pgEnum("education_stage", [
  "high_school",
  "university",
  "graduate",
  "vocational",
  "other",
]);
export const opportunityStatusEnum = pgEnum("opportunity_status", ["draft", "published", "closed"]);
export const challengeStatusEnum = pgEnum("challenge_status", [
  "draft",
  "ai_generated",
  "pending_approval",
  "approved",
  "published",
]);
export const versionSourceEnum = pgEnum("version_source", ["ai_generated", "human_edited", "approved"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "applied",
  "shortlisted",
  "invited",
  "declined",
  "withdrawn",
]);
export const aiUsageModeEnum = pgEnum("ai_usage_mode", ["open", "ai_allowed", "restricted_ai", "controlled"]);
export const submissionStatusEnum = pgEnum("submission_status", ["submitted", "reviewed"]);
export const offerStatusEnum = pgEnum("offer_status", ["pending", "accepted", "declined"]);
export const placementFeeStatusEnum = pgEnum("placement_fee_status", ["unpaid", "stubbed_paid", "paid"]);
export const programStatusEnum = pgEnum("program_status", ["draft", "active", "completed"]);
export const internshipTaskStatusEnum = pgEnum("internship_task_status", ["pending", "in_progress", "done"]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Mirrors the Supabase Auth user id (auth.users.id) — set at signup. */
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  fullName: text("full_name").notNull(),
  ...timestamps,
});

export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  educationStage: educationStageEnum("education_stage"),
  university: text("university"),
  major: text("major"),
  graduationYear: integer("graduation_year"),
  location: text("location"),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  opportunityTypes: jsonb("opportunity_types").$type<string[]>().notNull().default([]),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  availability: text("availability"),
  cvUrl: text("cv_url"),
  cvFileKey: text("cv_file_key"),
  ...timestamps,
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  website: text("website"),
  industry: text("industry"),
  size: text("size"),
  verified: boolean("verified").notNull().default(false),
  ...timestamps,
});

export const companyMembers = pgTable(
  "company_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: companyMemberRoleEnum("role").notNull().default("member"),
    jobTitle: text("job_title"),
    ...timestamps,
  },
  (t) => [uniqueIndex("company_members_company_user_uidx").on(t.companyId, t.userId)],
);

// ---------------------------------------------------------------------------
// Opportunities & Challenges
// ---------------------------------------------------------------------------

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    description: text("description").notNull(),
    duration: text("duration").notNull(),
    hoursPerWeek: integer("hours_per_week").notNull(),
    location: text("location").notNull(),
    slots: integer("slots").notNull().default(1),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    status: opportunityStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [index("opportunities_company_idx").on(t.companyId)],
);

/**
 * A Challenge is the stable identity; every generation or edit produces a new
 * immutable ChallengeVersion row instead of overwriting fields in place. This
 * is what makes "keep the original AI output + edits + approved version"
 * possible, and what candidate_evidence.rubricVersionId anchors against.
 */
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    status: challengeStatusEnum("status").notNull().default("draft"),
    currentVersionId: uuid("current_version_id"),
    ...timestamps,
  },
  (t) => [index("challenges_opportunity_idx").on(t.opportunityId)],
);

export const challengeVersions = pgTable(
  "challenge_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    source: versionSourceEnum("source").notNull(),
    /** Free-text instruction that produced this version, when source is ai_generated via edit. */
    editInstruction: text("edit_instruction"),
    title: text("title").notNull(),
    scenario: text("scenario").notNull(),
    estimatedMinutes: integer("estimated_minutes").notNull(),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    tasks: jsonb("tasks").$type<{ id: string; title: string; description: string }[]>().notNull().default([]),
    deliverables: jsonb("deliverables").$type<string[]>().notNull().default([]),
    files: jsonb("files").$type<{ name: string; description: string }[]>().notNull().default([]),
    rubric: jsonb("rubric").$type<{ criterion: string; description: string }[]>().notNull().default([]),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("challenge_versions_challenge_idx").on(t.challengeId),
    uniqueIndex("challenge_versions_challenge_version_uidx").on(t.challengeId, t.versionNumber),
  ],
);

// ---------------------------------------------------------------------------
// Applications & Submissions
// ---------------------------------------------------------------------------

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("applied"),
    /** Set only when the student explicitly clicks "Start challenge" — never on page view. Distinguishes "to do" from "in progress" without inventing a completion percentage. */
    challengeStartedAt: timestamp("challenge_started_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("applications_opportunity_student_uidx").on(t.opportunityId, t.studentId),
    index("applications_student_idx").on(t.studentId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    /** Which exact Challenge content the student was given — never re-derive from the live challenge. */
    challengeVersionId: uuid("challenge_version_id")
      .notNull()
      .references(() => challengeVersions.id, { onDelete: "restrict" }),
    aiUsageMode: aiUsageModeEnum("ai_usage_mode").notNull().default("ai_allowed"),
    artifacts: jsonb("artifacts").$type<{ name: string; url: string }[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("submissions_application_idx").on(t.applicationId)],
);

/**
 * rubricVersionId pins the exact rubric used, so editing a Challenge's rubric
 * later never silently changes a historical evaluation's meaning.
 */
export const candidateEvidence = pgTable("candidate_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .unique()
    .references(() => submissions.id, { onDelete: "cascade" }),
  rubricVersionId: uuid("rubric_version_id")
    .notNull()
    .references(() => challengeVersions.id, { onDelete: "restrict" }),
  tasksCompleted: text("tasks_completed").notNull(),
  timeSpentMinutes: integer("time_spent_minutes").notNull(),
  aiSummary: text("ai_summary").notNull(),
  strength: text("strength").notNull(),
  weakness: text("weakness").notNull(),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Internship offer & program
// ---------------------------------------------------------------------------

export const internshipOffers = pgTable("internship_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .unique()
    .references(() => applications.id, { onDelete: "cascade" }),
  status: offerStatusEnum("status").notNull().default("pending"),
  /** QAR 499 placement fee is stubbed for v1 — see docs/06 & docs/08 resolved decision. */
  placementFeeStatus: placementFeeStatusEnum("placement_fee_status").notNull().default("unpaid"),
  ...timestamps,
});

export const internshipPrograms = pgTable("internship_programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id")
    .notNull()
    .unique()
    .references(() => internshipOffers.id, { onDelete: "cascade" }),
  internName: text("intern_name").notNull(),
  role: text("role").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  hoursPerWeek: integer("hours_per_week").notNull(),
  status: programStatusEnum("status").notNull().default("draft"),
  ...timestamps,
});

export const internshipWeeks = pgTable(
  "internship_weeks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => internshipPrograms.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    title: text("title").notNull(),
    objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex("internship_weeks_program_week_uidx").on(t.programId, t.weekNumber)],
);

export const internshipTasks = pgTable(
  "internship_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekId: uuid("week_id")
      .notNull()
      .references(() => internshipWeeks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: internshipTaskStatusEnum("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [index("internship_tasks_week_idx").on(t.weekId)],
);

export const supervisorFeedback = pgTable(
  "supervisor_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => internshipPrograms.id, { onDelete: "cascade" }),
    weekId: uuid("week_id").references(() => internshipWeeks.id, { onDelete: "set null" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    feedback: text("feedback").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("supervisor_feedback_program_idx").on(t.programId)],
);

export const verifiedExperience = pgTable("verified_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id")
    .notNull()
    .unique()
    .references(() => internshipPrograms.id, { onDelete: "cascade" }),
  workCompleted: jsonb("work_completed").$type<string[]>().notNull().default([]),
  skillsDemonstrated: jsonb("skills_demonstrated").$type<string[]>().notNull().default([]),
  supervisorVerified: boolean("supervisor_verified").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
});

export const savedOpportunities = pgTable(
  "saved_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_opportunities_student_opportunity_uidx").on(t.studentId, t.opportunityId),
    index("saved_opportunities_student_idx").on(t.studentId),
  ],
);

// ---------------------------------------------------------------------------
// Append-only audit trail
// ---------------------------------------------------------------------------

/**
 * Generic lifecycle event log — challenge published, submission received,
 * candidate shortlisted, invitation sent, supervisor evaluation submitted,
 * etc. "Evidence is the product, so history matters" (approved plan,
 * cross-cutting requirements). Never updated or deleted, only inserted.
 */
export const eventLog = pgTable(
  "event_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("event_log_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  companyMemberships: many(companyMembers),
  applications: many(applications),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  members: many(companyMembers),
  opportunities: many(opportunities),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, { fields: [companyMembers.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyMembers.userId], references: [users.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  company: one(companies, { fields: [opportunities.companyId], references: [companies.id] }),
  challenges: many(challenges),
  applications: many(applications),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  opportunity: one(opportunities, { fields: [challenges.opportunityId], references: [opportunities.id] }),
  versions: many(challengeVersions),
  currentVersion: one(challengeVersions, {
    fields: [challenges.currentVersionId],
    references: [challengeVersions.id],
  }),
}));

export const challengeVersionsRelations = relations(challengeVersions, ({ one }) => ({
  challenge: one(challenges, { fields: [challengeVersions.challengeId], references: [challenges.id] }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  opportunity: one(opportunities, { fields: [applications.opportunityId], references: [opportunities.id] }),
  student: one(users, { fields: [applications.studentId], references: [users.id] }),
  submissions: many(submissions),
  offer: one(internshipOffers, {
    fields: [applications.id],
    references: [internshipOffers.applicationId],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  application: one(applications, { fields: [submissions.applicationId], references: [applications.id] }),
  challengeVersion: one(challengeVersions, {
    fields: [submissions.challengeVersionId],
    references: [challengeVersions.id],
  }),
  evidence: one(candidateEvidence, {
    fields: [submissions.id],
    references: [candidateEvidence.submissionId],
  }),
}));

export const internshipOffersRelations = relations(internshipOffers, ({ one }) => ({
  application: one(applications, { fields: [internshipOffers.applicationId], references: [applications.id] }),
  program: one(internshipPrograms, {
    fields: [internshipOffers.id],
    references: [internshipPrograms.offerId],
  }),
}));

export const internshipProgramsRelations = relations(internshipPrograms, ({ one, many }) => ({
  offer: one(internshipOffers, { fields: [internshipPrograms.offerId], references: [internshipOffers.id] }),
  weeks: many(internshipWeeks),
  feedback: many(supervisorFeedback),
  verifiedExperience: one(verifiedExperience, {
    fields: [internshipPrograms.id],
    references: [verifiedExperience.programId],
  }),
}));

export const internshipWeeksRelations = relations(internshipWeeks, ({ one, many }) => ({
  program: one(internshipPrograms, {
    fields: [internshipWeeks.programId],
    references: [internshipPrograms.id],
  }),
  tasks: many(internshipTasks),
}));

export const internshipTasksRelations = relations(internshipTasks, ({ one }) => ({
  week: one(internshipWeeks, { fields: [internshipTasks.weekId], references: [internshipWeeks.id] }),
}));
