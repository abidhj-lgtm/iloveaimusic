import { NextRequest } from "next/server";
import { getRights, setRights } from "@/server/trust/service";
import { rightsSchema, firstIssue } from "@/server/validation";
import { resolveSession } from "@/server/session";
import { clientIp, fail, ok, readBody, readSessionToken, sameOrigin, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const rights = await getRights(id);
    return rights ? ok({ rights }) : fail("Track not found.", 404, "notfound");
  } catch (err) {
    return serverError(err, "Could not load provenance.");
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return fail("Blocked cross-site request.", 403, "csrf");
  const { id } = await params;
  const viewer = await resolveSession(readSessionToken(req));
  if (!viewer) return fail("Log in first.", 401, "unauthorized");

  const parsed = rightsSchema.safeParse(await readBody(req));
  if (!parsed.success) return fail(firstIssue(parsed.error), 400, "validation");
  const p = parsed.data;

  try {
    const res = await setRights(id, viewer.id, {
      attested: true, license: p.license, ai_tool: p.aiTool,
      human_contribution: p.humanContribution, explicit: p.explicit,
      third_party_samples: p.thirdPartySamples, monetizable: p.monetizable,
      distribution_ok: p.distributionOk
    }, clientIp(req));
    return res.ok ? ok({ rights: res.rights }) : fail(res.error!, 403, "forbidden");
  } catch (err) {
    return serverError(err, "Could not save provenance.");
  }
}