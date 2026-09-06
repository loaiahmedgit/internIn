// One-time infra: create the private student-certifications bucket used for
// optional certificate PDF evidence on student_certifications. Mirrors
// setup-challenge-storage.mjs's pattern. Certificate PDFs can carry a full
// legal name, credential number, dates — a different security class than
// portfolio media, so this is its own private bucket, not the public
// student-portfolio one. Idempotent — safe to re-run.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey);

const BUCKET = "student-certifications";
const MAX_BYTES = 8 * 1024 * 1024;

const { data: existing, error: listError } = await supabase.storage.getBucket(BUCKET);
if (listError && !/not.*found/i.test(listError.message)) throw listError;

if (!existing) {
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["application/pdf"],
  });
  if (createError) throw createError;
  console.log(`Created private bucket "${BUCKET}" (PDF only, 8MB limit).`);
} else if (existing.public) {
  const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["application/pdf"],
  });
  if (updateError) throw updateError;
  console.log(`Flipped bucket "${BUCKET}" from public to private.`);
} else {
  console.log(`Bucket "${BUCKET}" already private — no change.`);
}
console.log("Done.");
