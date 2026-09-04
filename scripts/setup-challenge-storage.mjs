// Two real, one-time infra changes for the work-sample engine's private
// storage requirement (non-negotiable per the approved plan):
//   1. Create the new `challenge-resources` bucket as PRIVATE.
//   2. Flip the existing `submission-artifacts` bucket from public -> private
//      (real student submissions must never be publicly readable).
// Idempotent — safe to re-run. Uses the service-role client directly (same
// package src/lib/supabase/admin.ts wraps) since this is a standalone
// script, not part of the Next.js app.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceRoleKey);

async function ensurePrivateBucket(bucketName) {
  const { data: existing, error: listError } = await supabase.storage.getBucket(bucketName);
  if (listError && !/not.*found/i.test(listError.message)) throw listError;

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: false });
    if (createError) throw createError;
    console.log(`Created private bucket "${bucketName}".`);
    return;
  }

  if (existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, { public: false });
    if (updateError) throw updateError;
    console.log(`Flipped bucket "${bucketName}" from public to private.`);
  } else {
    console.log(`Bucket "${bucketName}" already private — no change.`);
  }
}

await ensurePrivateBucket("challenge-resources");
await ensurePrivateBucket("submission-artifacts");
console.log("Done.");
