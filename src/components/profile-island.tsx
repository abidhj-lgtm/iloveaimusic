"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles, Heart, Bookmark, Headphones } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { CompactCard, EmptyState } from "@/components/track-card";
import { Modal, Field } from "@/components/ui";
import { PALETTES } from "@/lib/covers";

export function ProfileActions({ handle }: { handle: string }) {
  const { state, currentUser, isFollowing, toggleFollow } = useStore();
  const toast = useToast();
  const router = useRouter();
  const user = state.users.find((u) => u.handle === handle);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [palette, setPalette] = useState(0);
  const store = useStore();
  if (!user) return null;
  const self = currentUser?.id === user.id;

  const openEdit = () => { setName(user.name); setBio(user.bio); setPalette(user.avatarPalette); setOpen(true); };
  const save = () => {
    if (name.trim().length < 2) { toast.push({ kind: "err", msg: "Artist name needs at least 2 characters." }); return; }
    store.updateProfile({ name: name.trim(), bio: bio.trim(), avatarPalette: palette });
    setOpen(false);
    toast.push({ kind: "ok", msg: "Profile updated." });
  };

  return (
    <div className="prof-actions">
      {self ? (
        <>
          <button className="btn btn-ghost" onClick={openEdit}><Pencil size={15} />Edit profile</button>
          <Link href="/create" className="btn btn-brand"><Sparkles size={15} />Post music</Link>
        </>
      ) : (
        <button className={`btn ${isFollowing(user.id) ? "btn-ghost" : "btn-brand"}`} onClick={() => {
          if (!currentUser) { toast.push({ kind: "info", msg: "Log in to follow artists.", action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(`/profile/${handle}`)}`) } }); return; }
          toggleFollow(user.id);
          toast.push({ kind: "ok", msg: isFollowing(user.id) ? `Unfollowed ${user.name}.` : `Following ${user.name}.` });
        }}>{isFollowing(user.id) ? "Following" : "Follow"}</button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Edit profile" width={440}>
        <div className="edit-profile">
          <Field label="Artist name" required><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Bio" counter={`${bio.length}/200`}><textarea className="textarea" rows={3} maxLength={200} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What do you make, and why?" /></Field>
          <Field label="Avatar palette">
            <div className="swatches">
              {PALETTES.map((p, i) => (
                <button key={p.name} title={p.name} aria-label={`Palette ${p.name}`} className={`swatch${palette === i ? " active" : ""}`} style={{ background: `linear-gradient(135deg, ${p.a}, ${p.b})` }} onClick={() => setPalette(i)} />
              ))}
            </div>
          </Field>
          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-brand" onClick={save}>Save profile</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function ProfileGrid({ handle }: { handle: string }) {
  const { state } = useStore();
  const user = state.users.find((u) => u.handle === handle);
  if (!user) return null;
  const tracks = state.tracks.filter((t) => t.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  if (!tracks.length) return null;
  return (
    <section className="section seo-section">
      <h2 className="section-title"><Headphones size={18} />Play the discography</h2>
      <div className="grid3">{tracks.map((t) => <CompactCard key={t.id} track={t} queue={tracks.map((x) => x.id)} />)}</div>
    </section>
  );
}

export function ProfileCollections({ handle }: { handle: string }) {
  const { state, currentUser } = useStore();
  const user = state.users.find((u) => u.handle === handle);
  const [tab, setTab] = useState<"liked" | "saved">("liked");
  if (!user) return null;
  const self = currentUser?.id === user.id;
  const liked = state.tracks.filter((t) => state.likes.some((l) => l.userId === user.id && l.trackId === t.id));
  const saved = self ? state.tracks.filter((t) => state.saves.some((l) => l.userId === user.id && l.trackId === t.id)) : [];
  const list = tab === "liked" ? liked : saved;

  return (
    <section className="section seo-section">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "liked"} className={`tab-btn${tab === "liked" ? " active" : ""}`} onClick={() => setTab("liked")}><Heart size={15} />Liked · {liked.length}</button>
        {self && <button role="tab" aria-selected={tab === "saved"} className={`tab-btn${tab === "saved" ? " active" : ""}`} onClick={() => setTab("saved")}><Bookmark size={15} />Saved · {saved.length}</button>}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Headphones size={26} />} title={tab === "liked" ? "Nothing hearted yet" : "Nothing saved yet"}
          body={tab === "liked" ? "Tracks this artist hearts will collect here." : "Bookmark tracks from the feed to build your collection."} />
      ) : (
        <div className="grid3">{list.map((t) => <CompactCard key={t.id} track={t} queue={list.map((x) => x.id)} />)}</div>
      )}
    </section>
  );
}

export function ProfileLiveStats({ handle }: { handle: string }) {
  const { state, likeCount } = useStore();
  const user = state.users.find((u) => u.handle === handle);
  if (!user) return null;
  const tracks = state.tracks.filter((t) => t.userId === user.id);
  const fmt = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`);
  return (
    <div className="prof-stats">
      <span><strong>{tracks.length}</strong><em>tracks</em></span>
      <span><strong>{fmt(tracks.reduce((a, t) => a + likeCount(t), 0))}</strong><em>likes</em></span>
      <span><strong>{fmt(tracks.reduce((a, t) => a + t.plays, 0))}</strong><em>plays</em></span>
      <span><strong>{fmt(state.follows.filter((f) => f.targetId === user.id).length)}</strong><em>followers</em></span>
    </div>
  );
}