import "server-only";
import { getRepo, resolveTrackId, resolveProfileId } from "../store";
import { ensureCatalogSeeded } from "../content-service";
import { uuid } from "../crypto";
import { IS_PROD, STAFF_EMAILS, DEMO_EMAIL } from "../env";
import { trustStore } from "./store";
import { defaultRights, REASON_LABEL, type ReportReason, type ReportStatus, type RightsRow, type ModAction, type ModRow } from "./types";

export type StaffRole = "user" | "creator" | "moderator" | "admin";

/**
 * Staff access. In production the ONLY source of staff rights is STAFF_EMAILS.
 * The demo account is explicitly demoted so a publicly-known password can
 * never grant moderation powers on a live deployment.
 */
export async function roleFor(profile: { id: string; role: StaffRole; email?: string } | null): Promise<StaffRole> {
  if (!profile) return "user";
  const email = (profile.email ?? "").toLowerCase();
  if (email && STAFF_EMAILS.includes(email)) return "admin";
  if (IS_PROD && email === DEMO_EMAIL) return "creator";
  const override = await trustStore().roleOf(profile.id);
  if (IS_PROD && override === "admin" && !STAFF_EMAILS.includes(email)) return "creator";
  return override ?? profile.role;
}

export const isStaff = (r: StaffRole) => r === "admin" || r === "moderator";

let seeded: Promise<void> | null = null;
export function ensureTrustSeeded(): Promise<void> {
  if (!seeded) seeded = seed().catch(() => { seeded = null; });
  return seeded;
}

async function seed(): Promise<void> {
  await ensureCatalogSeeded();
  const store = trustStore();
  const state = await store.all();
  const repo = getRepo();
  const demo = await repo.findProfileByLegacy("u-aria");

  if (demo) {
    const existing = await store.roleOf(demo.id);
    if (!IS_PROD && !existing) await store.setRole(demo.id, "admin");
    if (IS_PROD && existing && existing !== "creator") await store.setRole(demo.id, "creator");
  }

  if (state.reports.length > 0) return;

  const pick = async (legacy: string) => {
    const id = await resolveTrackId(legacy);
    const row = id ? await repo.findTrackById(id) : null;
    return row ? { id: row.id, owner: row.user_id, title: row.title } : null;
  };
  const reporter = async (legacy: string) => (await repo.findProfileByLegacy(legacy))?.id ?? null;

  const blueprint: { track: string; by: string; reason: ReportReason; details: string; status: ReportStatus; ageH: number; note?: string }[] = [
    { track: "t-faded", by: "u-kaito", reason: "copyright", details: "This post embeds the original master recording rather than the creator's own rework. The description says 'reference study', but the audio is the commercial release. Requesting removal or a clear re-label.", status: "open", ageH: 3 },
    { track: "t-study", by: "u-nova", reason: "broken_media", details: "The live stream stopped resolving for me twice this evening — the player shows the buffering spinner and never starts. Might be region blocked.", status: "open", ageH: 7 },
    { track: "t-highway", by: "u-mara", reason: "spam", details: "Same 24/7 broadcast has been reposted three times this week under slightly different titles. It floods the chronological feed.", status: "reviewing", ageH: 19 },
    { track: "t-bloom", by: "u-jun", reason: "explicit_mislabel", details: "Marked safe but the second verse has language that should carry the explicit flag. Minor, but the flag exists for a reason.", status: "open", ageH: 26 },
    { track: "t-rain", by: "u-mara", reason: "other", details: "The prompt lists Fmaj7 Em7 Dm7 Cmaj7 but the render is clearly in a different key. Not a policy issue — flagging so the provenance panel gets corrected.", status: "dismissed", ageH: 40, note: "Not a policy violation. Left a comment for the creator about the key mismatch." },
    { track: "t-neon", by: "u-nova", reason: "impersonation", details: "Someone registered a handle one character off this artist and reposted the same cover. Reporting the original by mistake — please check the duplicate account instead.", status: "dismissed", ageH: 52, note: "Reporter targeted the wrong account. Original is genuine; duplicate handled separately." },
    { track: "t-drift", by: "u-kaito", reason: "copyright", details: "I believe the pad layer samples a commercially released ambient record. Requesting the creator declare third-party samples in the provenance panel.", status: "actioned", ageH: 70, note: "Creator added a sample declaration and switched the licence to non-commercial. Track kept public." }
  ];

  for (const b of blueprint) {
    const t = await pick(b.track);
    const rid = await reporter(b.by);
    if (!t || !rid) continue;
    const created = new Date(Date.now() - b.ageH * 3600_000).toISOString();
    const resolved = b.status === "actioned" || b.status === "dismissed";
    await store.insertReport({
      track_id: t.id, comment_id: null, reporter_id: rid, target_owner: t.owner,
      reason: b.reason, details: b.details, status: b.status,
      resolution_note: b.note ?? "", resolved_by: resolved ? (demo?.id ?? null) : null,
      created_at: created, resolved_at: resolved ? new Date(Date.now() - (b.ageH - 2) * 3600_000).toISOString() : null
    });
  }

  for (const legacy of ["t-neon", "t-rain", "t-drift", "t-bloom"]) {
    const t = await pick(legacy);
    if (!t) continue;
    await store.upsertRights({
      ...defaultRights(t.id), attested: true, license: "cc_by_nc",
      ai_tool: "browser_synth", human_contribution: "Prompt design, key selection, arrangement and mix decisions.",
      explicit: false, third_party_samples: false, monetizable: false, distribution_ok: true
    });
  }
  const faded = await pick("t-faded");
  if (faded) {
    await store.upsertRights({
      ...defaultRights(faded.id), attested: true, license: "all_rights_reserved",
      ai_tool: "unspecified", human_contribution: "Topline study and arrangement comparison.",
      explicit: false, third_party_samples: true, monetizable: false, distribution_ok: false
    });
  }
}

export async function getRights(publicTrackId: string): Promise<RightsRow | null> {
  const id = await resolveTrackId(publicTrackId);
  if (!id) return null;
  await ensureTrustSeeded();
  return (await trustStore().getRights(id)) ?? defaultRights(id);
}

export async function setRights(publicTrackId: string, ownerRowId: string, patch: Partial<RightsRow>, ip: string) {
  const id = await resolveTrackId(publicTrackId);
  if (!id) return { ok: false as const, error: "Track not found." };
  const repo = getRepo();
  const row = await repo.findTrackById(id);
  if (!row) return { ok: false as const, error: "Track not found." };
  const role = await roleFor(await repo.findProfileById(ownerRowId));
  if (row.user_id !== ownerRowId && !isStaff(role)) return { ok: false as const, error: "Only the creator can declare provenance." };
  if (!patch.attested) return { ok: false as const, error: "You must confirm you hold the rights before saving." };

  const current = (await trustStore().getRights(id)) ?? defaultRights(id);
  const next: RightsRow = { ...current, ...patch, track_id: id, attested: true, updated_at: new Date().toISOString() };
  await trustStore().upsertRights(next);
  await repo.updateTrack(id, {
    license: next.license, ai_tool: next.ai_tool, human_contribution: next.human_contribution,
    explicit: next.explicit, rights_attested: true
  });
  await repo.audit(ownerRowId, "rights.declare", id, { license: next.license, ai_tool: next.ai_tool }, ip);
  return { ok: true as const, rights: next };
}

export interface ConsoleReport {
  id: string; reason: ReportReason; reasonLabel: string; details: string;
  status: ReportStatus; createdAt: number; resolvedAt: number | null; resolutionNote: string;
  track: { id: string; title: string; coverSeed: string; coverPalette: number; source: string; youtubeId?: string; status: string; plays: number } | null;
  owner: { id: string; name: string; handle: string; avatarPalette: number; strikes: number } | null;
  reporter: { id: string; name: string; handle: string; avatarPalette: number } | null;
  commentText?: string;
  rights: RightsRow | null;
}

export async function submitReport(reporterRowId: string, input: { trackId?: string; commentId?: string; reason: ReportReason; details: string }, ip: string) {
  await ensureTrustSeeded();
  const repo = getRepo();
  const store = trustStore();
  let trackId: string | null = null;
  let commentId: string | null = null;
  let owner: string | null = null;

  if (input.commentId) {
    const c = await repo.findComment(input.commentId);
    if (!c) return { ok: false as const, error: "Comment not found." };
    if (c.user_id === reporterRowId) return { ok: false as const, error: "You can't report your own comment." };
    commentId = c.id; trackId = c.track_id; owner = c.user_id;
  } else if (input.trackId) {
    const id = await resolveTrackId(input.trackId);
    const row = id ? await repo.findTrackById(id) : null;
    if (!row) return { ok: false as const, error: "Track not found." };
    trackId = row.id; owner = row.user_id;
    if (owner === reporterRowId) return { ok: false as const, error: "You can't report your own track." };
  } else return { ok: false as const, error: "Nothing to report." };

  const dupe = await store.findOpenReport(reporterRowId, trackId, commentId);
  if (dupe) return { ok: false as const, error: "You already have an open report on this. Our moderators are on it." };

  const row = await store.insertReport({
    track_id: trackId, comment_id: commentId, reporter_id: reporterRowId, target_owner: owner,
    reason: input.reason, details: input.details, status: "open",
    resolution_note: "", resolved_by: null, created_at: new Date().toISOString(), resolved_at: null
  });
  await repo.audit(reporterRowId, "report.create", row.id, { reason: input.reason, track: trackId, comment: commentId }, ip);
  return { ok: true as const, id: row.id };
}

export async function consoleQueue() {
  await ensureTrustSeeded();
  const repo = getRepo();
  const store = trustStore();
  const [state, profiles] = await Promise.all([store.all(), repo.listProfiles()]);
  const pub = new Map(profiles.map((p) => [p.id, p]));
  const trackCache = new Map<string, Awaited<ReturnType<typeof repo.findTrackById>>>();
  const findTrack = async (id: string | null) => {
    if (!id) return null;
    if (!trackCache.has(id)) trackCache.set(id, await repo.findTrackById(id));
    return trackCache.get(id)!;
  };
  const strikeCount = (userId: string) => state.strikes.filter((s) => s.user_id === userId && !s.revoked_at).reduce((a, s) => a + s.weight, 0);

  const reports: ConsoleReport[] = [];
  for (const r of state.reports) {
    const t = await findTrack(r.track_id);
    const owner = r.target_owner ? pub.get(r.target_owner) : undefined;
    const reporter = r.reporter_id ? pub.get(r.reporter_id) : undefined;
    const comment = r.comment_id ? await repo.findComment(r.comment_id) : null;
    reports.push({
      id: r.id, reason: r.reason, reasonLabel: REASON_LABEL[r.reason], details: r.details,
      status: r.status, createdAt: Date.parse(r.created_at),
      resolvedAt: r.resolved_at ? Date.parse(r.resolved_at) : null,
      resolutionNote: r.resolution_note,
      track: t ? { id: t.legacy_id ?? t.id, title: t.title, coverSeed: t.cover_seed, coverPalette: t.cover_palette, source: t.source, youtubeId: t.youtube_id ?? undefined, status: t.status, plays: t.plays } : null,
      owner: owner ? { id: owner.legacy_id ?? owner.id, name: owner.name, handle: owner.handle, avatarPalette: owner.avatar_palette, strikes: strikeCount(owner.id) } : null,
      reporter: reporter ? { id: reporter.legacy_id ?? reporter.id, name: reporter.name, handle: reporter.handle, avatarPalette: reporter.avatar_palette } : null,
      commentText: comment?.body,
      rights: r.track_id ? state.rights.find((x) => x.track_id === r.track_id) ?? null : null
    });
  }
  reports.sort((a, b) => b.createdAt - a.createdAt);

  const allTracks = await Promise.all(profiles.map((p) => repo.tracksByUser(p.id)));
  const artists = profiles.map((p, i) => ({
    id: p.legacy_id ?? p.id, name: p.name, handle: p.handle, avatarPalette: p.avatar_palette,
    strikes: strikeCount(p.id), tracks: allTracks[i].length,
    hidden: allTracks[i].filter((t) => t.status === "hidden" || t.status === "removed").length
  })).sort((a, b) => b.strikes - a.strikes || b.tracks - a.tracks);

  const activity = state.actions.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120).map((a) => ({
    id: a.id, batchId: a.batch_id, action: a.action, targetType: a.target_type, targetId: a.target_id,
    note: a.note, actor: a.actor_id ? pub.get(a.actor_id)?.name ?? "Staff" : "System",
    createdAt: Date.parse(a.created_at), undone: !!a.undone_at
  }));

  const dayAgo = Date.now() - 86400_000;
  return {
    reports,
    stats: {
      open: reports.filter((r) => r.status === "open").length,
      reviewing: reports.filter((r) => r.status === "reviewing").length,
      copyright: reports.filter((r) => r.reason === "copyright" && (r.status === "open" || r.status === "reviewing")).length,
      resolvedToday: reports.filter((r) => r.resolvedAt && r.resolvedAt > dayAgo).length,
      hiddenTracks: allTracks.flat().filter((t) => t.status === "hidden" || t.status === "removed").length,
      flaggedArtists: artists.filter((a) => a.strikes > 0).length,
      totalReports: reports.length,
      provenanceGaps: allTracks.flat().filter((t) => !state.rights.find((x) => x.track_id === t.id)?.attested).length
    },
    artists, activity
  };
}

export async function moderate(
  actorRowId: string, actorRole: StaffRole,
  input: { action: ModAction; reportIds?: string[]; trackIds?: string[]; commentIds?: string[]; note?: string; batchId?: string; strikeUserId?: string },
  ip: string
) {
  if (!isStaff(actorRole)) return { ok: false as const, error: "Moderator access required." };
  const repo = getRepo();
  const store = trustStore();
  const batchId = input.batchId ?? uuid();
  const note = (input.note ?? "").slice(0, 500);
  const rows: Omit<ModRow, "id">[] = [];
  const now = new Date().toISOString();

  if (input.action === "undo") {
    if (!input.batchId) return { ok: false as const, error: "Nothing to undo." };
    const undone = await store.undoBatch(input.batchId);
    for (const a of undone) {
      if (a.target_type === "track") {
        const before = a.before_state as { status?: string; deleted_at?: string | null };
        await repo.updateTrack(a.target_id, { status: (before.status ?? "published") as never, deleted_at: before.deleted_at ?? null });
      }
      if (a.target_type === "comment") {
        await repo.restoreComment(a.target_id);
      }
      if (a.target_type === "report") {
        const before = a.before_state as { status?: ReportStatus; resolution_note?: string };
        await store.patchReport(a.target_id, { status: before.status ?? "open", resolution_note: before.resolution_note ?? "", resolved_at: null, resolved_by: null });
      }
      if (a.target_type === "profile") await store.revokeStrikes(a.target_id);
    }
    await repo.audit(actorRowId, "moderation.undo", input.batchId, { count: undone.length }, ip);
    return { ok: true as const, batchId: input.batchId, affected: undone.length };
  }

  for (const publicId of input.trackIds ?? []) {
    const id = await resolveTrackId(publicId);
    const row = id ? await repo.findTrackById(id) : null;
    if (!id || !row) continue;
    if (input.action === "hide" || input.action === "remove") {
      rows.push({ batch_id: batchId, actor_id: actorRowId, action: input.action, target_type: "track", target_id: id, before_state: { status: row.status, deleted_at: row.deleted_at }, note, created_at: now, undone_at: null });
      await repo.updateTrack(id, input.action === "hide" ? { status: "hidden" } : { status: "removed", deleted_at: now });
    } else if (input.action === "restore") {
      rows.push({ batch_id: batchId, actor_id: actorRowId, action: "restore", target_type: "track", target_id: id, before_state: { status: row.status, deleted_at: row.deleted_at }, note, created_at: now, undone_at: null });
      await repo.updateTrack(id, { status: "published", deleted_at: null });
    }
  }

  for (const cid of input.commentIds ?? []) {
    const c = await repo.findComment(cid);
    if (!c || c.deleted_at) continue;
    rows.push({ batch_id: batchId, actor_id: actorRowId, action: "remove", target_type: "comment", target_id: cid, before_state: { body: c.body, track_id: c.track_id }, note, created_at: now, undone_at: null });
    await repo.softDeleteComment(cid);
  }

  if (input.action === "strike" && input.strikeUserId) {
    const uid = await resolveProfileId(input.strikeUserId);
    if (uid) {
      rows.push({ batch_id: batchId, actor_id: actorRowId, action: "strike", target_type: "profile", target_id: uid, before_state: {}, note, created_at: now, undone_at: null });
      await store.addStrike({ user_id: uid, reason: note || "Policy violation", weight: 1, issued_by: actorRowId, report_id: input.reportIds?.[0] ?? null, created_at: now, revoked_at: null });
    }
  }

  for (const rid of input.reportIds ?? []) {
    const state = await store.all();
    const r = state.reports.find((x) => x.id === rid);
    if (!r) continue;
    const nextStatus: ReportStatus = input.action === "dismiss" ? "dismissed" : input.action === "review" ? "reviewing" : "actioned";
    rows.push({ batch_id: batchId, actor_id: actorRowId, action: input.action, target_type: "report", target_id: rid, before_state: { status: r.status, resolution_note: r.resolution_note }, note, created_at: now, undone_at: null });
    await store.patchReport(rid, {
      status: nextStatus, resolution_note: note || r.resolution_note,
      resolved_by: nextStatus === "open" || nextStatus === "reviewing" ? null : actorRowId,
      resolved_at: nextStatus === "actioned" || nextStatus === "dismissed" ? now : null
    });
  }

  if (!rows.length) return { ok: false as const, error: "Nothing matched that action." };
  await store.addActions(rows);
  await repo.audit(actorRowId, `moderation.${input.action}`, batchId, { count: rows.length, note }, ip);
  return { ok: true as const, batchId, affected: rows.length };
}