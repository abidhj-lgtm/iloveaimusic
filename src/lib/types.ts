export type Source = "upload" | "youtube";
export type PresetName = "synthwave" | "lofi" | "ambient";

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  passHash?: string;
  verified: boolean;
  provider: "email" | "google" | "demo";
  bio: string;
  avatarPalette: number;
  createdAt: number;
}

export interface Track {
  id: string;
  userId: string;
  title: string;
  source: Source;
  youtubeId?: string;
  live?: boolean;
  audioKey?: string;
  preset?: PresetName;
  thumbKey?: string;
  coverSeed: string;
  coverPalette: number;
  background: string;
  stylePrompt: string;
  lyrics: string;
  instrumental: boolean;
  duration?: number;
  plays: number;
  baseLikes: number;
  createdAt: number;
  updatedAt?: number;
}

export interface Comment {
  id: string;
  trackId: string;
  userId: string;
  text: string;
  createdAt: number;
}

export interface Like { userId: string; trackId: string; createdAt: number }
export interface Save { userId: string; trackId: string; createdAt: number }
export interface Follow { followerId: string; targetId: string }

export interface Mail {
  id: string;
  to: string;
  token: string;
  sentAt: number;
  expiresAt: number;
  used: boolean;
}

export interface Prefs {
  muted: boolean;
  volume: number;
  repeatOne: boolean;
}

export interface State {
  version: number;
  users: User[];
  tracks: Track[];
  comments: Comment[];
  likes: Like[];
  saves: Save[];
  follows: Follow[];
  mail: Mail[];
  sessionUserId: string | null;
  prefs: Prefs;
}

export interface TrackInput {
  title: string;
  source: Source;
  youtubeId?: string;
  audioKey?: string;
  preset?: PresetName;
  thumbKey?: string;
  coverSeed: string;
  coverPalette: number;
  background: string;
  stylePrompt: string;
  lyrics: string;
  instrumental: boolean;
  duration?: number;
}