"use client";

import React, { useState } from "react";
import { Flag, ShieldAlert, Send, Check } from "lucide-react";
import { Modal, Spinner } from "./ui";
import { useToast } from "@/lib/store";

const REASONS = [
  { id: "copyright", label: "Copyright", hint: "Uses a recording, sample, vocal or artwork you own without permission." },
  { id: "spam", label: "Spam", hint: "Duplicate posts, flooding the feed, or promotional noise." },
  { id: "hate", label: "Hate / harassment", hint: "Targets a person or group with abuse." },
  { id: "explicit_mislabel", label: "Explicit mislabel", hint: "Explicit content marked as safe." },
  { id: "broken_media", label: "Broken audio", hint: "The track will not load or play." },
  { id: "impersonation", label: "Impersonation", hint: "Pretends to be another artist or person." },
  { id: "other", label: "Something else", hint: "Anything the categories above miss." }
] as const;

export function ReportDialog({ open, onClose, trackId, commentId, targetLabel }: {
  open: boolean; onClose: () => void; trackId?: string; commentId?: string; targetLabel: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<string>("copyright");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (details.trim().length < 12) { setError("Give moderators at least a sentence to work with."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ trackId, commentId, reason, details: details.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) { setError(data?.error ?? "Could not file the report."); return; }
      setDone(true);
      toast.push({ kind: "ok", msg: "Report filed. A moderator will review it." });
      setTimeout(() => { onClose(); setDone(false); setDetails(""); }, 1600);
    } catch {
      setError("Can't reach the server.");
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report this" width={520}>
      {done ? (
        <div className="trust-done">
          <span className="trust-done-mark"><Check size={30} /></span>
          <h4>Report received</h4>
          <p>It is in the moderation queue now. If we act on it, the content changes for everyone.</p>
        </div>
      ) : (
        <div className="trust-report">
          <div className="trust-target"><ShieldAlert size={17} /><span>{targetLabel}</span></div>
          <p className="trust-copy">Reports are read by a human moderator. Copyright claims are prioritised and can result in removal.</p>

          <div className="trust-reasons" role="radiogroup" aria-label="Report reason">
            {REASONS.map((r) => (
              <button key={r.id} role="radio" aria-checked={reason === r.id}
                className={`trust-reason${reason === r.id ? " on" : ""}`} onClick={() => setReason(r.id)}>
                <span className="trust-radio" />
                <span><strong>{r.label}</strong><em>{r.hint}</em></span>
              </button>
            ))}
          </div>

          <div className="field">
            <div className="field-top">
              <label className="label" htmlFor="rp-details">What happened?</label>
              <span className="counter">{details.length}/1000</span>
            </div>
            <textarea id="rp-details" className="textarea" rows={4} maxLength={1000} value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={reason === "copyright" ? "Name the work you own, where it appears in this post, and how you can be reached." : "Describe the problem clearly enough that a moderator can act without guessing."} />
          </div>

          {error && <div className="notice err">{error}</div>}

          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-danger" onClick={submit} disabled={busy}>
              {busy ? <Spinner size={15} /> : <Flag size={15} />}<span>{busy ? "Filing…" : "File report"}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}