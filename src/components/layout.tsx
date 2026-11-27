"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, Search, Bookmark, User as UserIcon, LogOut, Volume2, VolumeX, Music2, Headphones, Sparkles, ListMusic, BarChart3 } from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { Logo, Avatar, Menu } from "./ui";
import { NotificationBell } from "./notifications";
import { formatCount } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, state, setPrefs, logout } = useStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const prefs = state.prefs;

  const myTracks = currentUser ? state.tracks.filter((t) => t.userId === currentUser.id) : [];
  const isHome = pathname === "/";

  return (
    <>
      <div className="scene" aria-hidden>
        <div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="blob b4" />
        <div className="vignette" />
      </div>

      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav className="nav-links" aria-label="Primary">
            <Link href="/" className={`nav-link${isHome ? " active" : ""}`}><Home size={16} />Feed</Link>
            <Link href="/create" className={`nav-link${pathname === "/create" ? " active" : ""}`}><Plus size={16} />Post music</Link>
          </nav>
          <div className="header-actions">
            <button
              className={`icon-btn mute-btn${prefs.muted ? " muted" : ""}`}
              onClick={() => setPrefs({ muted: !prefs.muted })}
              aria-label={prefs.muted ? "Unmute all sound" : "Mute all sound"}
              title={prefs.muted ? "Sound is muted — click to unmute" : "Mute all sound"}
            >
              {prefs.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <Link href="/create" className="btn btn-brand btn-sm header-cta"><Sparkles size={15} /><span>Post music</span></Link>
            <NotificationBell />
            {currentUser ? (
              <Menu
                trigger={<Avatar user={currentUser} size={32} />}
                items={[
                  { label: "Your profile", icon: <UserIcon size={16} />, onClick: () => router.push(`/profile/${currentUser.handle}`) },
                  { label: "Saved tracks", icon: <Bookmark size={16} />, onClick: () => router.push("/?view=saved") },
                  { label: "Your playlists", icon: <ListMusic size={16} />, onClick: () => router.push("/playlists") },
                  { label: "Creator analytics", icon: <BarChart3 size={16} />, onClick: () => router.push("/analytics") },
                  { label: "Log out", icon: <LogOut size={16} />, danger: true, onClick: () => { logout(); toast.push({ kind: "info", msg: "Logged out. The music keeps playing." }); router.push("/"); } }
                ]}
              />
            ) : (
              <div className="auth-btns">
                <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
                <Link href="/signup" className="btn btn-brand btn-sm">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="sidebar" aria-label="Sidebar">
        <nav className="side-nav">
          <Link href="/" className={`side-link${isHome ? " active" : ""}`}><Home size={19} /><span>Home</span></Link>
          <Link href="/?focus=search" className="side-link"><Search size={19} /><span>Explore</span></Link>
          <Link href="/create" className={`side-link${pathname === "/create" ? " active" : ""}`}><Plus size={19} /><span>Create</span></Link>
          <Link href="/?view=saved" className="side-link"><Bookmark size={19} /><span>Saved</span></Link>
          <Link href={currentUser ? `/profile/${currentUser.handle}` : "/login"} className={`side-link${pathname.startsWith("/profile") ? " active" : ""}`}><UserIcon size={19} /><span>Profile</span></Link>
        </nav>
        <Link href="/create" className="btn btn-brand side-cta"><Music2 size={17} /><span>Post music</span></Link>
        {currentUser ? (
          <Link href={`/profile/${currentUser.handle}`} className="side-user">
            <Avatar user={currentUser} size={38} />
            <span className="side-user-info">
              <strong>{currentUser.name}</strong>
              <em>@{currentUser.handle}</em>
            </span>
          </Link>
        ) : (
          <div className="side-join">
            <Headphones size={20} />
            <p>Join the studio to post your AI music.</p>
            <Link href="/signup" className="btn btn-brand btn-sm">Create account</Link>
          </div>
        )}
        <div className="side-foot">
          <span>{formatCount(state.tracks.length)} tracks · {formatCount(state.users.length)} artists</span>
          <span>I Love AI Music © 2026</span>
        </div>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="Mobile navigation">
        <Link href="/" className={`tab${isHome ? " active" : ""}`} aria-label="Home"><Home size={22} /></Link>
        <Link href="/?focus=search" className="tab" aria-label="Search"><Search size={22} /></Link>
        <Link href="/create" className="tab tab-create" aria-label="Post music"><Plus size={24} /></Link>
        <Link href="/?view=saved" className="tab" aria-label="Saved"><Bookmark size={22} /></Link>
        <Link href={currentUser ? `/profile/${currentUser.handle}` : "/login"} className={`tab${pathname.startsWith("/profile") ? " active" : ""}`} aria-label="Profile"><UserIcon size={22} /></Link>
      </nav>
    </>
  );
}