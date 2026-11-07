/** Transactional email via Resend (https://resend.com). No-op when RESEND_API_KEY is unset. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const from = process.env.EMAIL_FROM || "Y2ube <no-reply@y2ube.io>";
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, html }) });
  return res.ok;
}

const wrap = (title: string, body: string, cta?: { href: string; label: string }) => `
<div style="font-family:Noto Sans,Arial,sans-serif;background:#0a0a0d;padding:32px;color:#f7f7fb">
  <div style="max-width:560px;margin:0 auto;background:#111116;border:1px solid #303030;border-radius:16px;padding:28px">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px"><span style="display:inline-block;width:22px;height:22px;background:#5B5AF7;border-radius:6px;vertical-align:middle;margin-right:8px"></span>Y2ube</div>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <div style="color:#cecfd9;font-size:15px;line-height:1.5">${body}</div>
    ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#5B5AF7;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">${cta.label}</a>` : ""}
    <p style="color:#97a;font-size:12px;margin-top:28px">You're receiving this because you generated a video on Y2ube. <a href="${process.env.APP_URL || "https://app.y2ube.io"}/settings" style="color:#97a">Settings</a></p>
  </div>
</div>`;

export const emails = {
  ready: (title: string, url: string, attention: boolean) => ({
    subject: attention ? `Your video is ready (with a note): ${title}` : `Your video is ready: ${title}`,
    html: wrap("Your video is ready.", `<p><strong>${title}</strong> finished rendering.${attention ? " Some visuals fell back — open the video to review and regenerate them if needed." : ""}</p>`, { href: url, label: "Open video" }),
  }),
  failed: (title: string, url: string, error: string) => ({
    subject: `We couldn't finish: ${title}`,
    html: wrap("Generation didn't complete.", `<p><strong>${title}</strong> stopped with: <em>${error.slice(0, 200)}</em>.</p><p>Your reserved credits have been refunded. You can retry from the last step on the project page.</p>`, { href: url, label: "Open project" }),
  }),
};
