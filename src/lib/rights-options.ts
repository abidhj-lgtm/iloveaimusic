export const LICENSES = [
  { id: "all_rights_reserved", label: "All rights reserved", note: "Nobody may reuse this recording without your permission." },
  { id: "cc_by", label: "CC BY 4.0", note: "Reuse allowed with credit to you." },
  { id: "cc_by_sa", label: "CC BY-SA 4.0", note: "Reuse with credit, share alike." },
  { id: "cc_by_nc", label: "CC BY-NC 4.0", note: "Reuse with credit, non-commercial only." },
  { id: "cc0", label: "CC0 / Public domain", note: "Anyone may use it for anything." },
  { id: "commercial_ok", label: "Commercial use allowed", note: "You grant broad commercial reuse." }
] as const;

export const AI_TOOLS = [
  { id: "unspecified", label: "Not specified" },
  { id: "suno", label: "Suno" },
  { id: "udio", label: "Udio" },
  { id: "stable_audio", label: "Stable Audio" },
  { id: "musicgen", label: "MusicGen / AudioCraft" },
  { id: "riffusion", label: "Riffusion" },
  { id: "aiva", label: "AIVA" },
  { id: "custom", label: "Custom model / own pipeline" },
  { id: "browser_synth", label: "Browser synthesizer (this site)" },
  { id: "none", label: "No AI — fully human-made" }
] as const;

export type LicenseId = (typeof LICENSES)[number]["id"];
export type AiToolId = (typeof AI_TOOLS)[number]["id"];

export const licenseLabel = (id: string) => LICENSES.find((l) => l.id === id)?.label ?? id;
export const aiToolLabel = (id: string) => AI_TOOLS.find((t) => t.id === id)?.label ?? id;