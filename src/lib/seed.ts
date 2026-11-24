import type { State } from "./types";
import { sha256 } from "./utils";
import {
  CATALOG_ARTISTS,
  CATALOG_TRACKS,
  CATALOG_COMMENTS,
  CATALOG_LIKES,
  CATALOG_FOLLOWS
} from "./catalog";

export async function buildSeed(): Promise<State> {
  const pass = await sha256("demo1234");

  return {
    version: 1,
    users: CATALOG_ARTISTS.map((u) => ({ ...u, passHash: pass })),
    tracks: CATALOG_TRACKS.map((t) => ({ ...t })),
    comments: CATALOG_COMMENTS.map((c) => ({ ...c })),
    likes: CATALOG_LIKES.map((l) => ({ ...l })),
    saves: [],
    follows: CATALOG_FOLLOWS.map((f) => ({ ...f })),
    mail: [],
    sessionUserId: null,
    prefs: { muted: false, volume: 0.85, repeatOne: false }
  };
}