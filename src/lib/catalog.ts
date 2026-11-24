import type { Track, User, Comment, Like, Follow } from "./types";

const T = (iso: string) => Date.parse(iso);

export const CATALOG_ARTISTS: User[] = [
  { id: "u-aria", name: "Aria Vale", handle: "ariavale", email: "aria@gmail.com", verified: true, provider: "demo", bio: "Painting with prompts. Synthwave & dream-pop from a bedroom studio in Lisbon. Every track here was co-written with an AI.", avatarPalette: 0, createdAt: T("2026-08-24T10:00:00Z") },
  { id: "u-kaito", name: "Kaito Mori", handle: "kaitomori", email: "kaito@gmail.com", verified: true, provider: "email", bio: "Osaka → the grid. I run 24/7 generative synthwave broadcasts and post the best renders here.", avatarPalette: 5, createdAt: T("2026-07-25T10:00:00Z") },
  { id: "u-nova", name: "Nova Reyes", handle: "novareyes", email: "nova@gmail.com", verified: true, provider: "email", bio: "Ambient cartographer. Long pads, longer walks. Music for watching rain think.", avatarPalette: 2, createdAt: T("2026-09-23T10:00:00Z") },
  { id: "u-jun", name: "Jun Park", handle: "junpark", email: "jun@gmail.com", verified: true, provider: "email", bio: "Lo-fi mechanic. I fix broken drum loops until they swing. Seoul, mostly at 2am.", avatarPalette: 3, createdAt: T("2026-05-06T10:00:00Z") },
  { id: "u-mara", name: "Mara Lind", handle: "maralind", email: "mara@gmail.com", verified: true, provider: "email", bio: "Vocalist who duets with machines. Writing toplines over AI instrumentals since 2023.", avatarPalette: 4, createdAt: T("2026-10-08T10:00:00Z") }
];

export const CATALOG_TRACKS: Track[] = [
  {
    id: "t-neon", userId: "u-aria", title: "Neon Reverie", source: "upload", preset: "synthwave",
    audioKey: "audio:t-neon", coverSeed: "neon-reverie", coverPalette: 0,
    background: "I wanted the sound of driving home at 1am when the city is finally quiet and every traffic light is green. The first four renders were too bright — I darkened the prompt, dropped the key to A minor, and render #7 had this exact melancholy. The arp pattern stayed untouched from the very first take.",
    stylePrompt: "synthwave, 100 BPM, A minor, analog saw pads, gated arpeggio, four-on-the-floor, melancholic but hopeful, night drive, no vocals",
    lyrics: "", instrumental: true, duration: 38.4, plays: 1284, baseLikes: 214, createdAt: T("2026-11-22T08:25:00Z")
  },
  {
    id: "t-highway", userId: "u-kaito", title: "Chromatic Highway — 24/7 Synthwave Broadcast", source: "youtube",
    youtubeId: "4xDzrJKXOOY", live: true, coverSeed: "chromatic-highway", coverPalette: 5,
    background: "My generative synthwave station, running around the clock. The chain picks a key, builds a progression, and renders a new segment every few minutes — nobody, including me, has heard most of it. Park it on a second monitor and let the highway run.",
    stylePrompt: "endless synthwave radio, retro-futurist, 90–110 BPM, chrome and magenta, driving basslines, generative segments, instrumental",
    lyrics: "", instrumental: true, plays: 9421, baseLikes: 1204, createdAt: T("2026-11-22T07:00:00Z")
  },
  {
    id: "t-rain", userId: "u-jun", title: "Rainy Window", source: "upload", preset: "lofi",
    audioKey: "audio:t-rain", coverSeed: "rainy-window", coverPalette: 2,
    background: "Recorded the rain from my actual window, then asked the model for keys that sound like they're apologizing for something. It gave me these four chords on the second try. The vinyl crackle is synthetic; the feeling isn't.",
    stylePrompt: "lo-fi hip hop, 74 BPM, Fmaj7 Em7 Dm7 Cmaj7, dusty Rhodes, swung hats, vinyl crackle, rain ambience, study beats, instrumental",
    lyrics: "", instrumental: true, duration: 38.9, plays: 3102, baseLikes: 486, createdAt: T("2026-11-22T03:00:00Z")
  },
  {
    id: "t-faded", userId: "u-mara", title: "Faded — AI Rework Session", source: "youtube",
    youtubeId: "60ItHLz5WEA", coverSeed: "faded-rework", coverPalette: 4,
    background: "Reference study: I fed the model descriptions of this arrangement — the plucked intro, the huge sidechained drop — and compared its attempts against the original. Posting the reference so you can hear the target. My rework drops next week; the gap is smaller than you'd think.",
    stylePrompt: "vocal EDM, 90 BPM, E minor, plucked intro, airy female topline, sidechain pads, festival drop, bittersweet, cinematic outro",
    lyrics: "[Verse]\nYou were the shadow to my light\nDid you feel us? Another start, you fade away\nAfraid our aim is out of sight\nWanna see us alight\n\n[Chorus]\nWhere are you now? Where are you now?\nWas it all in my fantasy?\nWhere are you now?\nWere you only imaginary?",
    instrumental: false, plays: 5210, baseLikes: 733, createdAt: T("2026-11-21T22:00:00Z")
  },
  {
    id: "t-drift", userId: "u-nova", title: "Solar Drift", source: "upload", preset: "ambient",
    audioKey: "audio:t-drift", coverSeed: "solar-drift", coverPalette: 1,
    background: "Forty-eight seconds of the sun moving across my kitchen floor, stretched into sound. No drums, no grid — I asked for pads that breathe on their own and a shimmer that arrives like dust in a sunbeam. Best played quietly, with the window open.",
    stylePrompt: "ambient, free time, Cmaj9 drift, slow-attack saw pads, tape shimmer, deep sub, no percussion, warm, weightless, meditative",
    lyrics: "", instrumental: true, duration: 48, plays: 876, baseLikes: 167, createdAt: T("2026-11-21T09:00:00Z")
  },
  {
    id: "t-study", userId: "u-jun", title: "Study Loop ∞ — Endless Lo-fi Broadcast", source: "youtube",
    youtubeId: "jfKfPfyJRdk", live: true, coverSeed: "study-loop", coverPalette: 3,
    background: "The station I leave on while I tune my own renders. Posting it as a palate cleanser: when your prompt outputs start sounding the same, sit inside someone else's loop for an hour and come back with new ears.",
    stylePrompt: "lo-fi radio, 70–80 BPM, mellow keys, tape hiss, soft boom-bap, endless mix, focus music, instrumental",
    lyrics: "", instrumental: true, plays: 12760, baseLikes: 2043, createdAt: T("2026-11-20T09:00:00Z")
  },
  {
    id: "t-bloom", userId: "u-aria", title: "Midnight Bloom (Voice Memo v3)", source: "upload", preset: "ambient",
    audioKey: "audio:t-bloom", coverSeed: "midnight-bloom", coverPalette: 4,
    background: "Sketch for a vocal track: I hummed a topline into my phone, described it to the model, and kept only the pad it returned. The words came later, on the night bus. This is the moment before the song knew what it was about.",
    stylePrompt: "ambient dream-pop sketch, 80 BPM feel, D minor, breathy pads, distant shimmer, intimate, pre-vocal demo, no drums",
    lyrics: "[Verse]\nI planted all my questions in the dark\nWatered them with static from the car radio\n\n[Chorus]\nAnd they bloomed at midnight, neon and slow\nEvery petal a prompt I let go\nThey bloomed at midnight, and I finally know\nSome songs grow where the streetlights don't go",
    instrumental: false, duration: 48, plays: 654, baseLikes: 121, createdAt: T("2026-11-19T09:00:00Z")
  }
];

export const CATALOG_COMMENTS: Comment[] = [
  { id: "c1", trackId: "t-neon", userId: "u-kaito", text: "That arp at 0:12 is pure chrome. What was the exact prompt wording for the gate?", createdAt: T("2026-11-22T08:38:00Z") },
  { id: "c2", trackId: "t-neon", userId: "u-nova", text: "Render #7 supremacy. The darkening worked — this feels like the city exhaling.", createdAt: T("2026-11-22T08:45:00Z") },
  { id: "c3", trackId: "t-neon", userId: "u-jun", text: "Saving this for the 2am shift. Instant loop material.", createdAt: T("2026-11-22T08:52:00Z") },
  { id: "c4", trackId: "t-rain", userId: "u-aria", text: "\"Keys that sound like they're apologizing\" is the best prompt engineering I've ever read.", createdAt: T("2026-11-22T04:00:00Z") },
  { id: "c5", trackId: "t-rain", userId: "u-mara", text: "The swing on those hats… human hands could never. Mine certainly can't.", createdAt: T("2026-11-22T05:00:00Z") },
  { id: "c6", trackId: "t-highway", userId: "u-aria", text: "Left this running all afternoon. Somewhere around 3pm it played something that made me stop typing.", createdAt: T("2026-11-22T07:30:00Z") },
  { id: "c7", trackId: "t-drift", userId: "u-jun", text: "No drums, no grid, no notes. Just sun.", createdAt: T("2026-11-21T13:00:00Z") },
  { id: "c8", trackId: "t-faded", userId: "u-kaito", text: "The sidechain comparison is going to be fascinating. Following for the rework.", createdAt: T("2026-11-22T00:00:00Z") },
  { id: "c9", trackId: "t-bloom", userId: "u-nova", text: "\"Some songs grow where the streetlights don't go\" — okay, poet. Can't wait for the full version.", createdAt: T("2026-11-20T09:00:00Z") },
  { id: "c10", trackId: "t-study", userId: "u-mara", text: "The palate cleanser advice is real. New ears, every time.", createdAt: T("2026-11-21T03:00:00Z") }
];

export const CATALOG_LIKES: Like[] = [
  { userId: "u-kaito", trackId: "t-neon", createdAt: T("2026-11-22T08:35:00Z") },
  { userId: "u-nova", trackId: "t-neon", createdAt: T("2026-11-22T08:44:00Z") },
  { userId: "u-jun", trackId: "t-neon", createdAt: T("2026-11-22T08:51:00Z") },
  { userId: "u-aria", trackId: "t-rain", createdAt: T("2026-11-22T04:00:00Z") },
  { userId: "u-mara", trackId: "t-rain", createdAt: T("2026-11-22T05:00:00Z") },
  { userId: "u-aria", trackId: "t-highway", createdAt: T("2026-11-22T07:25:00Z") },
  { userId: "u-nova", trackId: "t-drift", createdAt: T("2026-11-21T12:00:00Z") },
  { userId: "u-aria", trackId: "t-study", createdAt: T("2026-11-21T02:00:00Z") }
];

export const CATALOG_FOLLOWS: Follow[] = [
  { followerId: "u-aria", targetId: "u-kaito" },
  { followerId: "u-aria", targetId: "u-jun" },
  { followerId: "u-kaito", targetId: "u-aria" },
  { followerId: "u-nova", targetId: "u-aria" },
  { followerId: "u-jun", targetId: "u-aria" },
  { followerId: "u-mara", targetId: "u-kaito" }
];

export const getTrack = (id: string) => CATALOG_TRACKS.find((t) => t.id === id);
export const getArtist = (id: string) => CATALOG_ARTISTS.find((u) => u.id === id);
export const getArtistByHandle = (handle: string) => CATALOG_ARTISTS.find((u) => u.handle === handle);

export const tracksByArtist = (userId: string) =>
  CATALOG_TRACKS.filter((t) => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);

export const commentsForTrack = (trackId: string) =>
  CATALOG_COMMENTS.filter((c) => c.trackId === trackId).sort((a, b) => a.createdAt - b.createdAt);

export const likeTotal = (t: Track) =>
  t.baseLikes + CATALOG_LIKES.filter((l) => l.trackId === t.id).length;

export const sortedTracks = () =>
  [...CATALOG_TRACKS].sort((a, b) => b.createdAt - a.createdAt);

export function trackTags(t: Track): string[] {
  return t.stylePrompt
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s.length < 26);
}

export function allTags(): { tag: string; count: number }[] {
  const m = new Map<string, number>();
  CATALOG_TRACKS.forEach((t) =>
    trackTags(t).forEach((tag) => m.set(tag, (m.get(tag) ?? 0) + 1))
  );
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function isoDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
}

export function absoluteDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}