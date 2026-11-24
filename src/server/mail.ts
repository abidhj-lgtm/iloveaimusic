import "server-only";
import { RESEND_KEY, MAIL_FROM, MAIL_MODE, SITE_URL } from "./env";
import { getRepo } from "./store";

export interface DevMail {
  id: string; to: string; token: string; kind: "verify" | "reset";
  sentAt: number; expiresAt: number; used: boolean;
  subject: string; body: string; actionLabel: string; actionUrl: string;
}

export async function readDevInbox(boxId: string | null): Promise<DevMail[]> {
  if (MAIL_MODE !== "dev" || !boxId) return [];
  const rows = await getRepo().listDevMail(boxId);
  return rows.map((m) => ({
    id: m.id, to: m.to_email, token: m.token, kind: m.kind,
    sentAt: Date.parse(m.sent_at), expiresAt: Date.parse(m.expires_at), used: !!m.used_at,
    subject: m.subject, body: m.body,
    actionLabel: m.kind === "verify" ? "Verify my email" : "Choose a new password",
    actionUrl: `${SITE_URL}/${m.kind === "verify" ? "verify" : "reset"}?token=${encodeURIComponent(m.token)}`
  }));
}

export const markDevMailUsed = (token: string) => getRepo().markDevMailUsed(token);

function shell(title: string, intro: string, label: string, url: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0a0712;padding:32px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f4efff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#171126;border:1px solid #2c2145;border-radius:18px;padding:32px">
<tr><td style="font-size:20px;font-weight:800">I Love <span style="color:#ec4899">AI Music</span></td></tr>
<tr><td style="font-size:17px;font-weight:700;padding:18px 0 10px">${title}</td></tr>
<tr><td style="font-size:14px;line-height:1.7;color:#a79fc7;padding-bottom:24px">${intro}</td></tr>
<tr><td><a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 26px;border-radius:12px">${label}</a></td></tr>
<tr><td style="font-size:12px;color:#7d739e;padding-top:22px;line-height:1.6">${footer}<br/><span style="color:#22d3ee;word-break:break-all">${url}</span></td></tr>
<tr><td style="font-size:11px;color:#5d5480;padding-top:18px">iloveaimusic.com · where AI music finds its listeners</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendAuthMail(opts: {
  to: string; kind: "verify" | "reset"; token: string; expiresAt: number; name: string; boxId: string;
}): Promise<{ delivered: boolean }> {
  const isVerify = opts.kind === "verify";
  const url = `${SITE_URL}/${isVerify ? "verify" : "reset"}?token=${encodeURIComponent(opts.token)}`;
  const subject = isVerify ? "Verify your email for I Love AI Music" : "Reset your I Love AI Music password";
  const title = isVerify ? `Welcome, ${opts.name}.` : "Password reset requested.";
  const intro = isVerify
    ? "Confirm this address to activate your studio. Once verified you can log in and post tracks from any device. This link is single-use and expires in 24 hours."
    : "Someone asked to reset the password for this account. Choose a new one within the hour. Using this link signs out every other device. If this wasn't you, ignore it.";
  const label = isVerify ? "Verify my email" : "Choose a new password";

  if (MAIL_MODE === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: MAIL_FROM, to: [opts.to], subject,
          html: shell(title, intro, label, url, `Sent to ${opts.to}.`),
          text: `${title}\n\n${intro}\n\n${label}: ${url}\n\n— I Love AI Music · iloveaimusic.com\n`
        })
      });
      return { delivered: res.ok };
    } catch { return { delivered: false }; }
  }

  await getRepo().putDevMail({
    box_id: opts.boxId, to_email: opts.to.toLowerCase(), kind: opts.kind, token: opts.token,
    subject, body: intro, sent_at: new Date().toISOString(),
    expires_at: new Date(opts.expiresAt).toISOString(), used_at: null
  });
  return { delivered: true };
}