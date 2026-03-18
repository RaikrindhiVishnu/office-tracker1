// ─── Email Templates ──────────────────────────────────────────────────────────

const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: #f0f4f8; }
`;

const footer = `
  <tr>
    <td style="background:#1e293b;padding:24px 40px;text-align:center;border-radius:0 0 20px 20px;">
      <p style="color:#94a3b8;font-size:13px;margin:0 0 6px;">
        🏢 <strong style="color:#e2e8f0;">Techgy Innovations</strong>
      </p>
      <p style="color:#64748b;font-size:11px;margin:0;">
        This is an automated message from your HR system. Please do not reply to this email.
      </p>
    </td>
  </tr>
`;

// ─── Birthday Template ────────────────────────────────────────────────────────
export function buildBirthdayHtml(name: string): string {
  const firstName = name.split(" ")[0];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseStyles}</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:48px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);">

      <!-- Animated banner -->
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#db2777 100%);padding:56px 40px;text-align:center;position:relative;">
          <div style="font-size:80px;line-height:1;margin-bottom:12px;">🎂</div>
          <h1 style="color:#fff;font-size:36px;font-weight:900;margin:0 0 8px;letter-spacing:-1px;text-shadow:0 2px 20px rgba(0,0,0,0.2);">
            Happy Birthday!
          </h1>
          <p style="color:#e0e7ff;font-size:16px;margin:0;font-weight:500;">
            🎉 Celebrating You Today 🎉
          </p>
        </td>
      </tr>

      <!-- Confetti row -->
      <tr>
        <td style="background:linear-gradient(180deg,#4f46e5,#6366f1);padding:12px 40px;text-align:center;font-size:24px;letter-spacing:8px;">
          🎈 🥳 🎊 🎁 🎀 🎊 🥳 🎈
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#fff;padding:44px 48px;">
          <p style="font-size:22px;font-weight:800;color:#1e293b;margin:0 0 20px;">
            Dear ${firstName}! 🌟
          </p>
          <p style="font-size:16px;color:#475569;line-height:1.8;margin:0 0 18px;">
            On behalf of the entire <strong style="color:#6366f1;">Techgy Innovations</strong> family,
            we want to take a moment to celebrate you and wish you the most wonderful birthday!
          </p>
          <p style="font-size:16px;color:#475569;line-height:1.8;margin:0 0 18px;">
            Your dedication, creativity, and energy are what make our team truly special.
            Today, we celebrate not just your birthday — but everything you bring to our workplace every day. 🙌
          </p>
          <p style="font-size:16px;color:#475569;line-height:1.8;margin:0 0 32px;">
            May this year be your best one yet — filled with new adventures, achievements, and abundant joy! ✨
          </p>

          <!-- Card box -->
          <div style="background:linear-gradient(135deg,#fdf4ff,#ede9fe,#dbeafe);border:2px solid #c4b5fd;border-radius:16px;padding:28px 32px;text-align:center;margin:0 0 36px;">
            <div style="font-size:40px;margin-bottom:10px;">🥂</div>
            <p style="font-size:22px;font-weight:900;color:#7c3aed;margin:0 0 8px;letter-spacing:-0.5px;">
              Many Happy Returns of the Day!
            </p>
            <p style="font-size:15px;color:#9333ea;margin:0;font-style:italic;">
              "Here's to the amazing person you are and all the wonderful things yet to come!"
            </p>
          </div>

          <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
            <p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.6;">
              With love & warm wishes,<br/>
              <strong style="color:#475569;font-size:15px;">The HR Team 🎊</strong><br/>
              <span style="color:#6366f1;font-weight:700;">Techgy Innovations</span>
            </p>
          </div>
        </td>
      </tr>

      ${footer}
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Festival Template ────────────────────────────────────────────────────────
export function buildFestivalHtml(
  name: string,
  festivalTitle: string,
  message: string,
  emoji: string = "🪔",
  bannerColor: string = "#f59e0b"
): string {
  const firstName = name.split(" ")[0];
  const lighter = bannerColor + "22";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseStyles}</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7;padding:48px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12);">

      <!-- Banner -->
      <tr>
        <td style="background:linear-gradient(135deg,${bannerColor},${bannerColor}cc);padding:56px 40px;text-align:center;">
          <div style="font-size:80px;margin-bottom:12px;">${emoji}</div>
          <h1 style="color:#fff;font-size:34px;font-weight:900;margin:0 0 8px;text-shadow:0 2px 20px rgba(0,0,0,0.2);">
            ${festivalTitle}
          </h1>
          <p style="color:rgba(255,255,255,0.9);font-size:16px;margin:0;">
            Warm festival wishes from Techgy Innovations
          </p>
        </td>
      </tr>

      <!-- Decorative -->
      <tr>
        <td style="background:${bannerColor};padding:8px;text-align:center;font-size:20px;letter-spacing:12px;">
          ✨ ✨ ✨ ✨ ✨ ✨ ✨
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#fff;padding:44px 48px;">
          <p style="font-size:21px;font-weight:800;color:#1e293b;margin:0 0 20px;">
            Dear ${firstName},
          </p>
          <div style="background:${lighter};border-left:4px solid ${bannerColor};border-radius:0 12px 12px 0;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:16px;color:#374151;line-height:1.8;margin:0;font-style:italic;">
              ${message}
            </p>
          </div>
          <p style="font-size:15px;color:#6b7280;line-height:1.8;margin:0 0 32px;">
            On behalf of the entire team at <strong style="color:#374151;">Techgy Innovations</strong>,
            we wish you and your family a joyful celebration filled with happiness, prosperity, and wonderful moments together. 🌺
          </p>

          <div style="text-align:center;padding:24px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:16px;margin-bottom:32px;">
            <p style="font-size:32px;margin:0 0 10px;">${emoji}</p>
            <p style="font-size:18px;font-weight:800;color:#92400e;margin:0;">
              Happy ${festivalTitle}!
            </p>
          </div>

          <div style="border-top:1px solid #f3f4f6;padding-top:24px;">
            <p style="color:#9ca3af;font-size:14px;margin:0;line-height:1.6;">
              With festive wishes,<br/>
              <strong style="color:#374151;font-size:15px;">The HR Team</strong><br/>
              <strong style="color:${bannerColor};">Techgy Innovations</strong>
            </p>
          </div>
        </td>
      </tr>

      ${footer}
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── Event Template ───────────────────────────────────────────────────────────
export function buildEventHtml(
  name: string,
  eventTitle: string,
  description: string,
  eventDate: string,
  location?: string,
  rsvpLink?: string,
  color: string = "#6366f1"
): string {
  const firstName = name.split(" ")[0];
  const formattedDate = new Date(eventDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${baseStyles}</style></head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.1);">

      <!-- Banner -->
      <tr>
        <td style="background:linear-gradient(135deg,${color},${color}99);padding:48px 40px;text-align:center;">
          <div style="font-size:64px;margin-bottom:12px;">📅</div>
          <h1 style="color:#fff;font-size:30px;font-weight:900;margin:0 0 8px;">
            ${eventTitle}
          </h1>
          <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">
            Company Event Announcement
          </p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="background:#fff;padding:44px 48px;">
          <p style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 20px;">
            Hello ${firstName},
          </p>
          <p style="font-size:16px;color:#475569;line-height:1.8;margin:0 0 28px;">
            We are excited to announce an upcoming company event and would love for you to be part of it!
          </p>

          <!-- Event Details Card -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:28px 32px;margin:0 0 28px;">
            <h2 style="font-size:18px;font-weight:800;color:${color};margin:0 0 20px;">📌 Event Details</h2>
            
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Event</span><br/>
                  <span style="font-size:15px;font-weight:700;color:#1e293b;">${eventTitle}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">📅 Date</span><br/>
                  <span style="font-size:15px;font-weight:700;color:#1e293b;">${formattedDate}</span>
                </td>
              </tr>
              ${location ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                  <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">📍 Location</span><br/>
                  <span style="font-size:15px;font-weight:700;color:#1e293b;">${location}</span>
                </td>
              </tr>` : ""}
              <tr>
                <td style="padding:8px 0;">
                  <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">About</span><br/>
                  <span style="font-size:14px;color:#475569;line-height:1.7;">${description}</span>
                </td>
              </tr>
            </table>
          </div>

          ${rsvpLink ? `
          <div style="text-align:center;margin:0 0 32px;">
            <a href="${rsvpLink}" style="display:inline-block;background:${color};color:#fff;font-size:15px;font-weight:800;padding:14px 36px;border-radius:50px;text-decoration:none;">
              ✅ RSVP Now
            </a>
          </div>` : ""}

          <div style="border-top:1px solid #f1f5f9;padding-top:24px;">
            <p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.6;">
              We look forward to seeing you there!<br/>
              <strong style="color:#475569;font-size:15px;">The HR Team</strong><br/>
              <strong style="color:${color};">Techgy Innovations</strong>
            </p>
          </div>
        </td>
      </tr>

      ${footer}
    </table>
  </td></tr>
</table>
</body></html>`;
}