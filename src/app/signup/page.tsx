"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AtSign, Lock, Eye, EyeOff, User, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";

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

export function AuthShell({ children, headline, sub, accent = "brand" }: { 
  children: React.ReactNode; headline: string; sub: string; accent?: string 
}) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>{headline}</h1>
          <p>{sub}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SignupPage() {
  const { signup, googleEnabled } = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const fail = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !pass || !confirm) return fail("All fields are required.");
    if (pass !== confirm) return fail("Passwords do not match.");
    if (pass.length < 8) return fail("Password must be at least 8 characters.");

    setBusy(true);
    const res = await signup(name, email, pass);
    setBusy(false);

    if (!res.ok) {
      return fail(res.error || "Signup failed.");
    }

    toast.push({ kind: "ok", msg: "Account created! Check your email for the verification link." });
    router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  };

  return (
    <AuthShell 
      headline="Create your studio." 
      sub="Sign up with your Gmail — we'll send a verification link before your first login."
    >
      <form className={`auth-card${shake ? " shake" : ""}`} onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="su-name">Artist name</label>
          <div className="input-icon">
            <User size={16} />
            <input id="su-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your artist name" autoComplete="name" />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="su-email">Gmail address</label>
          <div className="input-icon">
            <AtSign size={16} />
            <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="su-pass">Password</label>
          <div className="input-icon">
            <Lock size={16} />
            <input id="su-pass" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="su-confirm">Confirm password</label>
          <div className="input-icon">
            <Lock size={16} />
            <input id="su-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" />
          </div>
        </div>

        {error && <div className="notice err">{error}</div>}

        <button className="btn btn-brand wfull" type="submit" disabled={busy}>
          {busy ? <Spinner size={16} /> : <ArrowRight size={16} />}
          <span>{busy ? "Creating account…" : "Create account"}</span>
        </button>

        {googleEnabled && (
          <>
            <div className="divider"><span>or</span></div>
            <button 
              type="button" 
              className="btn gbtn wfull" 
              onClick={() => { window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`; }}
            >
              <GoogleMark />
              <span>Continue with Google</span>
            </button>
          </>
        )}

        <p className="auth-alt">
          Already have a studio? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}