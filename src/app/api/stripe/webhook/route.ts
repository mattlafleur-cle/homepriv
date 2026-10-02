import { handleStripeWebhookRequest } from "@/lib/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
