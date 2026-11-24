"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AtSign, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";
import { AuthShell } from "../signup/page";

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

const OAUTH_ERRORS: Record<string, string> = {
  "google-off": "Google sign-in isn't configured on this deployment yet.",
  "google-state": "That Google session expired. Please try again.",
  "google-exchange": "Google didn't confirm your account. Please try again.",
  "google-account": "We couldn't open a studio for that Google account."
};

function LoginInner() {
  const { login, demoLogin, currentUser, googleEnabled, serverMode } = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState(params.get("email") || "");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? OAUTH_ERRORS[params.get("error")!] ?? "Sign-in failed." : "");
  const [unverified, setUnverified] = useState(false);
  const [shake, setShake] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/bootstrap", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setDemoEnabled(!!j?.demoEnabled); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const fail = (msg: string) => { setError(msg); setShake(true); setTimeout(() => setShake(false), 500); };

  if (currentUser) {
    return (
      <AuthShell headline="You're already in the studio." sub="The feed is one click away.">
        <div className="auth-card">
          <p className="auth-copy">Signed in as <strong>{currentUser.name}</strong>.</p>
          <Link href="/" className="btn btn-brand wfull">Go to the feed<ArrowRight size={16} /></Link>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setUnverified(false);
    if (!email.trim() || !pass) return fail("Enter your email and password.");
    setBusy(true);
    const res = await login(email, pass);
    setBusy(false);
    if (!res.ok) {
      if (res.code === "unverified") { setUnverified(true); return fail("Your email isn't verified yet."); }
      return fail(res.error);
    }
    toast.push({ kind: "ok", msg: "Welcome back to the studio." });
    router.push(next);
  };

  return (
    <AuthShell headline="Welcome back. The feed missed you." sub="Log in to post music, heart tracks, and follow the artists making the strangest beautiful sound on the internet.">
      <form className={`auth-card${shake ? " shake" : ""}`} onSubmit={submit}>
        <div className="auth-card-head"><Lock size={19} /><h2>Log in</h2></div>

        <div className="field">
          <label className="label" htmlFor="li-email">Email</label>
          <div className="input-icon"><AtSign size={16} /><input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" /></div>
        </div>
        <div className="field">
          <div className="field-top">
            <label className="label" htmlFor="li-pass">Password</label>
            <Link className="more-btn" href={`/forgot${email ? `?email=${encodeURIComponent(email)}` : ""}`}>Forgot password?</Link>
          </div>
          <div className="input-icon">
            <Lock size={16} />
            <input id="li-pass" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Your password" autoComplete="current-password" />
            <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>

        {error && <div className="notice err">{error}</div>}
        {unverified && (
          <div className="notice warn">
            <span>Verify your email to unlock login.</span>
            <Link className="btn btn-ghost btn-sm" href={`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`}><ShieldCheck size={14} />Verify now</Link>
          </div>
        )}

        <button className="btn btn-brand wfull" type="submit" disabled={busy}>
          {busy ? <Spinner size={16} /> : <ArrowRight size={16} />}<span>{busy ? "Checking…" : "Log in"}</span>
        </button>

        <div className="divider"><span>or</span></div>

        {googleEnabled ? (
          <button type="button" className="btn gbtn wfull" onClick={() => { window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`; }}>
            <GoogleMark /><span>Continue with Google</span>
          </button>
        ) : (
          <div className="notice ok"><span><KeyRound size={14} /> Google sign-in activates once OAuth keys are added to <code>.env.local</code>.</span></div>
        )}

        {demoEnabled && (
          <>
            <button type="button" className="btn btn-outline wfull demo-btn" onClick={() => {
              demoLogin();
              toast.push({ kind: "ok", msg: "Welcome to the demo studio, Aria." });
              router.push(next);
            }}>
              <Sparkles size={16} /><span>Enter the demo studio</span>
            </button>
            <p className="demo-hint">Demo account: <code>aria@gmail.com</code> · <code>demo1234</code> — development only.</p>
          </>
        )}

        <p className="demo-hint">{serverMode === "supabase" ? "Accounts stored in Postgres" : "Accounts stored on your local server"} · sessions are HTTP-only cookies</p>
        <p className="auth-alt">New here? <Link href="/signup">Create your studio</Link></p>
      </form>
    </AuthShell>
  );
}