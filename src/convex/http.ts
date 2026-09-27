import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Stripe webhook: checkout.session.completed → activate the subscription
 * server-side (idempotent by session id); customer.subscription.deleted →
 * cancel. Signature verified with STRIPE_WEBHOOK_SECRET.
 */
const stripeWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return new Response(JSON.stringify({ error: "stripe not configured" }), { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const payload = await request.text();
  const stripe = new Stripe(key);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const ref = session.client_reference_id ?? "";
    const [refUser, refPlan] = ref.split(":");
    if (refUser && refPlan) {
      await ctx.runMutation(internal.manualPayments.webhookActivateInternal, {
        sessionId: session.id,
        userId: refUser as never,
        planId: refPlan as never,
      });
    }
  } else if (event.type === "customer.subscription.deleted") {
    // client_reference_id is not present on subscription events; resolve the
    // customer email → user via metadata we set at checkout when possible.
    const sub = event.data.object as Stripe.Subscription;
    const metaRef = (sub.metadata?.userId ?? "") as string;
    if (metaRef) {
      await ctx.runMutation(internal.manualPayments.webhookCancelInternal, {
        userId: metaRef as never,
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

http.route({ path: "/stripe-webhook", method: "POST", handler: stripeWebhook });

export default http;
