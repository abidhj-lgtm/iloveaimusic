"use client";

import React, { useState } from "react";
import { Flag, ShieldCheck } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useStore, useToast } from "@/lib/store";
import { ReportDialog } from "./report-dialog";
import { RightsPanel } from "./rights-panel";

export function TrackTrust({ trackId, title, ownerPublicId, initialRights }: {
  trackId: string; title: string; ownerPublicId: string; initialRights: unknown;
}) {
  const { currentUser } = useStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isOwner = currentUser?.id === ownerPublicId;

  const startReport = () => {
    if (!currentUser) {
      toast.push({ kind: "info", msg: "Log in to report content.", action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    setOpen(true);
  };

  return (
    <section className="section seo-section" id="provenance">
      <h2 className="section-title"><ShieldCheck size={18} />Rights &amp; provenance</h2>
      <RightsPanel trackId={trackId} isOwner={isOwner} initial={initialRights as never} />
      {!isOwner && (
        <div className="trust-report-cta">
          <p>Something wrong with this post? Reports go to a human moderator, and copyright claims are prioritised.</p>
          <button className="btn btn-danger-ghost btn-sm" onClick={startReport}><Flag size={14} />Report this track</button>
        </div>
      )}
      <ReportDialog open={open} onClose={() => setOpen(false)} trackId={trackId} targetLabel={title} />
    </section>
  );
}