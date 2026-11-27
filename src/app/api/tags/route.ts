import { NextRequest } from "next/server";
import { SUPABASE_URL } from "@/server/env";
import { fail, ok, serverError } from "@/server/http";
import { getDistinctTags } from "@/server/store/features";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!SUPABASE_URL) return fail("Needs Supabase mode.", 501, "mode");
  try {
    const tags = await getDistinctTags();
    return ok({ tags });
  } catch (err) {
    return serverError(err, "Could not load tags.");
  }
}