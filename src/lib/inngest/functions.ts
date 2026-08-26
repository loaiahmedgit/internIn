import { Resend } from "resend";
import { z } from "zod";
import { inngest } from "./client";

const OfferCreatedDataSchema = z.object({
  studentEmail: z.string().email(),
  studentName: z.string(),
  companyName: z.string(),
  role: z.string(),
  applicationId: z.string().uuid(),
});

/**
 * Runs as a background job so inviteToInternshipAction's response doesn't
 * wait on an email provider round-trip. No-ops cleanly if RESEND_API_KEY
 * isn't set, matching the mock-AI-provider fail-closed pattern elsewhere.
 */
export const sendInternshipOfferEmail = inngest.createFunction(
  { id: "send-internship-offer-email", triggers: [{ event: "internship/offer.created" }] },
  async ({ event }) => {
    const data = OfferCreatedDataSchema.parse(event.data);
    if (!process.env.RESEND_API_KEY) return { skipped: "RESEND_API_KEY not set" };

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await resend.emails.send({
      from: "internIn <noreply@internin.app>",
      to: data.studentEmail,
      subject: `${data.companyName} invited you to an internship`,
      text: `Hi ${data.studentName},\n\n${data.companyName} has invited you to an internship for the ${data.role} role.\n\nReview and respond here: ${appUrl}/student/applications/${data.applicationId}\n\n— internIn`,
    });

    return { sent: true };
  },
);
