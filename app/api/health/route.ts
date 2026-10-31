import { ok } from "@/lib/errors/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ status: "ok" as const });
}
