import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  sendInternshipOfferEmail,
  sendSubmissionReceivedEmail,
  sendOfferRespondedEmail,
  sendFeedbackAddedEmail,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendInternshipOfferEmail, sendSubmissionReceivedEmail, sendOfferRespondedEmail, sendFeedbackAddedEmail],
});
