import type { Metadata } from "next";
import { AdminCatalog } from "@/components/admin-catalog";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Catalog moderation", description: "Staff-only track and account inventory.",
  path: "/admin/catalog", noindex: true
});

export default function AdminCatalogPage() {
  return <AdminCatalog />;
}