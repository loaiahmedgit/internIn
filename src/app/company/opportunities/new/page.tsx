import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompanyMembership } from "@/lib/auth";
import { hasPermission } from "@/lib/company/permissions";
import { CreateInternshipForm } from "@/components/opportunities/create-internship-form";

export default async function NewOpportunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const membershipResult = await getCurrentCompanyMembership();
  if (!membershipResult.ok) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-navy/60">
        This account isn&apos;t linked to a company yet.
      </div>
    );
  }
  // saveInternshipAction requires hiring_access to create/publish — check
  // it upfront so a member without that permission gets a clear message
  // instead of filling in the whole form before the server action rejects.
  if (!hasPermission(membershipResult.membership, "hiring_access")) {
    throw new Error("You do not have access to create internships. Ask a workspace administrator for Hiring Access.");
  }

  return <CreateInternshipForm />;
}
