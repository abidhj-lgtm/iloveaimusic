"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, Wand2, Scale, AlertTriangle, Save, Check, Disc3 } from "lucide-react";
import { Spinner } from "./ui";
import { useStore, useToast } from "@/lib/store";
import { LICENSES, AI_TOOLS } from "@/lib/rights-options";

interface Rights {
  attested: boolean; license: string; ai_tool: string; human_contribution: string;
  explicit: boolean; third_party_samples: boolean; monetizable: boolean; distribution_ok: boolean;
}

const blank: Rights = {
  attested: false, license: "all_rights_reserved", ai_tool: "unspecified", human_contribution: "",
  explicit: false, third_party_samples: false, monetizable: false, distribution_ok: true
};

export function RightsBadgeRow({ rights }: { rights: Rights | null }) {
  if (!rights) return null;
  const lic = LICENSES.find((l) => l.id === rights.license);
  const tool = AI_TOOLS.find((t) => t.id === rights.ai_tool);
  return (
    <div className="trust-badges">
      <span className={`src-badge ${rights.attested ? "gen" : "yt"}`}>
        {rights.attested ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
        {rights.attested ? "Rights attested" : "Provenance missing"}
      </span>
      <span className="src-badge neutral"><Scale size={13} />{lic?.label ?? rights.license}</span>
      {tool && rights.ai_tool !== "unspecified" && <span className="src-badge up"><Wand2 size={13} />{tool.label}</span>}
      <span className={`src-badge ${rights.explicit ? "yt" : "neutral"}`}>{rights.explicit ? "Explicit" : "Safe"}</span>
      {rights.third_party_samples && <span className="src-badge yt"><Disc3 size={13} />Contains samples</span>}
      {rights.monetizable && <span className="src-badge gen">Monetisable</span>}
    </div>
  );
}

export function RightsPanel({ trackId, isOwner, initial }: { trackId: string; isOwner: boolean; initial: Rights | null }) {
  const { currentUser } = useStore();
  const toast = useToast();
  const [rights, setRights] = useState<Rights>(initial ?? blank);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (initial) setRights(initial); }, [initial]);
  const set = (patch: Partial<Rights>) => setRights((r) => ({ ...r, ...patch }));

  const save = async () => {
    setError("");
    if (!rights.attested) { setError("Confirm you hold the rights before saving."); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/rights/${encodeURIComponent(trackId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          attested: true, license: rights.license, aiTool: rights.ai_tool,
          humanContribution: rights.human_contribution, explicit: rights.explicit,
          thirdPartySamples: rights.third_party_samples, monetizable: rights.monetizable,
          distributionOk: rights.distribution_ok
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) { setError(data?.error ?? "Could not save."); return; }
      setRights(data.rights); setEditing(false);
      toast.push({ kind: "ok", msg: "Provenance saved. Listeners can see it now." });
    } catch { setError("Can't reach the server."); }
    finally { setBusy(false); }
  };

  if (!isOwner || !currentUser) {
    return (
      <div className="trust-panel">
        <RightsBadgeRow rights={rights} />
        {rights.human_contribution && <p className="trust-human"><strong>Human contribution:</strong> {rights.human_contribution}</p>}
        {!rights.attested && <p className="trust-warn"><AlertTriangle size={14} />The creator has not completed the provenance declaration for this track yet.</p>}
      </div>
    );
  }

  return (
    <div className={`trust-panel${rights.attested ? "" : " trust-panel-alert"}`}>
      <div className="trust-panel-head">
        <div>
          <h3><ShieldCheck size={17} />Rights &amp; provenance</h3>
          <p>{rights.attested ? "This is what listeners and moderators see." : "Complete this so listeners know what they are hearing — and so moderators can defend your post."}</p>
        </div>
        {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{rights.attested ? "Edit" : "Complete now"}</button>}
      </div>

      {!editing ? (
        <>
          <RightsBadgeRow rights={rights} />
          {rights.human_contribution && <p className="trust-human"><strong>Human contribution:</strong> {rights.human_contribution}</p>}
        </>
      ) : (
        <div className="trust-form">
          <div className="trust-grid">
            <div className="field">
              <label className="label" htmlFor="rg-lic">Licence</label>
              <select id="rg-lic" className="select wfull" value={rights.license} onChange={(e) => set({ license: e.target.value })}>
                {LICENSES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <span className="hint">{LICENSES.find((l) => l.id === rights.license)?.note}</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="rg-tool">AI tool used</label>
              <select id="rg-tool" className="select wfull" value={rights.ai_tool} onChange={(e) => set({ ai_tool: e.target.value })}>
                {AI_TOOLS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <span className="hint">Provenance helps listeners understand the work.</span>
            </div>
          </div>

          <div className="field">
            <div className="field-top">
              <label className="label" htmlFor="rg-human">Human contribution</label>
              <span className="counter">{rights.human_contribution.length}/300</span>
            </div>
            <textarea id="rg-human" className="textarea" rows={2} maxLength={300} value={rights.human_contribution}
              onChange={(e) => set({ human_contribution: e.target.value })}
              placeholder="Lyrics, topline, arrangement, prompt design, mixing, editing…" />
          </div>

          <div className="trust-toggles">
            {([
              ["explicit", "Explicit content", "Language or themes not suitable for all ages."],
              ["third_party_samples", "Contains third-party samples", "Any recorded material you did not create from scratch."],
              ["monetizable", "Monetisation allowed", "You permit this track to earn money on this platform."],
              ["distribution_ok", "Public distribution allowed", "The track may appear in the public feed and search."]
            ] as const).map(([key, label, hint]) => (
              <label key={key} className="trust-toggle">
                <input type="checkbox" checked={rights[key] as boolean} onChange={(e) => set({ [key]: e.target.checked } as Partial<Rights>)} />
                <span className="toggle-track"><span className="toggle-knob" /></span>
                <span><strong>{label}</strong><em>{hint}</em></span>
              </label>
            ))}
          </div>

          <label className={`trust-attest${rights.attested ? " on" : ""}`}>
            <input type="checkbox" checked={rights.attested} onChange={(e) => set({ attested: e.target.checked })} />
            <span className="trust-check">{rights.attested && <Check size={14} />}</span>
            <span>I have the rights to this music, including any AI-generated parts, samples, vocals, lyrics and cover art.</span>
          </label>

          {error && <div className="notice err">{error}</div>}

          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setError(""); if (initial) setRights(initial); }}>Cancel</button>
            <button className="btn btn-brand" onClick={save} disabled={busy}>
              {busy ? <Spinner size={15} /> : <Save size={15} />}<span>{busy ? "Saving…" : "Save provenance"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}