"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Upload, Youtube, Wand2, Music2, FileAudio, Image as ImageIcon, Sparkles, X, Check,
  RefreshCw, Link2, ArrowRight, Pencil, Disc3, ShieldCheck
} from "lucide-react";
import { useStore, useToast } from "@/lib/store";
import { putMedia, useMediaUrl } from "@/lib/idb";
import { renderPreset, PRESET_META } from "@/lib/audioGen";
import { parseYouTubeId, ytThumb, ytWatch, ytEmbed, fetchOEmbed } from "@/lib/youtube";
import { coverUrl, PALETTES } from "@/lib/covers";
import { uid, audioDuration, resizeImage, formatDuration } from "@/lib/utils";
import { Field, Spinner } from "@/components/ui";
import { SourceBadge, PromptChip, LyricsView } from "@/components/track-card";
import type { PresetName, Source, Track, TrackInput } from "@/lib/types";

const DRAFT_KEY = "ilistenai:draft";
const TAGS = ["lo-fi", "synthwave", "ambient", "dream pop", "female vocals", "male vocals", "92 BPM", "A minor", "orchestral", "8-bit", "dark", "hopeful", "tape saturation", "no drums"];

export default function CreatePage() {
  return <Suspense fallback={null}><CreateInner /></Suspense>;
}

interface FormState {
  title: string; source: Source; youtubeUrl: string; background: string;
  stylePrompt: string; lyrics: string; instrumental: boolean;
  coverPalette: number; coverSeed: string;
}

function CreateInner() {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const { currentUser, addTrack, updateTrack, state } = store;
  const editing: Track | undefined = editId ? state.tracks.find((t) => t.id === editId) : undefined;

  const [form, setForm] = useState<FormState>({ title: "", source: "upload", youtubeUrl: "", background: "", stylePrompt: "", lyrics: "", instrumental: false, coverPalette: 0, coverSeed: uid() });
  const [attested, setAttested] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDur, setAudioDur] = useState(0);
  const [samplePreset, setSamplePreset] = useState<PresetName>("synthwave");
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [keptAudio, setKeptAudio] = useState<{ key: string; duration?: number; preset?: PresetName } | null>(null);
  const [thumbFile, setThumbFile] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [keptThumb, setKeptThumb] = useState<string | null>(null);
  const [thumbMode, setThumbMode] = useState<"generate" | "upload">("generate");
  const [dragAudio, setDragAudio] = useState(false);
  const [dragThumb, setDragThumb] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [oembed, setOembed] = useState<{ title?: string; author?: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);

  const keptThumbUrl = useMediaUrl(keptThumb);
  const ytId = useMemo(() => parseYouTubeId(form.youtubeUrl), [form.youtubeUrl]);

  useEffect(() => {
    if (!currentUser) {
      toast.push({ kind: "info", msg: "Log in to post music." });
      router.replace(`/login?next=${encodeURIComponent(editId ? `/create?edit=${editId}` : "/create")}`);
    } else if (editId && (!editing || editing.userId !== currentUser.id)) {
      toast.push({ kind: "err", msg: "You can only edit your own tracks." });
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, editId, editing?.id]);

  useEffect(() => {
    if (!editing || restoredRef.current) return;
    restoredRef.current = true;
    setAttested(true);
    setForm({
      title: editing.title, source: editing.source,
      youtubeUrl: editing.youtubeId ? ytWatch(editing.youtubeId) : "",
      background: editing.background, stylePrompt: editing.stylePrompt,
      lyrics: editing.lyrics, instrumental: editing.instrumental,
      coverPalette: editing.coverPalette, coverSeed: editing.coverSeed
    });
    if (editing.audioKey) setKeptAudio({ key: editing.audioKey, duration: editing.duration, preset: editing.preset });
    if (editing.thumbKey) { setKeptThumb(editing.thumbKey); setThumbMode("upload"); }
  }, [editing]);

  useEffect(() => {
    if (editId || restoredRef.current) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && (d.title || d.background || d.stylePrompt || d.lyrics || d.youtubeUrl)) {
          restoredRef.current = true;
          setForm((f) => ({ ...f, ...d, coverSeed: d.coverSeed || f.coverSeed }));
          toast.push({ kind: "info", msg: "Draft restored from your last session.", action: { label: "Discard", fn: () => { localStorage.removeItem(DRAFT_KEY); setForm({ title: "", source: "upload", youtubeUrl: "", background: "", stylePrompt: "", lyrics: "", instrumental: false, coverPalette: 0, coverSeed: uid() }); } } });
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editId) return;
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* ignore */ } }, 600);
    return () => clearTimeout(t);
  }, [form, editId]);

  useEffect(() => {
    setOembed(null);
    if (!ytId) return;
    let alive = true;
    fetchOEmbed(ytWatch(ytId)).then((r) => { if (alive && r) setOembed(r); });
    return () => { alive = false; };
  }, [ytId]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const acceptAudio = async (file: File) => {
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name)) { setErrors((e) => ({ ...e, audio: "That's not an audio file. MP3, WAV, M4A or OGG please." })); return; }
    if (file.size > 100 * 1024 * 1024) { setErrors((e) => ({ ...e, audio: "Audio is over 100MB. Bounce a smaller mixdown." })); return; }
    setErrors((e) => ({ ...e, audio: "", thumb: "" }));
    setSampleBlob(null); setKeptAudio(null); setAudioFile(file);
    setAudioDur(await audioDuration(file));
  };

  const acceptThumb = async (file: File) => {
    if (!file.type.startsWith("image/")) { setErrors((e) => ({ ...e, thumb: "Thumbnails must be an image (JPG, PNG, WebP)." })); return; }
    if (file.size > 8 * 1024 * 1024) { setErrors((e) => ({ ...e, thumb: "Image is over 8MB." })); return; }
    try {
      const blob = await resizeImage(file, 900);
      setThumbFile(blob); setThumbPreview(URL.createObjectURL(blob));
      setThumbMode("upload"); setKeptThumb(null);
      setErrors((e) => ({ ...e, thumb: "" }));
    } catch { setErrors((e) => ({ ...e, thumb: "Couldn't read that image. Try another one." })); }
  };

  const synthesize = async () => {
    setSampleBusy(true); setErrors((e) => ({ ...e, audio: "" }));
    try {
      const blob = await renderPreset(samplePreset, uid());
      setSampleBlob(blob); setAudioFile(null); setKeptAudio(null);
      setAudioDur(PRESET_META[samplePreset].duration);
      toast.push({ kind: "ok", msg: `${PRESET_META[samplePreset].label} sample rendered in your browser.` });
    } catch { toast.push({ kind: "err", msg: "Your browser couldn't render audio here." }); }
    setSampleBusy(false);
  };

  const generatedCover = coverUrl(form.coverSeed, form.coverPalette);
  const effectiveThumb = form.source === "youtube" ? (ytId ? ytThumb(ytId) : generatedCover)
    : thumbMode === "upload" ? (thumbPreview ?? keptThumbUrl ?? generatedCover) : generatedCover;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Every track needs a name.";
    if (form.source === "youtube") {
      if (!ytId) e.youtube = "Paste a valid YouTube link (watch, youtu.be, shorts or live).";
    } else {
      if (!audioFile && !sampleBlob && !keptAudio) e.audio = "Add an audio file — or synthesize a sample below.";
      if (thumbMode === "upload" && !thumbFile && !keptThumb) e.thumb = "Uploaded music needs a thumbnail. Add an image or switch to generated art.";
    }
    if (!attested) e.rights = "You must confirm you have the rights to this music before publishing.";
    setErrors(e);
    if (Object.keys(e).length) {
      setTimeout(() => document.querySelector(".field-error")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
      return false;
    }
    return true;
  };

  const publish = async () => {
    if (!currentUser || !validate()) return;
    setBusy(true);
    try {
      const id = editId ?? uid();
      let audioKey: string | undefined; let preset: PresetName | undefined;
      let thumbKey: string | undefined; let duration: number | undefined = audioDur || undefined;

      if (form.source === "upload") {
        if (audioFile) { audioKey = `audio:${id}`; await putMedia(audioKey, audioFile); }
        else if (sampleBlob) { audioKey = `audio:${id}`; preset = samplePreset; await putMedia(audioKey, sampleBlob); }
        else if (keptAudio) { audioKey = keptAudio.key; preset = keptAudio.preset; duration = keptAudio.duration ?? duration; }
        if (thumbMode === "upload") {
          if (thumbFile) { thumbKey = `thumb:${id}`; await putMedia(thumbKey, thumbFile); }
          else if (keptThumb) thumbKey = keptThumb;
        }
      }

      const input: TrackInput = {
        title: form.title.trim(), source: form.source,
        youtubeId: form.source === "youtube" ? ytId! : undefined,
        audioKey: form.source === "upload" ? audioKey : undefined,
        preset: form.source === "upload" ? preset : undefined,
        thumbKey: form.source === "upload" ? thumbKey : undefined,
        coverSeed: form.coverSeed, coverPalette: form.coverPalette,
        background: form.background.trim(), stylePrompt: form.stylePrompt.trim(),
        lyrics: form.instrumental ? "" : form.lyrics.trim(),
        instrumental: form.instrumental,
        duration: form.source === "upload" ? duration : undefined
      };

      if (editId) {
        updateTrack(editId, input);
        toast.push({ kind: "ok", msg: "Track updated." });
        router.push(`/track/${editId}`);
      } else {
        const newId = addTrack(input);
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        toast.push({ kind: "ok", msg: "Publishing — now complete the provenance declaration on the track page.", action: { label: "Open", fn: () => router.push(`/track/${newId}#provenance`) } });
        router.push(`/?new=${newId}`);
      }
    } catch {
      toast.push({ kind: "err", msg: "Something went wrong while saving. Try again." });
      setBusy(false);
    }
  };

  if (!currentUser) return null;

  const previewTrack: Track = {
    id: "preview", userId: currentUser.id, title: form.title || "Untitled track",
    source: form.source, youtubeId: ytId ?? undefined, coverSeed: form.coverSeed, coverPalette: form.coverPalette,
    background: form.background, stylePrompt: form.stylePrompt,
    lyrics: form.instrumental ? "" : form.lyrics, instrumental: form.instrumental,
    plays: 0, baseLikes: 0, createdAt: Date.now(), duration: audioDur || undefined
  };

  return (
    <div className="create-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{editId ? "Edit track" : "Post music"}</h1>
          <p className="page-sub">{editId ? "Tune the details — the server updates instantly." : "The track, the story, the prompt, the words. Give your music a home."}</p>
        </div>
        <button className="btn btn-ghost btn-sm preview-toggle" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide preview" : "Preview"}</button>
      </div>

      <div className="create-grid">
        <div className="form-col">
          <section className={`form-card${errors.title ? " field-error" : ""}`}>
            <Field label="1 · Title" required counter={`${form.title.length}/120`} error={errors.title}>
              <input className="input title-input" value={form.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="Neon Reverie" />
            </Field>
          </section>

          <section className="form-card">
            <div className="field-top"><label className="label">2 · Music source <span className="req">*</span></label></div>
            <div className="seg" role="tablist">
              <span className="seg-thumb" style={{ transform: `translateX(${form.source === "upload" ? 0 : 100}%)` }} />
              <button role="tab" aria-selected={form.source === "upload"} className={form.source === "upload" ? "on" : ""} onClick={() => set({ source: "upload" })}><Upload size={15} />Upload audio</button>
              <button role="tab" aria-selected={form.source === "youtube"} className={form.source === "youtube" ? "on" : ""} onClick={() => set({ source: "youtube" })}><Youtube size={15} />YouTube embed</button>
            </div>

            {form.source === "upload" ? (
              <>
                <div className={`field${errors.audio ? " field-error" : ""}`}>
                  {audioFile || sampleBlob || keptAudio ? (
                    <div className="file-chip">
                      <FileAudio size={20} />
                      <span className="file-chip-info">
                        <strong>{audioFile ? audioFile.name : sampleBlob ? `${PRESET_META[samplePreset].label} sample (rendered locally)` : "Current audio kept"}</strong>
                        <em>{audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(1)} MB` : sampleBlob ? PRESET_META[samplePreset].hint : "from the original post"} · {formatDuration(audioDur || keptAudio?.duration)}</em>
                      </span>
                      <Check size={17} className="ok-check" />
                      <button className="icon-btn" aria-label="Remove audio" onClick={() => { setAudioFile(null); setSampleBlob(null); setKeptAudio(null); setAudioDur(0); }}><X size={16} /></button>
                    </div>
                  ) : (
                    <div className={`dropzone${dragAudio ? " drag" : ""}`} onClick={() => audioInput.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragAudio(true); }} onDragLeave={() => setDragAudio(false)}
                      onDrop={(e) => { e.preventDefault(); setDragAudio(false); const f = e.dataTransfer.files?.[0]; if (f) acceptAudio(f); }}
                      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") audioInput.current?.click(); }}>
                      <Upload size={26} /><strong>Drop your track here</strong>
                      <span>or click to browse · MP3, WAV, M4A, OGG · up to 100MB</span>
                    </div>
                  )}
                  <input ref={audioInput} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptAudio(f); e.target.value = ""; }} />
                  {errors.audio && <div className="error-text">{errors.audio}</div>}
                  {!audioFile && !sampleBlob && !keptAudio && (
                    <div className="sample-row">
                      <span className="hint">No file handy?</span>
                      <select className="select" value={samplePreset} onChange={(e) => setSamplePreset(e.target.value as PresetName)} aria-label="Sample style">
                        {Object.entries(PRESET_META).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.hint}</option>)}
                      </select>
                      <button className="btn btn-outline btn-sm" onClick={synthesize} disabled={sampleBusy}>
                        {sampleBusy ? <Spinner size={14} /> : <Wand2 size={14} />}<span>{sampleBusy ? "Rendering…" : "Synthesize a sample"}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className={`field${errors.thumb ? " field-error" : ""}`}>
                  <div className="field-top">
                    <label className="label">Thumbnail <span className="req">*</span></label>
                    <div className="mini-seg">
                      <button className={thumbMode === "generate" ? "on" : ""} onClick={() => setThumbMode("generate")}><Sparkles size={13} />Generated art</button>
                      <button className={thumbMode === "upload" ? "on" : ""} onClick={() => setThumbMode("upload")}><ImageIcon size={13} />Your image</button>
                    </div>
                  </div>
                  {thumbMode === "generate" ? (
                    <div className="thumb-gen">
                      <img src={generatedCover} alt="Generated cover art preview" className="thumb-preview" />
                      <div className="thumb-gen-controls">
                        <div className="swatches">
                          {PALETTES.map((p, i) => <button key={p.name} title={p.name} aria-label={`Palette ${p.name}`} className={`swatch${form.coverPalette === i ? " active" : ""}`} style={{ background: `linear-gradient(135deg, ${p.a}, ${p.b})` }} onClick={() => set({ coverPalette: i })} />)}
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => set({ coverSeed: uid() })}><RefreshCw size={14} />New variation</button>
                        <p className="hint">Cover art is generated from your track&apos;s identity — every variation is unique.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="thumb-up">
                      {(thumbPreview || keptThumbUrl) ? (
                        <div className="thumb-up-preview">
                          <img src={thumbPreview ?? keptThumbUrl!} alt="Thumbnail preview" className="thumb-preview" />
                          <button className="icon-btn thumb-remove" aria-label="Remove thumbnail" onClick={() => { setThumbFile(null); setThumbPreview(null); setKeptThumb(null); }}><X size={15} /></button>
                        </div>
                      ) : (
                        <div className={`dropzone thumb-drop${dragThumb ? " drag" : ""}`} onClick={() => thumbInput.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setDragThumb(true); }} onDragLeave={() => setDragThumb(false)}
                          onDrop={(e) => { e.preventDefault(); setDragThumb(false); const f = e.dataTransfer.files?.[0]; if (f) acceptThumb(f); }}
                          role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") thumbInput.current?.click(); }}>
                          <ImageIcon size={22} /><strong>Add a thumbnail</strong><span>JPG, PNG or WebP · cropped square · up to 8MB</span>
                        </div>
                      )}
                      <input ref={thumbInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptThumb(f); e.target.value = ""; }} />
                    </div>
                  )}
                  {errors.thumb && <div className="error-text">{errors.thumb}</div>}
                </div>
              </>
            ) : (
              <div className={`field${errors.youtube ? " field-error" : ""}`}>
                <label className="label" htmlFor="yt-url">YouTube link</label>
                <div className="input-icon"><Link2 size={16} /><input id="yt-url" value={form.youtubeUrl} onChange={(e) => set({ youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></div>
                {errors.youtube && <div className="error-text">{errors.youtube}</div>}
                {ytId && (
                  <div className="yt-preview">
                    <div className="yt-embed-wrap"><iframe src={ytEmbed(ytId)} title="YouTube preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" /></div>
                    <div className="yt-meta">
                      <span className="src-badge yt"><Youtube size={13} />Video detected</span>
                      {oembed?.title && <p className="yt-title">{oembed.title}{oembed.author ? ` · ${oembed.author}` : ""}</p>}
                      {oembed?.title && !form.title && <button className="btn btn-ghost btn-sm" onClick={() => set({ title: oembed.title!.slice(0, 120) })}><Check size={14} />Use video title</button>}
                      <p className="hint">Only the official embed is used. Audio is never downloaded from YouTube.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="form-card">
            <Field label="3 · Background" hint="The story behind the track — the session, the happy accident, the 3am idea." counter={`${form.background.length}/1200`}>
              <textarea className="textarea" rows={4} maxLength={1200} value={form.background} onChange={(e) => set({ background: e.target.value })} placeholder="I wanted the sound of driving home at 1am when every light is green…" />
            </Field>
          </section>

          <section className="form-card">
            <Field label="4 · Style / Prompt" hint="The exact prompt or style tags you fed the model. Listeners can copy it in one tap." counter={`${form.stylePrompt.length}/600`}>
              <textarea className="textarea prompt-area" rows={3} maxLength={600} value={form.stylePrompt} onChange={(e) => set({ stylePrompt: e.target.value })} placeholder="synthwave, 100 BPM, A minor, analog saw pads, night drive, no vocals" />
            </Field>
            <div className="tagrow">{TAGS.map((t) => <button key={t} className="tag" onClick={() => set({ stylePrompt: form.stylePrompt ? `${form.stylePrompt.replace(/,\s*$/, "")}, ${t}` : t })}>+ {t}</button>)}</div>
          </section>

          <section className="form-card">
            <div className="field-top">
              <label className="label">5 · Lyrics</label>
              <label className="toggle">
                <input type="checkbox" checked={form.instrumental} onChange={(e) => set({ instrumental: e.target.checked })} />
                <span className="toggle-track"><span className="toggle-knob" /></span><span>Instrumental</span>
              </label>
            </div>
            {form.instrumental ? (
              <div className="instru sm"><Disc3 size={26} className="slow-spin" /><div><strong>Instrumental track</strong><p>The lyrics section will show a tasteful “no words” panel.</p></div></div>
            ) : (
              <Field label="" counter={`${form.lyrics.length}/5000`} hint="Use [Verse], [Chorus], [Bridge] markers — they become styled section labels.">
                <textarea className="textarea lyrics-area" rows={8} maxLength={5000} value={form.lyrics} onChange={(e) => set({ lyrics: e.target.value })} placeholder={"[Verse]\nI planted all my questions in the dark…\n\n[Chorus]\nAnd they bloomed at midnight, neon and slow…"} />
              </Field>
            )}
          </section>

          <section className={`form-card${errors.rights ? " field-error" : ""}`}>
            <div className="field-top"><label className="label">6 · Rights attestation <span className="req">*</span></label><ShieldCheck size={17} style={{ color: "var(--lime)" }} /></div>
            <label className={`trust-attest${attested ? " on" : ""}`}>
              <input type="checkbox" checked={attested} onChange={(e) => { setAttested(e.target.checked); if (e.target.checked) setErrors((x) => ({ ...x, rights: "" })); }} />
              <span className="trust-check">{attested && <Check size={14} />}</span>
              <span>I have the rights to upload this music, including any AI-generated parts, samples, vocals, lyrics and cover art.</span>
            </label>
            {errors.rights && <div className="error-text">{errors.rights}</div>}
            <p className="hint">
              After publishing you&apos;ll be asked to complete the provenance declaration — licence, AI tool used, human contribution,
              explicit flag and any third-party samples. Read the <Link href="/legal/terms" className="more-btn">Terms</Link> and the{" "}
              <Link href="/legal/dmca" className="more-btn">Copyright policy</Link>.
            </p>
          </section>

          <div className="publish-row">
            <Link href={editId ? `/track/${editId}` : "/"} className="btn btn-ghost">Cancel</Link>
            <button className="btn btn-brand btn-lg" onClick={publish} disabled={busy}>
              {busy ? <Spinner size={17} /> : editId ? <Pencil size={17} /> : <Sparkles size={17} />}
              <span>{busy ? "Saving…" : editId ? "Save changes" : "Publish to the feed"}</span>
              {!busy && <ArrowRight size={16} />}
            </button>
          </div>
        </div>

        <div className={`preview-col${showPreview ? " open" : ""}`}>
          <div className="preview-sticky">
            <div className="preview-label"><Music2 size={15} />Live preview — how your post will look</div>
            <article className="tcard preview-card">
              <div className="tcard-head">
                <span className="tcard-artist">
                  <img src={coverUrl(currentUser.name, currentUser.avatarPalette)} alt="" className="avatar-img" style={{ width: 38, height: 38 }} />
                  <span className="tcard-artist-info"><strong>{currentUser.name}</strong><em>@{currentUser.handle} · just now</em></span>
                </span>
                <SourceBadge t={previewTrack} />
              </div>
              <div className="tcard-media preview-media">
                <img src={effectiveThumb} alt="" className="media-img" />
                <div className="media-shade" />
                <span className="play-overlay"><Music2 size={24} /></span>
              </div>
              <div className="tcard-body">
                <span className="tcard-title">{form.title || "Untitled track"}</span>
                {form.background && <p className="tcard-bg clamp">{form.background}</p>}
                <PromptChip prompt={form.stylePrompt} />
              </div>
            </article>
            <div className="preview-detail">
              <div className="preview-label sm">On the track page</div>
              <LyricsView track={previewTrack} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}