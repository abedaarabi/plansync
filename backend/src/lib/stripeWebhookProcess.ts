/**
 * Stripe webhook idempotency: run handler first, mark processed only on success.
 * Marking before the handler means Stripe retries after a failure are skipped.
 */

export type StripeWebhookProcessStore = {
  hasProcessed: (eventId: string) => Promise<boolean>;
  markProcessed: (eventId: string) => Promise<void>;
};

export type StripeWebhookProcessResult =
  | { status: "duplicate" }
  | { status: "ok" }
  | { status: "failed"; error: unknown };

export async function processStripeWebhookOnce(
  eventId: string,
  store: StripeWebhookProcessStore,
  handle: () => Promise<void>,
): Promise<StripeWebhookProcessResult> {
  if (await store.hasProcessed(eventId)) return { status: "duplicate" };

  try {
    await handle();
  } catch (error) {
    return { status: "failed", error };
  }

  try {
    await store.markProcessed(eventId);
  } catch (error) {
    // Concurrent delivery: another worker may have marked the same eventId.
    if (await store.hasProcessed(eventId)) return { status: "ok" };
    return { status: "failed", error };
  }
  return { status: "ok" };
}
