"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Trash2, ShieldCheck, ArrowLeft, LogIn, AlertTriangle, Check } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";

export default function SettingsPage() {
  const { currentUser, serverMode, logout } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);

  if (!currentUser) {
    return (
      <div className="settings-page">
        <div className="mod-gate">
          <span className="mod-gate-icon"><LogIn size={28} /></span>
          <h1>Your account</h1>
          <p>Log in to export your data or close your studio.</p>
          <div className="mod-gate-actions">
            <Link href="/login?next=%2Fsettings" className="btn btn-brand">Log in</Link>
            <Link href="/" className="btn btn-ghost">Back to the feed</Link>
          </div>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="settings-page">
        <div className="mod-gate">
          <span className="mod-gate-icon"><Check size={28} /></span>
          <h1>Account closed</h1>
          <p>Your profile has been anonymised, your tracks removed and every session signed out. Media files are purged within seven days, except records we must retain for rights disputes.</p>
          <div className="mod-gate-actions"><Link href="/" className="btn btn-brand">Back to the feed</Link></div>
        </div>
      </div>
    );
  }

  const doExport = () => {
    window.location.href = "/api/account";
    toast.push({ kind: "ok", msg: "Preparing your data export…" });
  };

  const doDelete = async () => {
    setError("");
    if (confirm.trim() !== currentUser.handle) { setError(`Type your handle “${currentUser.handle}” exactly.`); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ confirm: confirm.trim() })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) { setError(j?.error ?? "Could not close the account."); return; }
      logout();
      setClosed(true);
      toast.push({ kind: "ok", msg: `Account closed. ${j.removedTracks ?? 0} track(s) removed.` });
    } catch { setError("Can't reach the server."); }
    finally { setBusy(false); }
  };

  return (
    <div className="settings-page">
      <Link href="/" className="back-link"><ArrowLeft size={16} />Back to feed</Link>
      <header className="seo-hero">
        <span className="seo-eyebrow"><ShieldCheck size={15} />{serverMode === "supabase" ? "Stored in Postgres" : "Stored on your local server"}</span>
        <h1>Your account</h1>
        <p>Data export and account closure, in the product — not just a promise in the privacy policy.</p>
      </header>

      <section className="settings-card">
        <div className="settings-head">
          <Download size={19} />
          <div><h2>Export your data</h2><p>A machine-readable JSON file with your profile, tracks, provenance declarations, comments, likes, saves, follows, reports and strikes.</p></div>
        </div>
        <button className="btn btn-brand" onClick={doExport}><Download size={16} />Download export</button>
        <p className="hint">Audio and cover files are referenced by storage path. Email hello@ilistenai.music for file copies.</p>
      </section>

      <section className="settings-card danger">
        <div className="settings-head">
          <AlertTriangle size={19} />
          <div><h2>Close your account</h2><p>This anonymises your profile, removes every track and comment, clears your likes, saves and follows, and signs out all devices. It cannot be undone from the interface.</p></div>
        </div>
        <ul className="settings-consequences">
          <li>Your artist page becomes unavailable and your tracks leave the feed and search.</li>
          <li>Media files are purged after a seven-day grace window.</li>
          <li>Audit records and rights-dispute evidence are retained as required.</li>
        </ul>
        <div className="field">
          <label className="label" htmlFor="del-confirm">Type <code>{currentUser.handle}</code> to confirm</label>
          <input id="del-confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={currentUser.handle} autoComplete="off" />
        </div>
        {error && <div className="notice err">{error}</div>}
        <button className="btn btn-danger" onClick={doDelete} disabled={busy || confirm.trim() !== currentUser.handle}>
          {busy ? <Spinner size={16} /> : <Trash2 size={16} />}<span>{busy ? "Closing…" : "Permanently close my account"}</span>
        </button>
      </section>

      <p className="settings-foot">
        See the <Link href="/legal/privacy">Privacy Policy</Link> for retention details, or <Link href="/legal/terms">Terms</Link> for account obligations.
      </p>
      <button className="btn btn-ghost btn-sm" onClick={() => { logout(); router.push("/"); }}>Log out</button>
    </div>
  );
}