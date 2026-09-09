-- Phase 6B — student-writable task fields (blocked status + blocker note +
-- evidence note/url), plus a column-level write guard for students.
-- Hand-written, same rationale as 0024's own header comment.

ALTER TYPE "public"."internship_task_status" ADD VALUE IF NOT EXISTS 'blocked';
--> statement-breakpoint

ALTER TABLE "internship_tasks" ADD COLUMN IF NOT EXISTS "blocker_note" text;
--> statement-breakpoint
ALTER TABLE "internship_tasks" ADD COLUMN IF NOT EXISTS "evidence_note" text;
--> statement-breakpoint
ALTER TABLE "internship_tasks" ADD COLUMN IF NOT EXISTS "evidence_url" text;
--> statement-breakpoint

-- Real gap found during Phase 6B audit: internship_tasks_update (RLS,
-- 0014) already let a student's OWN Supabase client rewrite any column of
-- their own program's tasks via direct API calls — a browser Supabase
-- client with the user's session exists in this repo (src/lib/supabase/
-- client.ts), so RLS is a real enforcement boundary here, not just
-- defense-in-depth. Declarative RLS policies can't compare old vs. new
-- column values in one WITH CHECK expression, so this is a trigger, not a
-- second policy. Company members (matched the same way every sibling RLS
-- policy on this table already does) are completely unrestricted; a
-- student may change status/blocker_note/evidence_note/evidence_url
-- (exactly the fields Phase 6B's student actions write) but never the
-- supervisor-authored title/description/week_id.
CREATE OR REPLACE FUNCTION public.guard_internship_task_student_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.internship_weeks w
    JOIN public.internship_programs p ON p.id = w.program_id
    JOIN public.internship_offers io ON io.id = p.offer_id
    JOIN public.applications a ON a.id = io.application_id
    JOIN public.opportunities o ON o.id = a.opportunity_id
    WHERE w.id = NEW.week_id AND public.is_company_member(o.company_id)
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.week_id IS DISTINCT FROM OLD.week_id THEN
    RAISE EXCEPTION 'Students may only update status, blocker_note, evidence_note, and evidence_url on a task.';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.guard_internship_task_student_edits() FROM public;
--> statement-breakpoint

DROP TRIGGER IF EXISTS internship_tasks_student_edit_guard ON public.internship_tasks;
--> statement-breakpoint
CREATE TRIGGER internship_tasks_student_edit_guard
BEFORE UPDATE ON public.internship_tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_internship_task_student_edits();
