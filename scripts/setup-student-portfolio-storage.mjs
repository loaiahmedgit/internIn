// One-time infra: create the `student-portfolio` bucket as PUBLIC. Unlike
// CVs/submission-artifacts/challenge-resources (private documents behind a
// signed URL), portfolio thumbnails are voluntarily-shared, profile-facing
// images the student chooses to display — a public bucket is the right
// model here, same as an avatar would be. Idempotent — safe to re-run.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey);

async function ensurePublicBucket(bucketName) {
  const { data: existing, error: listError } = await supabase.storage.getBucket(bucketName);
  if (listError && !/not.*found/i.test(listError.message)) throw listError;

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    });
    if (createError) throw createError;
    console.log(`Created public bucket "${bucketName}".`);
    return;
  }

  if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, { public: true });
    if (updateError) throw updateError;
    console.log(`Flipped bucket "${bucketName}" to public.`);
  } else {
    console.log(`Bucket "${bucketName}" already public — no change.`);
  }
}

await ensurePublicBucket("student-portfolio");
console.log("Done.");
