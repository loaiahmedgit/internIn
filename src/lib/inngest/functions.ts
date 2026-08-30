import { Resend } from "resend";
import { z } from "zod";
import { inngest } from "./client";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hiringNotificationRecipients } from "@/lib/company/notification-recipients";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

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
    const resend = getResend();
    if (!resend) return { skipped: "RESEND_API_KEY not set" };

    await resend.emails.send({
      from: "internIn <noreply@internin.app>",
      to: data.studentEmail,
      subject: `${data.companyName} invited you to an internship`,
      text: `Hi ${data.studentName},\n\n${data.companyName} has invited you to an internship for the ${data.role} role.\n\nReview and respond here: ${appUrl()}/student/applications/${data.applicationId}\n\n— internIn`,
    });

    return { sent: true };
  },
);

const SubmissionReceivedDataSchema = z.object({
  companyEmails: z.array(z.string().email()).min(1),
  studentName: z.string(),
  role: z.string(),
  submissionId: z.string().uuid(),
});

export const sendSubmissionReceivedEmail = inngest.createFunction(
  { id: "send-submission-received-email", triggers: [{ event: "submission/received" }] },
  async ({ event }) => {
    const data = SubmissionReceivedDataSchema.parse(event.data);
    const [application] = await getDb().select({ opportunityId: schema.applications.opportunityId }).from(schema.submissions).innerJoin(schema.applications, eq(schema.applications.id, schema.submissions.applicationId)).where(eq(schema.submissions.id, data.submissionId));
    const recipients = application ? await hiringNotificationRecipients(application.opportunityId, "submission") : [];
    if (!recipients.length) return { skipped: "No subscribed hiring members" };
    const resend = getResend();
    if (!resend) return { skipped: "RESEND_API_KEY not set" };

    await resend.emails.send({
      from: "internIn <noreply@internin.app>",
      to: recipients,
      subject: `New submission for ${data.role}`,
      text: `${data.studentName} just submitted their Challenge for ${data.role}.\n\nReview it here: ${appUrl()}/company/submissions/${data.submissionId}\n\n— internIn`,
    });

    return { sent: true };
  },
);

const OfferRespondedDataSchema = z.object({
  companyEmails: z.array(z.string().email()).min(1),
  studentName: z.string(),
  role: z.string(),
  decision: z.enum(["accepted", "declined"]),
  opportunityId: z.string().uuid(),
});

export const sendOfferRespondedEmail = inngest.createFunction(
  { id: "send-offer-responded-email", triggers: [{ event: "internship_offer/responded" }] },
  async ({ event }) => {
    const data = OfferRespondedDataSchema.parse(event.data);
    const recipients = await hiringNotificationRecipients(data.opportunityId, "offer");
    if (!recipients.length) return { skipped: "No subscribed hiring members" };
    const resend = getResend();
    if (!resend) return { skipped: "RESEND_API_KEY not set" };

    await resend.emails.send({
      from: "internIn <noreply@internin.app>",
      to: recipients,
      subject: `${data.studentName} ${data.decision} your internship offer`,
      text: `${data.studentName} has ${data.decision} the internship offer for ${data.role}.\n\nView the opportunity here: ${appUrl()}/company/opportunities/${data.opportunityId}\n\n— internIn`,
    });

    return { sent: true };
  },
);

const FeedbackAddedDataSchema = z.object({
  studentEmail: z.string().email(),
  studentName: z.string(),
  companyName: z.string(),
  feedback: z.string(),
  applicationId: z.string().uuid(),
});

export const sendFeedbackAddedEmail = inngest.createFunction(
  { id: "send-feedback-added-email", triggers: [{ event: "supervisor_feedback/added" }] },
  async ({ event }) => {
    const data = FeedbackAddedDataSchema.parse(event.data);
    const resend = getResend();
    if (!resend) return { skipped: "RESEND_API_KEY not set" };

    const snippet = data.feedback.length > 280 ? `${data.feedback.slice(0, 280)}…` : data.feedback;

    await resend.emails.send({
      from: "internIn <noreply@internin.app>",
      to: data.studentEmail,
      subject: `${data.companyName} left you feedback`,
      text: `Hi ${data.studentName},\n\n${data.companyName} left new feedback on your internship:\n\n"${snippet}"\n\nView it here: ${appUrl()}/student/applications/${data.applicationId}\n\n— internIn`,
    });

    return { sent: true };
  },
);
