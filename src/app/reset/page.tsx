"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Spinner } from "@/components/ui";
import { AuthShell } from "../signup/page";

export default function ResetPage() {
  return <Suspense fallback={null}><ResetInner /></Suspense>;
}

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { refreshAuth } = useStore();
  const token = params.get("token") ?? "";

  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);

  const strength = Math.min(4, (pass.length >= 8 ? 1 : 0) + (pass.length >= 12 ? 1 : 0) + (/[A-Z]/.test(pass) && /[a-z]/.test(pass) ? 1 : 0) + (/\d/.test(pass) || /[^a-zA-Z0-9]/.test(pass) ? 1 : 0));
  const label = ["Too short", "Okay", "Good", "Strong", "Excellent"][strength];
  const fail = (m: string) => { setError(m); setShake(true); setTimeout(() => setShake(false), 500); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) return fail("This reset link is missing its token. Request a new one.");
    if (pass.length < 8) return fail("Password needs at least 8 characters.");
    if (pass !== confirm) return fail("Passwords don't match.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ token, password: pass })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) { fail(data?.error ?? "Reset failed."); return; }
      await refreshAuth();
      setDone(true);
      toast.push({ kind: "ok", msg: "Password updated. Every other device was signed out." });
    } catch {
      fail("Can't reach the server. Is the dev terminal still running?");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell accent="cyan" headline="New password, clean slate." sub="Your credentials are updated and old sessions are revoked.">
        <div className="auth-card verify-success">
          <ShieldCheck size={64} style={{ color: "#a3e635" }} />
          <h2>Password updated</h2>
          <p className="auth-copy">Log in with your new password to get back to the studio.</p>
          <button className="btn btn-brand wfull" onClick={() => router.push("/login")}>Continue to login<ArrowRight size={16} /></button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell accent="violet" headline="Choose something memorable." sub="Eight characters minimum. Longer is better. This link works once and expires an hour after it was issued.">
      <form className={`auth-card${shake ? " shake" : ""}`} onSubmit={submit}>
        <div className="auth-card-head"><Lock size={19} /><h2>Set a new password</h2></div>

        {!token && <div className="notice err"><span>No token in this link.</span><Link className="btn btn-ghost btn-sm" href="/forgot">Request a new one</Link></div>}

        <div className="field">
          <label className="label" htmlFor="rs-pass">New password</label>
          <div className="input-icon">
            <Lock size={16} />
            <input id="rs-pass" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {pass && (
            <div className="strength">
              <div className="meter">{[0, 1, 2, 3].map((i) => <i key={i} className={i < strength ? `on s${strength}` : ""} />)}</div>
              <span>{label}</span>
            </div>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="rs-confirm">Confirm password</label>
          <div className="input-icon"><Lock size={16} /><input id="rs-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Once more" autoComplete="new-password" /></div>
        </div>

        {error && <div className="notice err">{error}</div>}

        <button className="btn btn-brand wfull" type="submit" disabled={busy || !token}>
          {busy ? <Spinner size={16} /> : <ShieldCheck size={16} />}<span>{busy ? "Updating…" : "Update password"}</span>
        </button>
        <p className="auth-alt"><Link href="/login">Back to login</Link></p>
      </form>
    </AuthShell>
  );
}