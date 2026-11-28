"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Heart, MessageCircle, Share2, Bookmark, Play, Pause, MoreHorizontal, Pencil, Trash2,
  Link2, Youtube, Upload, Wand2, Loader2, Send, X, Music2, Disc3, Headphones, Flag, Smile
} from "lucide-react";
import type { Track } from "@/lib/types";
import { useStore, useToast } from "@/lib/store";
import { usePlayer } from "@/lib/player";
import { useMediaUrl } from "@/lib/idb";
import { coverUrl } from "@/lib/covers";
import { ytThumb } from "@/lib/youtube";
import { timeAgo, formatCount, formatDuration, copyText, blip } from "@/lib/utils";
import { Avatar, SmartImg, Menu, Eq, ConfirmDialog, EmptyState, ErrorBoundary } from "./ui";
import { ReportDialog } from "./report-dialog";
import { AddToPlaylistButton } from "./playlist-ui";

export function useTrackThumb(t: Track): { src: string; fallback: string } {
  const media = useMediaUrl(t.thumbKey);
  const fallback = coverUrl(t.coverSeed, t.coverPalette);
  const src = t.source === "youtube" && t.youtubeId ? ytThumb(t.youtubeId) : (media ?? fallback);
  return { src, fallback };
}

/* ---------------- expressive comment kit ---------------- */

const COMMENT_MAX = 1000;
const RECENT_KEY = "iloveai:emoji:recent";

const EMOJI_SETS: { id: string; label: string; items: string[] }[] = [
  { id: "faces", label: "😂 Faces", items: ["😂","🥹","😍","🤩","😭","🔥","👀","💀","🤯","🥲","😌","🤔","😅","😊","🙃","😴","🤤","😳","🥺","😤","🫠","😮‍💨","🤪","😎"] },
  { id: "hearts", label: "💜 Hearts", items: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💖","💗","💓","💞","💕","❣️","💘","💝","♥️","💟","🩷","🩵","🫶","💌"] },
  { id: "music", label: "🎧 Music", items: ["🎵","🎶","🎧","🎤","🎸","🎹","🥁","🎺","🎷","🎻","🪕","📻","🔊","🎼","🎚️","🎛️","🪩","🕺","💃","🎙️","🔁","⏯️"] },
  { id: "hype", label: "🔥 Hype", items: ["🔥","✨","⚡","💫","🌟","⭐","🎉","🎊","🚀","💯","👑","🏆","🥇","💎","🌈","☄️","🫧","🪄","🧨","🎯","📈","🆙"] },
  { id: "hands", label: "👏 Hands", items: ["👏","🙌","🤝","👍","🤙","✌️","🤞","👌","🫶","🫰","💪","🙏","👋","🤟","✋","🖐️","👐","🫡","🤌","🖖","🫵","🤲"] },
  { id: "vibes", label: "🌙 Vibes", items: ["🌙","☀️","🌊","🍃","🌸","🌺","🍀","🌵","🌴","🌌","🪐","❄️","🌁","🏙️","🌃","🌆","🕯️","🫖","🍜","🛸","🧿","🪷"] }
];

const EMOJI_NAMES: Record<string, string> = {
  "😂": "joy laugh funny lol", "🥹": "holding back tears moved", "😍": "heart eyes love",
  "🤩": "star struck amazed", "😭": "sob crying loud", "🔥": "fire hot lit",
  "👀": "eyes look watching", "💀": "skull dead dying", "🤯": "mind blown exploding head",
  "🥲": "happy tear grateful", "😌": "relieved calm", "🤔": "thinking hmm",
  "😅": "sweat smile nervous", "😊": "blush smile happy", "🙃": "upside down silly",
  "😴": "sleeping tired", "🤤": "drool want", "😳": "flushed shocked",
  "🥺": "pleading puppy eyes", "😤": "triumph determined", "🫠": "melting",
  "😮‍💨": "exhale relief", "🤪": "zany crazy", "😎": "cool sunglasses",
  "❤️": "red heart love", "🧡": "orange heart", "💛": "yellow heart", "💚": "green heart",
  "💙": "blue heart", "💜": "purple heart", "🖤": "black heart", "🤍": "white heart",
  "💖": "sparkling heart", "💗": "growing heart", "💓": "beating heart",
  "💞": "revolving hearts", "💕": "two hearts", "❣️": "heart exclamation",
  "💘": "cupid arrow heart", "💝": "heart gift", "♥️": "heart suit",
  "💟": "heart decoration", "🩷": "pink heart", "🩵": "light blue heart",
  "🫶": "heart hands love", "💌": "love letter",
  "🎵": "music note", "🎶": "notes music", "🎧": "headphones listen",
  "🎤": "microphone sing", "🎸": "guitar rock", "🎹": "piano keys",
  "🥁": "drum beat", "🎺": "trumpet horn", "🎷": "saxophone jazz",
  "🎻": "violin strings", "🪕": "banjo", "📻": "radio", "🔊": "speaker loud volume",
  "🎼": "score sheet music", "🎚️": "level slider mix", "🎛️": "knobs studio",
  "🪩": "mirror ball disco", "🕺": "man dancing", "💃": "dancer dance",
  "🎙️": "studio mic podcast", "🔁": "repeat loop", "⏯️": "play pause",
  "✨": "sparkles shine", "⚡": "zap lightning energy", "💫": "dizzy stars",
  "🌟": "glowing star", "⭐": "star favourite", "🎉": "tada party celebrate",
  "🎊": "confetti party", "🚀": "rocket launch", "💯": "hundred perfect",
  "👑": "crown king queen", "🏆": "trophy winner", "🥇": "gold medal first",
  "💎": "gem diamond", "🌈": "rainbow", "☄️": "comet", "🫧": "bubbles",
  "🪄": "magic wand", "🧨": "firecracker", "🎯": "dart target bullseye",
  "📈": "chart up trending", "🆙": "up button",
  "👏": "clap applause", "🙌": "raised hands praise", "🤝": "handshake deal",
  "👍": "thumbs up like", "🤙": "call me hang loose", "✌️": "peace victory",
  "🤞": "crossed fingers luck", "👌": "ok perfect", "🫰": "pinched fingers",
  "💪": "muscle strong", "🙏": "pray thanks please", "👋": "wave hello",
  "🤟": "love you gesture", "✋": "raised hand stop", "🖐️": "splayed hand",
  "👐": "open hands", "🫡": "salute respect", "🤌": "pinched italian",
  "🖖": "vulcan spock", "🫵": "pointing at you", "🤲": "palms up",
  "🌙": "moon night", "☀️": "sun sunny", "🌊": "wave ocean sea",
  "🍃": "leaf breeze", "🌸": "cherry blossom spring", "🌺": "hibiscus flower",
  "🍀": "clover luck", "🌵": "cactus desert", "🌴": "palm tree",
  "🌌": "milky way galaxy space", "🪐": "planet saturn", "❄️": "snowflake cold",
  "🌁": "foggy mist", "🏙️": "cityscape skyline", "🌃": "night stars city",
  "🌆": "city sunset dusk", "🕯️": "candle calm", "🫖": "teapot tea",
  "🍜": "noodles ramen", "🛸": "ufo alien", "🧿": "evil eye", "🪷": "lotus"
};

const EMOTICON_HINTS: [string, string][] = [
  [":-)", "🙂"], [":)", "🙂"], ["(:", "🙂"], [":-D", "😄"], [":D", "😄"],
  [":-(", "🙁"], [":(", "🙁"], [":'(", "😢"], [";-)", "😉"], [";)", "😉"],
  [":-P", "😛"], [":P", "😛"], [":p", "😛"], [":-O", "😮"], [":O", "😮"],
  [":-/", "😕"], [":/", "😕"], [":-*", "😘"], [":*", "😘"],
  ["B)", "😎"], ["8)", "😎"], ["<3", "❤️"], ["</3", "💔"],
  ["^_^", "😊"], ["T_T", "😭"], [">_<", "😣"], ["xD", "😆"], ["XD", "😆"]
].sort((a, b) => b[0].length - a[0].length);

const WORD_HINTS: Record<string, string[]> = {
  fire: ["🔥"], lit: ["🔥"], heat: ["🔥"], banger: ["🔥", "💯"],
  love: ["❤️", "😍"], heart: ["❤️", "💜"], hearts: ["💕", "💖"],
  lol: ["😂"], haha: ["😂"], funny: ["😂"], dead: ["💀"], dying: ["💀"],
  cry: ["😭"], crying: ["😭"], sob: ["😭"], tears: ["🥹", "😭"],
  wow: ["🤯", "😮"], amazing: ["🤩", "✨"], crazy: ["🤯", "🤪"],
  clap: ["👏"], applause: ["👏"], bravo: ["👏", "🙌"],
  thanks: ["🙏", "💜"], thank: ["🙏"], please: ["🥺", "🙏"],
  perfect: ["💯", "👌"], hundred: ["💯"], best: ["🏆", "👑"],
  king: ["👑"], queen: ["👑"], goat: ["🐐", "👑"],
  party: ["🎉", "🪩"], celebrate: ["🎉", "🎊"], congrats: ["🎉", "🏆"],
  dance: ["💃", "🕺"], dancing: ["💃", "🕺"], disco: ["🪩"],
  music: ["🎵", "🎶"], song: ["🎵"], beat: ["🥁", "🔥"],
  guitar: ["🎸"], piano: ["🎹"], drums: ["🥁"], sing: ["🎤"],
  headphones: ["🎧"], listen: ["🎧"], repeat: ["🔁"],
  star: ["⭐", "🌟"], shine: ["✨"], sparkle: ["✨"], magic: ["🪄"],
  rocket: ["🚀"], launch: ["🚀"], fast: ["⚡"], energy: ["⚡"],
  strong: ["💪"], respect: ["🫡", "🙏"], salute: ["🫡"],
  wave: ["👋"], hello: ["👋"], hey: ["👋"],
  yes: ["🙌", "👍"], no: ["🙅"], ok: ["👌"], cool: ["😎"],
  moon: ["🌙"], night: ["🌃", "🌙"], sun: ["☀️"], summer: ["☀️", "🌴"],
  ocean: ["🌊"], sea: ["🌊"], chill: ["😌", "🍃"], calm: ["😌", "🕯️"],
  rain: ["🌧️"], snow: ["❄️"], cold: ["❄️"], flower: ["🌸", "🌺"],
  space: ["🌌", "🪐"], galaxy: ["🌌"], rainbow: ["🌈"],
  coffee: ["☕"], tea: ["🫖"], noodles: ["🍜"], sleep: ["😴"], tired: ["😴"]
};

interface Sug { emoji: string; label: string }
interface SugResult { token: string; items: Sug[] }

function computeSuggestions(text: string): SugResult | null {
  const short = /:([a-z0-9_]{2,20})$/i.exec(text);
  if (short) {
    const q = short[1].toLowerCase();
    const hits = Object.entries(EMOJI_NAMES)
      .filter(([, n]) => n.split(" ").some((w) => w.startsWith(q)))
      .slice(0, 6)
      .map(([emoji, n]) => ({ emoji, label: n.split(" ")[0] }));
    if (hits.length) return { token: short[0], items: hits };
  }
  for (const [token, emoji] of EMOTICON_HINTS) {
    if (!text.endsWith(token)) continue;
    const before = text.slice(0, text.length - token.length);
    if (before && !/\s$/.test(before)) continue;
    return { token, items: [{ emoji, label: token }] };
  }
  const word = /(?:^|\s)([a-z]{2,14})$/i.exec(text);
  if (word) {
    const hits = WORD_HINTS[word[1].toLowerCase()];
    if (hits?.length) return { token: word[1], items: hits.map((e) => ({ emoji: e, label: word[1] })) };
  }
  return null;
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 24); } catch { return []; }
}
function pushRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecent().filter((e) => e !== emoji)].slice(0, 24);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota */ }
  return next;
}

function visualLength(s: string): number {
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) return [...new Seg("en", { granularity: "grapheme" }).segment(s)].length;
  } catch { /* older browser */ }
  return [...s].length;
}

function isEmojiOnly(s: string): boolean {
  const t = s.trim();
  if (!t || visualLength(t) > 12) return false;
  try {
    return /^(?:\p{Extended_Pictographic}|[\u200D\uFE0F\uFE0E\u{1F3FB}-\u{1F3FF}\u20E3]|\s)+$/u.test(t)
      && /\p{Extended_Pictographic}/u.test(t);
  } catch { return false; }
}

export function SourceBadge({ t, compact = false }: { t: Track; compact?: boolean }) {
  const size = compact ? 11 : 13;
  if (t.source === "youtube") return <span className={`src-badge yt${compact ? " sm" : ""}`}><Youtube size={size} />{t.live ? "Live" : "YouTube"}</span>;
  if (t.preset) return <span className={`src-badge gen${compact ? " sm" : ""}`}><Wand2 size={size} />Synth</span>;
  return <span className={`src-badge up${compact ? " sm" : ""}`}><Upload size={size} />Upload</span>;
}

export function PromptChip({ prompt }: { prompt: string }) {
  const toast = useToast();
  if (!prompt.trim()) return null;
  return (
    <button className="prompt-chip" title="Copy the style prompt"
      onClick={async () => { const ok = await copyText(prompt); toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Prompt copied — go make something." : "Couldn't copy the prompt." }); }}>
      <Wand2 size={13} /><span>{prompt}</span>
    </button>
  );
}

export function LyricsView({ track }: { track: Track }) {
  if (track.instrumental || !track.lyrics.trim()) {
    return (
      <div className="instru">
        <Disc3 size={34} className="slow-spin" />
        <div><strong>Instrumental</strong><p>No lyrics — let the frequencies do the talking.</p></div>
      </div>
    );
  }
  return (
    <div className="lyrics">
      {track.lyrics.replace(/\r/g, "").split(/\n{2,}/).map((block, bi) => (
        <div className="stanza" key={bi}>
          {block.split("\n").map((line, li) => {
            const m = line.trim().match(/^\[(.+)\]$/);
            if (m) return <span className="sec-marker" key={li}>{m[1]}</span>;
            return <span className="lyric-line" key={li}>{line || "\u00A0"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

function CommentsPanelInner({ track, autoFocus = false }: { track: Track; autoFocus?: boolean }) {
  const { currentUser, commentsFor, userById, addComment, deleteComment } = useStore();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<{ id: string; label: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState<string>("recent");
  const [emojiQuery, setEmojiQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [sugIdx, setSugIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const comments = commentsFor(track.id);

  useEffect(() => { setRecent(loadRecent()); }, []);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [comments.length]);

  // auto-grow the textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(148, el.scrollHeight)}px`;
  }, [text]);

  // close picker on outside click / Escape
  useEffect(() => {
    if (!picker) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pickerRef.current?.contains(t) || inputRef.current?.contains(t)) return;
      setPicker(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [picker]);

  const sug = computeSuggestions(text);
  const sugs = sug?.items ?? [];
  const activeSug = Math.min(sugIdx, Math.max(0, sugs.length - 1));
  const used = visualLength(text);
  const left = COMMENT_MAX - used;
  const canSend = text.trim().length > 0 && left >= 0;

  const remember = (emoji: string) => setRecent(pushRecent(emoji));

  const insert = (chunk: string) => {
    const el = inputRef.current;
    if (/^\p{Extended_Pictographic}/u.test(chunk)) remember(chunk);
    if (!el) { setText((t) => t + chunk); return; }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + chunk + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + chunk.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const acceptSuggestion = (s: Sug) => {
    if (!sug) return;
    const cut = text.length - sug.token.length;
    setText(text.slice(0, cut) + s.emoji + " ");
    remember(s.emoji);
    setSugIdx(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setSugIdx(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugs.length > 0 && sugIdx >= 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugIdx((i) => (i + 1) % sugs.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugIdx((i) => (i - 1 + sugs.length) % sugs.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); acceptSuggestion(sugs[activeSug]); return; }
      if (e.key === "Escape") { e.preventDefault(); setSugIdx(-1); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const submit = () => {
    if (!canSend || !currentUser) return;
    addComment(track.id, text);
    setText("");
    setPicker(false);
    setEmojiQuery("");
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.style.height = "auto"; el.focus(); }
    });
  };

  const activeSet = EMOJI_SETS.find((s) => s.id === emojiTab);
  const q = emojiQuery.trim().toLowerCase();
  const panelEmoji = q
    ? Object.entries(EMOJI_NAMES).filter(([, n]) => n.includes(q)).map(([e]) => e).slice(0, 64)
    : emojiTab === "recent"
      ? (recent.length ? recent : EMOJI_SETS[0].items)
      : (activeSet?.items ?? EMOJI_SETS[0].items);

  const startReport = (id: string, name: string) => {
    if (!currentUser) {
      toast.push({ kind: "info", msg: "Log in to report content.", action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    setReporting({ id, label: `Comment by ${name}` });
  };

  return (
    <div className="comments-panel">
      <div className="comments-list" ref={listRef}>
        {comments.length === 0 ? (
          <div className="comments-empty"><MessageCircle size={26} /><p>No comments yet. Say something kind — or something clever.</p></div>
        ) : comments.map((c) => {
          const u = userById(c.userId);
          if (!u) return null;
          const mine = currentUser?.id === c.userId;
          return (
            <div className="comment" key={c.id}>
              <Link href={`/profile/${u.handle}`}><Avatar user={u} size={32} /></Link>
              <div className="comment-body">
                <div className="comment-meta">
                  <Link href={`/profile/${u.handle}`} className="comment-name">{u.name}</Link>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                </div>
                <p className={isEmojiOnly(c.text) ? "comment-emoji-only" : "comment-text"}>{c.text}</p>
              </div>
              <div className="comment-tools">
                {!mine && (
                  <button className="icon-btn comment-report" aria-label={`Report comment by ${u.name}`} title="Report comment" onClick={() => startReport(c.id, u.name)}>
                    <Flag size={13} />
                  </button>
                )}
                {mine && (
                  <button className="icon-btn comment-del" aria-label="Delete comment" onClick={() => {
                    const undo = deleteComment(c.id);
                    toast.push({ kind: "info", msg: "Comment removed.", action: undo ? { label: "Undo", fn: undo } : undefined });
                  }}><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {currentUser ? (
        <div className="composer composer-fb">
          <Avatar user={currentUser} size={32} />
          <div className="composer-field" ref={pickerRef}>
            <div className={`fb-pill${focused ? " focused" : ""}`}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 140)}
                rows={1}
                placeholder="Write a comment…"
                aria-label="Add a comment"
              />
              <button
                type="button"
                className={`fb-icon${picker ? " on" : ""}`}
                onClick={() => { setPicker((v) => !v); setEmojiQuery(""); }}
                aria-label="Insert emoji" aria-expanded={picker}
              ><Smile size={18} /></button>
              {text.trim() && (
                <button
                  type="button"
                  className="fb-send"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label="Send comment"
                ><Send size={17} /></button>
              )}
            </div>

            {(focused || text) && (
              <div className="fb-hint">
                <span>Enter to send · Shift + Enter for a new line</span>
                {left <= 120 && <span className={`composer-count${left < 0 ? " over" : ""}`}>{left}</span>}
              </div>
            )}

            {sugs.length > 0 && sugIdx >= 0 && (
              <div className="sug-pop" role="listbox" aria-label="Emoji suggestions">
                {sugs.map((s, i) => (
                  <button
                    key={`${s.emoji}-${i}`}
                    type="button" role="option" aria-selected={i === activeSug}
                    className={`sug-row${i === activeSug ? " on" : ""}`}
                    onMouseEnter={() => setSugIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s); }}
                  >
                    <span className="sug-emoji">{s.emoji}</span>
                    <span className="sug-name">{s.label}</span>
                    {i === activeSug && <span className="sug-key">Tab</span>}
                  </button>
                ))}
              </div>
            )}

            {picker && (
              <div className="emoji-pop" role="dialog" aria-label="Emoji and expressions">
                <input
                  className="emoji-search"
                  value={emojiQuery}
                  onChange={(e) => setEmojiQuery(e.target.value)}
                  placeholder="Search emoji — try fire, heart, clap"
                  aria-label="Search emoji"
                />
                {!q && (
                  <div className="emoji-tabs">
                    <button type="button" className={`emoji-tab${emojiTab === "recent" ? " on" : ""}`} onClick={() => setEmojiTab("recent")}>🕘 Recent</button>
                    {EMOJI_SETS.map((s) => (
                      <button key={s.id} type="button" className={`emoji-tab${emojiTab === s.id ? " on" : ""}`} onClick={() => setEmojiTab(s.id)}>{s.label}</button>
                    ))}
                  </div>
                )}
                <div className="emoji-grid">
                  {panelEmoji.length === 0 ? (
                    <div className="emoji-none">No emoji matches “{emojiQuery}”.</div>
                  ) : panelEmoji.map((e, i) => (
                    <button
                      key={`${e}-${i}`} type="button" className="emoji-cell"
                      title={EMOJI_NAMES[e] ?? e}
                      onMouseDown={(ev) => { ev.preventDefault(); insert(e); }}
                      aria-label={`Insert ${EMOJI_NAMES[e] ?? e}`}
                    >{e}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="composer-gate">
          <p>Log in to join the conversation.</p>
          <button className="btn btn-brand btn-sm" onClick={() => router.push(`/login?next=${encodeURIComponent(pathname)}`)}>Log in</button>
        </div>
      )}
      <ReportDialog open={!!reporting} onClose={() => setReporting(null)} commentId={reporting?.id} targetLabel={reporting?.label ?? "Comment"} />
    </div>
  );
}

export function CommentsPanel(props: { track: Track; autoFocus?: boolean }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="comments-fallback" style={{ padding: "20px", textAlign: "center", color: "var(--muted)" }}>
          <p>Comments unavailable right now.</p>
        </div>
      }
    >
      <CommentsPanelInner {...props} />
    </ErrorBoundary>
  );
}

export function CommentsDrawer({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const player = usePlayer();
  const { userById } = useStore();
  const { src, fallback } = useTrackThumb(track ?? ({ coverSeed: "x", coverPalette: 0, source: "upload" } as Track));
  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [track, onClose]);
  if (!track) return null;
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Comments on ${track.title}`}>
        <div className="drawer-head">
          <h3>Comments</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close comments"><X size={19} /></button>
        </div>
        <div className="drawer-track">
          <SmartImg src={src} fallback={fallback} alt="" className="drawer-cover" />
          <div className="drawer-track-info">
            <Link href={`/track/${track.id}`} onClick={onClose}><strong>{track.title}</strong></Link>
            <span>{artist?.name} · {timeAgo(track.createdAt)}</span>
          </div>
          <button className="p-play sm" onClick={() => isThis ? player.toggle() : player.playTrack(track)} aria-label="Play">
            {isThis && player.buffering ? <Loader2 size={16} className="spin" /> : isThis && player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>
        <CommentsPanel track={track} autoFocus />
      </aside>
    </div>
  );
}

function TrackCardInner({ track, queue, index = 0, highlight = false }: { track: Track; queue: string[]; index?: number; highlight?: boolean }) {
  const store = useStore();
  const toast = useToast();
  const player = usePlayer();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, userById, likeCount, isLiked, isSaved, toggleLike, toggleSave, deleteTrack, commentsFor } = store;
  const artist = userById(track.userId);
  const { src, fallback } = useTrackThumb(track);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [reporting, setReporting] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liked = isLiked(track.id);
  const saved = isSaved(track.id);
  const isThis = player.track?.id === track.id;
  const isPlaying = isThis && player.playing;
  const comments = commentsFor(track.id);
  const owner = currentUser?.id === track.userId;

  const gate = (what: string): boolean => {
    if (currentUser) return true;
    toast.push({ kind: "info", msg: `Log in to ${what}.`, action: { label: "Log in", fn: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
    return false;
  };

  const onMediaClick = () => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      isThis ? player.toggle() : player.playTrack(track, queue);
    }, 230);
  };
  const onMediaDouble = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    doLike(true);
  };

  const share = async () => {
    const ok = await copyText(`${window.location.origin}/track/${track.id}`);
    toast.push({ kind: ok ? "ok" : "err", msg: ok ? "Link copied — spread the sound." : "Couldn't copy the link." });
  };

  const onDelete = () => {
    const undo = deleteTrack(track.id);
    toast.push({ kind: "info", msg: `“${track.title}” deleted.`, action: undo ? { label: "Undo", fn: undo } : undefined });
  };

  if (!artist) return null;
  const bgLong = track.background.length > 150;

  return (
    <>
      <article className={`tcard fade-up${highlight ? " glow-new" : ""}${isPlaying ? " is-playing" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
        <div className="tcard-head">
          <Link href={`/profile/${artist.handle}`} className="tcard-artist">
            <Avatar user={artist} size={38} ring />
            <span className="tcard-artist-info">
              <strong>{artist.name}</strong>
              <em>@{artist.handle} · {timeAgo(track.createdAt)}</em>
            </span>
          </Link>
          <div className="tcard-head-right">
            <SourceBadge t={track} />
            <Menu
              trigger={<MoreHorizontal size={19} />}
              items={owner ? [
                { label: "Edit track", icon: <Pencil size={15} />, onClick: () => router.push(`/create?edit=${track.id}`) },
                { label: "Copy link", icon: <Link2 size={15} />, onClick: share },
                { label: "Delete track", icon: <Trash2 size={15} />, danger: true, onClick: () => setConfirmDel(true) }
              ] : [
                { label: "Copy link", icon: <Link2 size={15} />, onClick: share },
                { label: saved ? "Remove from saved" : "Save track", icon: <Bookmark size={15} />, onClick: () => { if (gate("save music")) { toggleSave(track.id); toast.push({ kind: "ok", msg: saved ? "Removed from saved." : "Saved to your collection." }); } } },
                { label: "More from this artist", icon: <Headphones size={15} />, onClick: () => router.push(`/profile/${artist.handle}`) },
                { label: "Report track", icon: <Flag size={15} />, danger: true, onClick: () => { if (gate("report content")) setReporting(true); } }
              ]}
            />
          </div>
        </div>

        <div className="tcard-media" onClick={onMediaClick} onDoubleClick={onMediaDouble} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isThis ? player.toggle() : player.playTrack(track, queue); } }}
          aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}>
          <SmartImg src={src} fallback={fallback} alt={`Cover art for ${track.title}`} className="media-img" />
          <div className="media-shade" />
          <span className={`play-overlay${isPlaying ? " playing" : ""}`}>
            {isThis && player.buffering ? <Loader2 size={26} className="spin" /> : isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="nudge" />}
          </span>
          {isPlaying && <span className="media-eq"><Eq playing /></span>}
          {track.live && <span className="live-badge corner"><i />LIVE</span>}
          {track.duration && !track.live && <span className="dur-badge">{formatDuration(track.duration)}</span>}
          <Link href={`/track/${track.id}`} className="open-link" onClick={(e) => e.stopPropagation()} aria-label="Open track page"><ArrowIcon /></Link>
          {burst && <span className="burst"><Heart size={84} fill="currentColor" /></span>}
        </div>

        <div className="tcard-actions">
          <button className={`act${liked ? " liked" : ""}`} onClick={() => doLike(false)} aria-label={liked ? "Unlike" : "Like"}>
            <Heart size={23} fill={liked ? "currentColor" : "none"} /><span className="act-count">{formatCount(likeCount(track))}</span>
          </button>
          <button className="act" onClick={() => setDrawer(true)} aria-label="Comments">
            <MessageCircle size={23} /><span className="act-count">{formatCount(comments.length)}</span>
          </button>
          <button className="act" onClick={share} aria-label="Share"><Share2 size={22} /></button>
          <span className="act-plays"><Play size={13} fill="currentColor" />{formatCount(track.plays)}</span>
          <button className={`act save${saved ? " saved" : ""}`} onClick={() => { if (gate("save music")) { toggleSave(track.id); toast.push({ kind: "ok", msg: saved ? "Removed from saved." : "Saved to your collection." }); } }} aria-label={saved ? "Unsave" : "Save"}>
            <Bookmark size={22} fill={saved ? "currentColor" : "none"} />
          </button>
          <AddToPlaylistButton trackId={track.id} title={track.title} />
        </div>

        <div className="tcard-body">
          <Link href={`/track/${track.id}`} className="tcard-title" prefetch={true}>{track.title}</Link>
          {track.background && (
            <p className={`tcard-bg${expanded ? "" : " clamp"}`}>
              {track.background}
              {bgLong && !expanded && <button className="more-btn" onClick={() => setExpanded(true)}>more</button>}
            </p>
          )}
          <PromptChip prompt={track.stylePrompt} />
          <div className="tcard-links">
            {!track.instrumental && track.lyrics.trim() && <Link href={`/track/${track.id}#lyrics`} className="lyrics-link"><Music2 size={13} />View lyrics</Link>}
            {comments.length > 0 && <button className="comments-peek" onClick={() => setDrawer(true)}>View all {comments.length} comment{comments.length === 1 ? "" : "s"}</button>}
          </div>
        </div>
      </article>

      {drawer && <CommentsDrawer track={track} onClose={() => setDrawer(false)} />}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} trackId={track.id} targetLabel={track.title} />
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={onDelete}
        title="Delete this track?"
        body={<p>“<strong>{track.title}</strong>” will be removed from the feed along with its comments and likes. You can undo for a few seconds.</p>} />
    </>
  );
}

export function TrackCard(props: { track: Track; queue: string[]; index?: number; highlight?: boolean }) {
  return (
    <ErrorBoundary fallback={<div className="tcard skel-card" aria-hidden><div className="skel-row"><span className="skel skel-avatar" /><span className="skel skel-line w40" /></div><div className="skel skel-media" /><div className="skel-row"><span className="skel skel-line w60" /></div><div className="skel-row"><span className="skel skel-line w80" /></div></div>}>
      <TrackCardInner {...props} />
    </ErrorBoundary>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function CompactCard({ track, queue }: { track: Track; queue: string[] }) {
  const player = usePlayer();
  const { likeCount, userById } = useStore();
  const { src, fallback } = useTrackThumb(track);
  const artist = userById(track.userId);
  const isThis = player.track?.id === track.id;
  return (
    <div className={`gcard${isThis && player.playing ? " is-playing" : ""}`}>
      <Link href={`/track/${track.id}`} className="tcard-link" aria-label={track.title} prefetch={true}>
        <SmartImg src={src} fallback={fallback} alt="" className="gcard-img" />
        <span className="gcard-badge"><SourceBadge t={track} compact /></span>
      </Link>
      <div className="gcard-overlay">
        <button className="p-play sm" onClick={() => isThis ? player.toggle() : player.playTrack(track, queue)} aria-label={`Play ${track.title}`}>
          {isThis && player.buffering ? <Loader2 size={16} className="spin" /> : isThis && player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <span className="gcard-stats"><Heart size={13} fill="currentColor" />{formatCount(likeCount(track))}<Play size={12} fill="currentColor" />{formatCount(track.plays)}</span>
      </div>
      <div className="gcard-meta">
        <Link href={`/track/${track.id}`} className="gcard-title">{track.title}</Link>
        {artist && <Link href={`/profile/${artist.handle}`} className="gcard-artist">{artist.name}</Link>}
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="tcard skel-card" aria-hidden>
      <div className="skel-row"><span className="skel skel-avatar" /><span className="skel skel-line w40" /></div>
      <div className="skel skel-media" />
      <div className="skel-row"><span className="skel skel-line w60" /></div>
      <div className="skel-row"><span className="skel skel-line w80" /></div>
    </div>
  );
}

export { EmptyState };