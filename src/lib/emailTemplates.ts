import { buildMncEmailHtml } from "./emailTemplate";

// ─── Birthday Template ────────────────────────────────────────────────────────
export function buildBirthdayHtml(name: string): string {
  const firstName = name.split(" ")[0];
  const content = `
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
  `;

  return buildMncEmailHtml(
    "Happy Birthday!",
    "🎂",
    "🎉 Celebrating You Today 🎉",
    firstName,
    content
  );
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
  const content = `
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
  `;

  return buildMncEmailHtml(
    festivalTitle,
    emoji,
    "Warm festival wishes from Techgy Innovations",
    firstName,
    content
  );
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

  const content = `
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
        ${location ? \`<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">📍 Location</span><br/>
            <span style="font-size:15px;font-weight:700;color:#1e293b;">\${location}</span>
          </td>
        </tr>\` : ""}
        <tr>
          <td style="padding:8px 0;">
            <span style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">About</span><br/>
            <span style="font-size:14px;color:#475569;line-height:1.7;">${description}</span>
          </td>
        </tr>
      </table>
    </div>

    ${rsvpLink ? \`
    <div style="text-align:center;margin:0 0 32px;">
      <a href="\${rsvpLink}" style="display:inline-block;background:\${color};color:#fff;font-size:15px;font-weight:800;padding:14px 36px;border-radius:50px;text-decoration:none;">
        ✅ RSVP Now
      </a>
    </div>\` : ""}
  `;

  return buildMncEmailHtml(
    eventTitle,
    "📅",
    "Company Event Announcement",
    firstName,
    content
  );
}