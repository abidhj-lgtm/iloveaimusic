import { NextRequest } from "next/server";
import { bootstrap } from "@/server/auth-service";
import { json, readSessionToken, readDevBox, serverError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return json({ ok: true, ...(await bootstrap(readSessionToken(req), readDevBox(req))) });
  } catch (err) {
    return serverError(err, "Server configuration error.");
  }
}