import { createHash } from "node:crypto";
import type { CandidateDetail } from "./candidate-detail-data";

export function evidenceFingerprint(detail: CandidateDetail) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        submission: detail.submission,
        profile: detail.profile,
        challenge: detail.challenge,
        requirements: detail.requirements,
      }),
    )
    .digest("hex");
}
