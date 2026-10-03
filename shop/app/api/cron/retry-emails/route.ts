import { timingSafeEqual } from "node:crypto";
import { retryEmails } from "@/lib/retry-emails";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return Response.json({error: "Unauthorized"}, {status: 401});
  }
  return Response.json(await retryEmails());
}
