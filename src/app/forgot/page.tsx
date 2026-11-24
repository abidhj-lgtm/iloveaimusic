"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AtSign, KeyRound, Send, Inbox, Clock, ArrowRight } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";
import { AuthShell } from "../signup/page";
import { timeAgo } from "@/lib/utils";

export default function ForgotPage() {
  return <Suspense fallback={null}><ForgotInner /></Suspense>;
}

function ForgotInner() {
  const { state, mailMode, refreshAuth } = useStore();
  const toast = useToast();
  const params = useSearchParams();
  const [email, setEmail] = useState((params.get("email") || "").toLowerCase());
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const normalized = email.trim().toLowerCase();
  const resets = state.mail.filter((m) => m.to === normalized && !m.used).sort((a, b) => b.sentAt - a.sentAt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return setError("Enter the email you signed up with.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ email: normalized })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) { setError(data?.error ?? "Could not send the reset email."); return; }
      await refreshAuth();
      setSent(true);
      setCooldown(30);
      toast.push({ kind: "ok", msg: mailMode === "dev" ? "Reset link created in the server inbox." : "If that account exists, a reset email is on its way." });
      const iv = setInterval(() => setCooldown((c) => { if (c <= 1) clearInterval(iv); return c - 1; }), 1000);
    } catch {
      setError("Can't reach the server. Is the dev terminal still running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell accent="violet" headline="Locked out? Happens to the best of us." sub="We'll send a single-use link to choose a new password. It expires in one hour, and using it signs out every other device.">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-head"><KeyRound size={19} /><h2>Reset your password</h2></div>

        <div className="field">
          <label className="label" htmlFor="fg-email">Account email</label>
          <div className="input-icon"><AtSign size={16} /><input id="fg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" /></div>
        </div>

        {error && <div className="notice err">{error}</div>}
        {sent && <div className="notice ok"><span>Request received. For your privacy we don't reveal whether an account exists.</span></div>}

        <button className="btn btn-brand wfull" type="submit" disabled={busy || cooldown > 0}>
          {busy ? <Spinner size={16} /> : <Send size={16} />}
          <span>{busy ? "Sending…" : cooldown > 0 ? `Wait ${cooldown}s` : "Send reset link"}</span>
        </button>

        {mailMode === "dev" && resets.length > 0 && (
          <div className="inbox">
            <div className="inbox-head"><Inbox size={16} /><strong>Server dev inbox</strong><span className="inbox-badge">no SMTP key set</span></div>
            {resets.map((m) => (
              <div className="mail" key={m.id}>
                <div className="mail-subject">Reset your I Listen AI Music password</div>
                <p className="mail-body">Choose a new password within the hour. All other sessions will be signed out.</p>
                <Link className="btn btn-brand wfull" href={`/reset?token=${encodeURIComponent(m.token)}`}>
                  Choose a new password<ArrowRight size={15} />
                </Link>
                <div className="mail-exp"><Clock size={12} />Sent {timeAgo(m.sentAt)} · expires {new Date(m.expiresAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        )}

        <p className="auth-alt"><Link href="/login">Back to login</Link> · <Link href="/signup">Create a studio</Link></p>
      </form>
    </AuthShell>
  );
}