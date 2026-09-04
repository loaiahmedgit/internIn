import { Inngest, type EventPayload } from "inngest";

export const inngest = new Inngest({ id: "internin" });

/**
 * Notification delivery is a side effect, never the source of truth for
 * whether a core action (submitting a challenge, sending an offer, ...)
 * succeeded. A transient failure reaching the event bus (the local dev
 * server not running, a network blip) must never surface as an error to
 * the caller after the real DB writes already committed — that's a
 * misleading failure that can make a student think a real submission was
 * lost. Every inngest.send call site should go through this instead of
 * calling inngest.send directly.
 */
export async function sendNotificationEvent(event: EventPayload): Promise<void> {
  try {
    await inngest.send(event);
  } catch (error) {
    console.error(`[inngest] failed to send "${event.name}" — the underlying action already succeeded and is not affected:`, error);
  }
}
