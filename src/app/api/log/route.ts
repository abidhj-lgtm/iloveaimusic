import { NextRequest } from "next/server";
import { reportError, log } from "@/server/observability";
import { rateLimit } from "@/server/ratelimit";
import { clientIp, fail, ok, readBody, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const ip = clientIp(req);
  const limit = await rateLimit("react", `clientlog:${ip}`);
  if (!limit.ok) return ok({ dropped: true });

  const body = await readBody(req);
  const message = String(body.message ?? "").slice(0, 500);
  if (!message) return fail("Nothing to log.", 400, "validation");

  const err = new Error(message);
  if (typeof body.stack === "string") err.stack = body.stack.slice(0, 4000);

  reportError(err, {
    route: "client",
    url: String(body.url ?? "").slice(0, 300),
    userAgent: req.headers.get("user-agent")?.slice(0, 200),
    ip
  });
  log("info", "client.error.received", { route: "client", message });
  return ok();
}