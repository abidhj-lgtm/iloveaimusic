import type { PresetName } from "./types";
import { mulberry32, hashString } from "./utils";
import { getMedia, putMedia } from "./idb";

export const PRESET_META: Record<PresetName, { label: string; duration: number; hint: string }> = {
  synthwave: { label: "Synthwave", duration: 38.4, hint: "100 BPM · A minor · neon arps" },
  lofi:      { label: "Lo-fi",     duration: 38.9, hint: "74 BPM · dusty keys · vinyl rain" },
  ambient:   { label: "Ambient",   duration: 48,   hint: "free time · slow pads · shimmer" }
};

const SR = 44100;
const m2f = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx: OfflineAudioContext, rng: () => number, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(SR * seconds), SR);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rng() * 2 - 1;
  return b;
}

function makeIR(ctx: OfflineAudioContext, rng: () => number, seconds: number): AudioBuffer {
  const len = Math.floor(SR * seconds);
  const b = ctx.createBuffer(2, len, SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return b;
}

function encodeWav(buf: AudioBuffer): Blob {
  const nCh = buf.numberOfChannels, n = buf.length;
  const bytes = 44 + n * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const dv = new DataView(ab);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, bytes - 8, true); ws(8, "WAVE"); ws(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * nCh * 2, true);
  dv.setUint16(32, nCh * 2, true); dv.setUint16(34, 16, true);
  ws(36, "data"); dv.setUint32(40, n * nCh * 2, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) chans.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

export async function renderPreset(name: PresetName, seed = name): Promise<Blob> {
  const rng = mulberry32(hashString(seed));
  const meta = PRESET_META[name];
  const dur = meta.duration;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);

  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14; master.ratio.value = 4;
  const out = ctx.createGain(); out.gain.value = 0.9;
  master.connect(out); out.connect(ctx.destination);

  const conv = ctx.createConvolver(); conv.buffer = makeIR(ctx, rng, 2.8);
  const revGain = ctx.createGain(); revGain.gain.value = 0.5;
  conv.connect(revGain); revGain.connect(master);

  const noise = makeNoise(ctx, rng, 2);

  const voice = (t: number, len: number, build: (g: GainNode) => void, level: number, send: number, attack = 0.02, release = 0.2) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, Math.max(t + attack, t + len - release));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    build(g);
    g.connect(master);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(conv); }
  };

  const padNote = (m: number, t: number, len: number, type: OscillatorType, cutoff: number, level: number, send: number, attack: number, release: number) => {
    voice(t, len, (g) => {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; f.Q.value = 0.6;
      f.connect(g);
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = m2f(m); o.detune.value = det + (rng() * 4 - 2);
        o.connect(f); o.start(t); o.stop(t + len + 0.05);
      }
    }, level, send, attack, release);
  };

  const pluck = (m: number, t: number, len: number, type: OscillatorType, cutoff: number, level: number, send: number) => {
    voice(t, len, (g) => {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; f.connect(g);
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = m2f(m);
      o.connect(f); o.start(t); o.stop(t + len + 0.05);
    }, level, send, 0.008, Math.min(0.3, len * 0.8));
  };

  const bass = (m: number, t: number, len: number, type: OscillatorType, level: number) => {
    voice(t, len, (g) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = m2f(m);
      o.connect(g); o.start(t); o.stop(t + len + 0.05);
    }, level, 0.05, 0.01, 0.12);
  };

  const kick = (t: number, level = 0.5) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
  };

  const noiseHit = (t: number, len: number, filterType: BiquadFilterType, freq: number, level: number, send = 0.1) => {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f); f.connect(g); g.connect(master);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(conv); }
    src.start(t, rng() * 1.2); src.stop(t + len + 0.05);
  };
  const snare = (t: number, level = 0.22) => { noiseHit(t, 0.16, "bandpass", 1900, level, 0.25); noiseHit(t, 0.09, "highpass", 5000, level * 0.5); };
  const hat = (t: number, open = false, level = 0.09) => noiseHit(t, open ? 0.22 : 0.045, "highpass", 8000, level);

  if (name === "synthwave") {
    const beat = 0.6, bar = beat * 4, bars = 16;
    const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    for (let b = 0; b < bars; b++) {
      const t0 = b * bar, ch = chords[b % 4];
      ch.forEach((m) => padNote(m, t0, bar + 0.1, "sawtooth", 1200, 0.055, 0.35, 0.25, 0.5));
      for (let e = 0; e < 8; e++) if ([1, 0, 1, 1, 0, 1, 0, 1][e]) bass(ch[0] - 12, t0 + e * beat / 2, 0.26, "triangle", 0.22);
      for (let s = 0; s < 16; s++) pluck(ch[s % 3] + 12, t0 + s * beat / 4, 0.14, "square", 2400, 0.05, 0.5);
      for (let q = 0; q < 4; q++) { kick(t0 + q * beat, 0.42); hat(t0 + q * beat + beat / 2, q === 3, 0.07); }
      snare(t0 + beat, 0.18); snare(t0 + 3 * beat, 0.18);
    }
  } else if (name === "lofi") {
    const beat = 60 / 74, bar = beat * 4, bars = 12, swing = beat * 0.09;
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    const bed = ctx.createBufferSource(); bed.buffer = noise; bed.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = 3800;
    const bg = ctx.createGain(); bg.gain.value = 0.008;
    bed.connect(bf); bf.connect(bg); bg.connect(master); bed.start(0); bed.stop(dur);
    for (let i = 0; i < 90; i++) noiseHit(rng() * dur, 0.012, "highpass", 3000, 0.03 + rng() * 0.02, 0);
    for (let b = 0; b < bars; b++) {
      const t0 = b * bar, ch = chords[b % 4];
      ch.forEach((m) => padNote(m, t0, bar + 0.2, "triangle", 950, 0.075, 0.45, 0.06, 0.7));
      bass(ch[0] - 12, t0, 0.5, "sine", 0.24); bass(ch[0] - 12, t0 + 2.5 * beat, 0.4, "sine", 0.18);
      for (let n = 0; n < 4; n++) if (rng() > 0.3) pluck(ch[Math.floor(rng() * 4)] + 12, t0 + n * beat + (n % 2 ? swing : 0), 0.4, "triangle", 1700, 0.09, 0.6);
      kick(t0, 0.4); kick(t0 + 2.5 * beat, 0.3);
      snare(t0 + beat, 0.16); snare(t0 + 3 * beat, 0.16);
      for (let e = 0; e < 8; e++) hat(t0 + e * beat / 2 + (e % 2 ? swing : 0), false, 0.05);
    }
  } else {
    const chords = [[48, 55, 64, 71], [45, 52, 64, 69], [41, 48, 57, 64], [43, 50, 59, 66], [48, 55, 64, 71], [45, 52, 64, 69]];
    const seg = 8;
    chords.forEach((ch, i) => {
      const t0 = i * seg;
      ch.forEach((m) => padNote(m, t0, seg + 2.5, "sawtooth", 720, 0.05, 0.85, 3.2, 4.2));
      bass(ch[0] - 12, t0, seg + 1, "sine", 0.13);
    });
    for (let t = 1.5; t < dur - 3; t += 1.8 + rng() * 1.4) {
      const ch = chords[Math.min(chords.length - 1, Math.floor(t / seg))];
      pluck(ch[Math.floor(rng() * ch.length)] + 24, t, 3.2, "sine", 6000, 0.045, 0.95);
    }
  }

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

const rendering = new Map<string, Promise<string>>();

export function ensureTrackAudio(trackId: string, preset: PresetName): Promise<string> {
  const key = `audio:${trackId}`;
  if (rendering.has(key)) return rendering.get(key)!;
  const p = (async () => {
    const existing = await getMedia(key);
    if (!existing) {
      const blob = await renderPreset(preset, trackId);
      await putMedia(key, blob);
    }
    return key;
  })();
  rendering.set(key, p);
  p.catch(() => rendering.delete(key));
  return p;
}