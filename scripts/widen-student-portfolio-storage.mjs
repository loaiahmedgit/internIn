// Widens the existing public `student-portfolio` bucket (created by
// setup-student-portfolio-storage.mjs) to also accept PDF, so portfolio-item
// "Attachment" uploads (a research PDF, a writing sample) work — not just
// thumbnail/avatar/banner images. Idempotent — safe to re-run.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey);

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

const { data: existing, error: getError } = await supabase.storage.getBucket("student-portfolio");
if (getError) throw getError;

const alreadyIncludesPdf = (existing.allowed_mime_types ?? []).includes("application/pdf");
if (alreadyIncludesPdf) {
  console.log("Bucket already allows PDF — no change.");
} else {
  const { error: updateError } = await supabase.storage.updateBucket("student-portfolio", {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
  if (updateError) throw updateError;
  console.log("Widened student-portfolio bucket to also allow PDF (8MB limit).");
}
