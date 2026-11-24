import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin-console";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Moderation console", description: "Staff-only moderation queue for I Listen AI Music.",
  path: "/admin", noindex: true
});

export default function AdminPage() {
  return <AdminConsole />;
}