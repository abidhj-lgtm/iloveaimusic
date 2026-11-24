"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Lock, Eye, EyeOff, User as UserIcon, Sparkles, Music2, Wand2, Heart, ArrowRight } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Logo, Spinner } from "@/components/ui";

export function AuthShell({ children, accent = "violet", headline, sub }: {
  children: React.ReactNode; accent?: string; headline: string; sub: string;
}) {
  return (
    <div className={`auth accent-${accent}`}>
      <div className="auth-brand">
        <Logo large />
        <h1>{headline}</h1>
        <p>{sub}</p>
        <div className="auth-wave" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 90}ms`, height: `${18 + ((i * 37) % 46)}px` }} />)}
        </div>
        <ul className="auth-points">
          <li><Music2 size={17} /><span>Upload audio or embed from YouTube</span></li>
          <li><Wand2 size={17} /><span>Share the exact prompt behind every track</span></li>
          <li><Heart size={17} /><span>A feed that actually listens back</span></li>
        </ul>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  );
}

export default function SignupPage() {
  const { signup, currentUser } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  if (currentUser) {
    return (
      <AuthShell accent="magenta" headline="You're already in the studio." sub="Log out first if you want to create another account.">
        <div className="auth-card">
          <p className="auth-copy">Signed in as <strong>{currentUser.name}</strong>.</p>
          <Link href="/" className="btn btn-brand wfull">Go to the feed<ArrowRight size={16} /></Link>
        </div>
      </AuthShell>
    );
  }

  const strength = Math.min(4, (pass.length >= 8 ? 1 : 0) + (pass.length >= 12 ? 1 : 0) + (/[A-Z]/.test(pass) && /[a-z]/.test(pass) ? 1 : 0) + (/\d/.test(pass) || /[^a-zA-Z0-9]/.test(pass) ? 1 : 0));
  const strengthLabel = ["Too short", "Okay", "Good", "Strong", "Excellent"][strength];

  const fail = (msg: string) => { setError(msg); setShake(true); setTimeout(() => setShake(false), 500); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return fail("Tell us your artist name (at least 2 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return fail("That email doesn't look right. Try your Gmail address.");
    if (pass.length < 8) return fail("Password needs at least 8 characters.");
    if (pass !== confirm) return fail("Passwords don't match.");
    setBusy(true);
    const res = await signup(name, email, pass);
    setBusy(false);
    if (!res.ok) return fail(res.error + (res.code === "exists" ? " Try logging in instead." : ""));
    toast.push({ kind: "ok", msg: "Account created — verify your email to unlock login." });
    router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  };

  return (
    <AuthShell accent="magenta" headline="Where AI music finds its listeners." sub="Create your studio account. Post a track, tell its story, share the prompt — and let the feed do the rest.">
      <form className={`auth-card${shake ? " shake" : ""}`} onSubmit={submit}>
        <div className="auth-card-head"><Sparkles size={20} /><h2>Create your studio</h2></div>
        <p className="auth-copy">Sign up with your Gmail — we'll send a verification link before your first login.</p>

        <div className="field">
          <label className="label" htmlFor="su-name">Artist name</label>
          <div className="input-icon"><UserIcon size={16} /><input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria Vale" autoComplete="name" maxLength={40} /></div>
        </div>
        <div className="field">
          <label className="label" htmlFor="su-email">Gmail address</label>
          <div className="input-icon"><AtSign size={16} /><input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" /></div>
        </div>
        <div className="field">
          <label className="label" htmlFor="su-pass">Password</label>
          <div className="input-icon">
            <Lock size={16} />
            <input id="su-pass" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          {pass && (
            <div className="strength">
              <div className="meter">{[0, 1, 2, 3].map((i) => <i key={i} className={i < strength ? `on s${strength}` : ""} />)}</div>
              <span>{strengthLabel}</span>
            </div>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="su-confirm">Confirm password</label>
          <div className="input-icon"><Lock size={16} /><input id="su-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Once more, with feeling" autoComplete="new-password" /></div>
        </div>

        {error && <div className="notice err">{error}</div>}

        <button className="btn btn-brand wfull" type="submit" disabled={busy}>
          {busy ? <Spinner size={16} /> : <Sparkles size={16} />}<span>{busy ? "Creating…" : "Create account"}</span>
        </button>
        <p className="auth-alt">Already have a studio? <Link href="/login">Log in</Link></p>
      </form>
    </AuthShell>
  );
}