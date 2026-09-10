"use server";

import { requireCurrentCompanyMember } from "@/lib/auth";
import { extractRoleReality, proposeAssessmentPlan } from "@/lib/ai/challenge-architect";
import type { RoleReality } from "./architect";

export async function understandRoleAction(description: string, known?: RoleReality) {
  await requireCurrentCompanyMember("hiring_access");
  return extractRoleReality(description, known);
}

export async function designAssessmentPlanAction(input: Parameters<typeof proposeAssessmentPlan>[0]) {
  await requireCurrentCompanyMember("hiring_access");
  return proposeAssessmentPlan(input);
}
