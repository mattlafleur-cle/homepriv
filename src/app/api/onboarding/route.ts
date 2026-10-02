import { handleOnboarding } from "@/lib/handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleOnboarding(request);
}
