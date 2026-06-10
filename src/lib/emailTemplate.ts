export function buildMncEmailHtml(
  title: string,
  emoji: string,
  subtext: string,
  recipientName: string,
  htmlContent: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:left;">
          
          <!-- HEADER -->
          <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
            <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0;letter-spacing:-0.5px;">
              ${title}
            </h1>
            ${subtext ? `<p style="color:#e0e7ff;font-size:14px;margin:8px 0 0;">${subtext}</p>` : ''}
          </div>

          <!-- BODY -->
          <div style="padding:36px 40px;">
            ${recipientName ? `
            <p style="color:#0f172a;font-size:18px;font-weight:700;margin:0 0 16px;">
              Dear ${recipientName},
            </p>` : ''}
            
            <div style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px;">
              ${htmlContent}
            </div>

            <!-- MNC FOOTER -->
            <div style="font-size:14px;color:#64748b;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px 0;color:#0f172a;font-weight:700;">Regards,</p>
              <p style="margin:0 0 12px 0;color:#1e40af;font-weight:800;font-size:15px;">HR Team</p>
              
              <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
                <strong>Techgy Innovations</strong><br/>
                Global Headquarters<br/>
                <a href="https://techgyinnovations.com" style="color:#2563eb;text-decoration:none;">www.techgyinnovations.com</a>
              </div>
            </div>
          </div>

          <!-- Footer Note -->
          <div style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">
              This is an automated notification from Techgy Innovations.<br/>
              Please do not reply directly to this email.
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
