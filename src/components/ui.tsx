"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Check, Copy, Loader2 } from "lucide-react";
import { avatarUrl } from "@/lib/covers";
import { copyText } from "@/lib/utils";
import { useToast } from "@/lib/store";
import { SITE } from "@/lib/seo";
import type { User } from "@/lib/types";

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link href="/" className={`brand${large ? " brand-lg" : ""}`} aria-label={`${SITE.name} — home`}>
      <span className="brand-mark" aria-hidden>
        <svg viewBox="0 0 32 32" width={large ? 40 : 30} height={large ? 40 : 30}>
          <defs>
            <linearGradient id="lg-brand" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#7c3aed" /><stop offset="0.55" stopColor="#ec4899" /><stop offset="1" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          <path d="M16 28.5C16 28.5 3 21.2 3 12.6C3 8.4 6.2 5.5 9.9 5.5C12.4 5.5 14.7 6.9 16 9C17.3 6.9 19.6 5.5 22.1 5.5C25.8 5.5 29 8.4 29 12.6C29 21.2 16 28.5 16 28.5Z" fill="url(#lg-brand)" />
          <rect x="9" y="13" width="2.6" height="6" rx="1.3" fill="#0a0712" opacity="0.85" />
          <rect x="13.2" y="10.5" width="2.6" height="11" rx="1.3" fill="#0a0712" opacity="0.85" />
          <rect x="17.4" y="12" width="2.6" height="8" rx="1.3" fill="#0a0712" opacity="0.85" />
          <rect x="21.6" y="14.5" width="2.2" height="3.5" rx="1.1" fill="#0a0712" opacity="0.85" />
        </svg>
      </span>
      <span className="brand-text">I Love <em>AI Music</em></span>
    </Link>
  );
}

export function Avatar({ user, size = 38, ring = false }: { user: User; size?: number; ring?: boolean }) {
  const img = <img src={avatarUrl(user.name, user.avatarPalette)} alt={user.name} width={size} height={size} className="avatar-img" style={{ width: size, height: size }} />;
  return ring ? <span className="avatar-ring" style={{ width: size + 6, height: size + 6 }}>{img}</span> : img;
}

export function SmartImg({ src, fallback, alt, className }: { src: string; fallback: string; alt: string; className?: string }) {
  const [cur, setCur] = useState(src);
  useEffect(() => { setCur(src); }, [src]);
  return <img src={cur} alt={alt} className={className} loading="lazy" onError={() => { if (cur !== fallback) setCur(fallback); }} />;
}

export function Modal({ open, onClose, title, children, width = 460 }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="modal-head">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Delete" }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: React.ReactNode; confirmLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <div className="confirm-body">{body}</div>
      <div className="confirm-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Menu({ trigger, items }: {
  trigger: React.ReactNode;
  items: { label: string; icon?: React.ReactNode; danger?: boolean; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="More options">{trigger}</button>
      {open && (
        <div className="menu" role="menu">
          {items.map((it, i) => (
            <button key={i} role="menuitem" className={`menu-item${it.danger ? " danger" : ""}`} onClick={() => { setOpen(false); it.onClick(); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CopyButton({ text, label = "Copy", className = "btn btn-ghost btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const toast = useToast();
  return (
    <button className={className} onClick={async () => {
      const ok = await copyText(text);
      if (ok) { setDone(true); setTimeout(() => setDone(false), 2000); }
      else toast.push({ kind: "err", msg: "Couldn't copy — your browser blocked clipboard access." });
    }}>
      {done ? <Check size={15} /> : <Copy size={15} />}<span>{done ? "Copied" : label}</span>
    </button>
  );
}

export const Spinner = ({ size = 18 }: { size?: number }) => <Loader2 size={size} className="spin" />;

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, error, counter, children, required }: {
  label: string; hint?: string; error?: string; counter?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className={`field${error ? " field-error" : ""}`}>
      <div className="field-top">
        <label className="label">{label}{required && <span className="req"> *</span>}</label>
        {counter && <span className="counter">{counter}</span>}
      </div>
      {children}
      {error ? <div className="error-text">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export const Eq = ({ playing, small = false }: { playing: boolean; small?: boolean }) => (
  <span className={`eq${playing ? " on" : ""}${small ? " eq-sm" : ""}`} aria-hidden><i /><i /><i /><i /><i /></span>
);