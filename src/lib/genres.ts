/**
 * Seed genres and moods for the catalog filter system.
 *
 * This is the single source of truth used by:
 *   - The frontend filter UI (to render chips)
 *   - The auto-tagger (to match keywords in prompts)
 *   - The /api/tags endpoint (to return graduated tags)
 *
 * Each entry has:
 *   - id: stable identifier (lowercase, no spaces)
 *   - label: display name for the UI
 *   - keywords: phrases the auto-tagger matches against in prompts/backgrounds
 *
 * Keywords should include:
 *   - The genre/mood name itself (various spellings)
 *   - Common synonyms and related terms
 *   - Artist references that strongly imply the style
 *   - Common misspellings and abbreviations
 */

export interface SeedEntry {
  id: string;
  label: string;
  keywords: string[];
}

/* ══════════════════════════════════════════════════════════════
   GENRES
   ══════════════════════════════════════════════════════════════ */

export const SEED_GENRES: SeedEntry[] = [
  {
    id: "synthwave",
    label: "Synthwave",
    keywords: [
      "synthwave", "synth wave", "retro 80s", "80s synth", "outrun",
      "neon", "blade runner", "vangelis", "kavinsky", "miami vice",
      "retrowave", "futuresynth", "cyberpunk"
    ]
  },
  {
    id: "lofi",
    label: "Lo-fi",
    keywords: [
      "lo-fi", "lofi", "lo fi", "low fidelity", "vinyl crackle",
      "tape hiss", "cassette", "analog warmth", "dusty beats",
      "study beats", "homework beats"
    ]
  },
  {
    id: "ambient",
    label: "Ambient",
    keywords: [
      "ambient", "atmospheric", "drone", "soundscape", "ethereal",
      "space music", "brian eno", "new age", "meditation",
      "background music", "textural", "immersive"
    ]
  },
  {
    id: "techno",
    label: "Techno",
    keywords: [
      "techno", "berlin techno", "detroit techno", "acid techno",
      "warehouse", "industrial techno", "minimal techno", "hard techno",
      "140 bpm", "150 bpm", "four on the floor"
    ]
  },
  {
    id: "house",
    label: "House",
    keywords: [
      "house", "deep house", "tech house", "chicago house", "garage",
      "uk garage", "future house", "tropical house", "progressive house",
      "disco house", "soulful house"
    ]
  },
  {
    id: "chillhop",
    label: "Chillhop",
    keywords: [
      "chillhop", "jazzy hip hop", "jazzy hiphop", "lo-fi hip hop",
      "boom bap", "mellow beats", "j dilla", "nujabes", "head nod",
      "coffee shop", "study music"
    ]
  },
  {
    id: "downtempo",
    label: "Downtempo",
    keywords: [
      "downtempo", "trip hop", "portishead", "massive attack",
      "tricky", "slow tempo", "laid back beats", "moody beats",
      "dub", "chillout"
    ]
  },
  {
    id: "cinematic",
    label: "Cinematic",
    keywords: [
      "cinematic", "film score", "film music", "orchestral", "epic",
      "trailer music", "hans zimmer", "soundtrack", "movie score",
      "dramatic", "sweeping", "holywood"
    ]
  },
  {
    id: "experimental",
    label: "Experimental",
    keywords: [
      "experimental", "avant-garde", "avant garde", "noise", "glitch",
      "idm", "aphex twin", "autechre", "intelligent dance music",
      "abstract", "unconventional", "boundary pushing"
    ]
  },
  {
    id: "pop",
    label: "Pop",
    keywords: [
      "pop", "pop music", "catchy", "radio friendly", "mainstream",
      "upbeat pop", "synth pop", "indie pop", "bedroom pop",
      "chart topper", "hook driven"
    ]
  },
  {
    id: "rock",
    label: "Rock",
    keywords: [
      "rock", "indie rock", "alternative", "alternative rock",
      "guitar driven", "post-rock", "garage rock", "punk",
      "grunge", "shoegaze"
    ]
  },
  {
    id: "jazz",
    label: "Jazz",
    keywords: [
      "jazz", "smooth jazz", "bebop", "fusion", "jazz fusion",
      "saxophone", "piano trio", "jazz quartet", "cool jazz",
      "hard bop", "modal jazz", "miles davis", "coltrane"
    ]
  }
];

/* ══════════════════════════════════════════════════════════════
   MOODS
   ══════════════════════════════════════════════════════════════ */

export const SEED_MOODS: SeedEntry[] = [
  {
    id: "chill",
    label: "Chill",
    keywords: [
      "chill", "chilled", "relaxed", "calm", "mellow", "laid back",
      "laid-back", "easygoing", "easy going", "peaceful", "serene",
      "tranquil", "soothing"
    ]
  },
  {
    id: "energetic",
    label: "Energetic",
    keywords: [
      "energetic", "energy", "high energy", "pumping", "intense",
      "powerful", "adrenaline", "hype", "aggressive", "driving",
      "punchy", "up-tempo"
    ]
  },
  {
    id: "melancholic",
    label: "Melancholic",
    keywords: [
      "melancholic", "melancholy", "sad", "somber", "wistful",
      "bittersweet", "longing", "yearning", "nostalgic sadness",
      "heartbroken", "forlorn", "poignant"
    ]
  },
  {
    id: "upbeat",
    label: "Upbeat",
    keywords: [
      "upbeat", "happy", "cheerful", "joyful", "positive",
      "feel good", "feel-good", "sunny", "optimistic", "bright",
      "bouncy", "fun"
    ]
  },
  {
    id: "dreamy",
    label: "Dreamy",
    keywords: [
      "dreamy", "dreamy", "hazy", "floating", "ethereal",
      "surreal", "reverie", "otherworldly", "celestial",
      "hypnotic", "trance-like", "trancelike"
    ]
  },
  {
    id: "dark",
    label: "Dark",
    keywords: [
      "dark", "moody", "brooding", "ominous", "sinister",
      "haunting", "eerie", "menacing", "foreboding", "gothic",
      "shadowy", "black"
    ]
  },
  {
    id: "warm",
    label: "Warm",
    keywords: [
      "warm", "warmth", "cozy", "intimate", "nostalgic",
      "comforting", "analog", "tender", "gentle", "soft",
      "inviting", "homey"
    ]
  },
  {
    id: "nocturnal",
    label: "Nocturnal",
    keywords: [
      "nocturnal", "night", "nighttime", "midnight", "late night",
      "late-night", "3am", "3 am", "after hours", "after-hours",
      "insomnia", "moonlit"
    ]
  }
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

/** All seed entries combined (useful for iteration). */
export const ALL_SEEDS: SeedEntry[] = [...SEED_GENRES, ...SEED_MOODS];

/** Look up a seed by id. Returns undefined if not found. */
export function getSeedById(id: string): SeedEntry | undefined {
  return ALL_SEEDS.find((s) => s.id === id);
}

/** Check if an id is a seed genre. */
export function isSeedGenre(id: string): boolean {
  return SEED_GENRES.some((s) => s.id === id);
}

/** Check if an id is a seed mood. */
export function isSeedMood(id: string): boolean {
  return SEED_MOODS.some((s) => s.id === id);
}