"use server";

import { z } from "zod";
import { ChallengeSchema } from "@/lib/ai";
import { ChallengeDraftSchema, type ChallengeDraft } from "@/lib/ai/challenge-clarification-schemas";
import { mapChallengeDraftToChallenge } from "@/lib/opportunities/challenge-draft-mapping";
import { saveChallengeVersionAction } from "@/lib/opportunities/actions";

const IdSchema = z.string().uuid();

/**
 * Saves an Ask internIn challenge draft as a real challenge_versions row,
 * entering the exact same ai_generated -> pending_approval -> approved ->
 * published pipeline every other challenge in the app goes through —
 * never published or auto-approved here. Requires a real opportunityId;
 * Ask internIn only offers this action once the employer has an
 * internship selected as the conversation's scope.
 */
export async function saveChallengeDraftAction(opportunityId: string, draft: ChallengeDraft) {
  const validatedOpportunityId = IdSchema.parse(opportunityId);
  const validatedDraft = ChallengeDraftSchema.parse(draft);
  const challenge = ChallengeSchema.parse(mapChallengeDraftToChallenge(validatedDraft));
  return saveChallengeVersionAction(validatedOpportunityId, challenge, "ai_generated");
}
