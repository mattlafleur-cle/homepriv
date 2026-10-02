import { handleAgentInquiry } from "@/lib/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAgentInquiry(request);
}
