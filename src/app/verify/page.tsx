"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ShieldCheck, RefreshCw, Inbox, ArrowRight, Clock, Server } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";
import { AuthShell } from "../signup/page";
import { timeAgo } from "@/lib/utils";

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}

function VerifyInner() {
  const { state, verifyToken, resendVerification, mailMode, serverMode, refreshAuth } = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const tokenParam = params.get("token");

  const [email, setEmail] = useState((params.get("email") || "").toLowerCase());
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const ranToken = useRef<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const inbox = state.mail
    .filter((m) => m.kind === "verify" && !m.used && (!normalized || m.to === normalized))
    .sort((a, b) => b.sentAt - a.sentAt);

  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  useEffect(() => {
    if (!tokenParam || ranToken.current === tokenParam) return;
    ranToken.current = tokenParam;
    setBusy(true);
    void (async () => {
      const res = await verifyToken(tokenParam);
      setBusy(false);
      if (res.ok) { setVerified(true); setError(""); toast.push({ kind: "ok", msg: "Email verified — your studio is unlocked." }); }
      else setError(res.error);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenParam]);

  const doVerify = (token: string) => {
    setBusy(true);
    void (async () => {
      const res = await verifyToken(token);
      setBusy(false);
      if (res.ok) { setVerified(true); setError(""); toast.push({ kind: "ok", msg: "Email verified — your studio is unlocked." }); }
      else setError(res.error);
    })();
  };

  const resend = () => {
    setError(""); setBusy(true);
    void (async () => {
      const res = await resendVerification(normalized);
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      setCooldown(30);
      toast.push({ kind: "ok", msg: mailMode === "dev" ? "A fresh link landed in your private dev inbox." : "A fresh verification email is on its way." });
    })();
  };

  if (verified) {
    return (
      <AuthShell accent="cyan" headline="Verified. The stage is yours." sub="Your email is confirmed and your studio account is fully active.">
        <div className="auth-card verify-success">
          <svg className="check-svg" viewBox="0 0 72 72" width="84" height="84" aria-hidden>
            <circle cx="36" cy="36" r="32" fill="none" stroke="url(#vg)" strokeWidth="4" className="check-ring" />
            <path d="M22 37l10 10 18-20" fill="none" stroke="url(#vg)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="check-tick" />
            <defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a3e635" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
          </svg>
          <h2>Email verified</h2>
          <p className="auth-copy">Your address is confirmed. Log in and post your first track — it will appear on every device.</p>
          <button className="btn btn-brand wfull" onClick={() => router.push(`/login${normalized ? `?email=${encodeURIComponent(normalized)}` : ""}`)}>
            Continue to login<ArrowRight size={16} />
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell accent="cyan" headline="One click between you and the stage." sub="We sent a verification link to your address. Open it to activate your studio — login unlocks right after.">
      <div className="auth-card">
        <div className="auth-card-head"><ShieldCheck size={20} /><h2>Verify your email</h2></div>

        <div className="field">
          <label className="label" htmlFor="vf-email">Which email did you sign up with?</label>
          <div className="input-icon"><Mail size={16} /><input id="vf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" /></div>
        </div>

        {mailMode === "dev" ? (
          <div className="inbox">
            <div className="inbox-head">
              <Inbox size={16} /><strong>Your private dev inbox</strong>
              <span className="inbox-badge">this browser only</span>
            </div>
            {inbox.length === 0 ? (
              <div className="inbox-empty">
                <Mail size={22} />
                <p>No active link in this browser. Sign up here, or request a fresh link below.</p>
                <button className="btn btn-ghost btn-sm" onClick={() => void refreshAuth()}><RefreshCw size={13} />Refresh inbox</button>
              </div>
            ) : inbox.map((m) => (
              <div className="mail" key={m.id}>
                <div className="mail-head">
                  <span className="mail-from-mark"><Mail size={15} /></span>
                  <div className="mail-from"><strong>I Listen AI Music</strong><em>to {m.to} · {timeAgo(m.sentAt)}</em></div>
                </div>
                <div className="mail-subject">Verify your email for I Listen AI Music</div>
                <p className="mail-body">Confirm this address to activate your login. The link is single-use and expires in 24 hours.</p>
                <button className="btn btn-brand wfull" onClick={() => doVerify(m.token)} disabled={busy}>
                  {busy ? <Spinner size={16} /> : <ShieldCheck size={16} />}<span>{busy ? "Verifying…" : "Verify my email"}</span>
                </button>
                <div className="mail-exp"><Clock size={12} />Expires {new Date(m.expiresAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="notice ok"><span><Server size={14} /> Real email is enabled. Open the message in your inbox and click the verification button.</span></div>
        )}

        {error && <div className="notice err">{error}</div>}

        <button className="btn btn-ghost wfull" onClick={resend} disabled={cooldown > 0 || busy || !normalized}>
          <RefreshCw size={15} className={cooldown > 0 ? "spin-slow" : ""} />
          <span>{cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}</span>
        </button>
        <p className="demo-hint">{serverMode === "supabase" ? "Tokens hashed in Postgres" : "Tokens hashed on your local server"}</p>
        <p className="auth-alt">Wrong address? <Link href="/signup">Sign up again</Link> · <Link href="/login">Back to login</Link></p>
      </div>
    </AuthShell>
  );
}