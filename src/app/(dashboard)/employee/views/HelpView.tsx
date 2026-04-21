"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

const SUBJECT_LIMIT = 100;
const MESSAGE_LIMIT = 1000;
const PREVIEW_LENGTH = 150;

/* ─────────────────────────────────────────────
   FAQ DATA — Advanced Q&A
───────────────────────────────────────────── */
const FAQ_TOPICS = [
  {
    id: "dashboard",
    icon: "🏠",
    label: "Dashboard",
    color: "#3b82f6",
    bg: "#eff6ff",
    questions: [
      {
        q: "Why do my Dashboard stats differ from what HR shows?",
        a: "Dashboard stats are computed in real-time from raw check-in logs, while HR reports may use end-of-month consolidated figures. Differences can arise from:\n• Late-night check-outs crossing midnight (counted on the next day in raw logs).\n• Manual attendance corrections applied by HR that haven't propagated yet — these sync within 15 minutes.\n• Leave days marked after payroll cut-off are reflected in HR reports but not in the live dashboard until the next cycle.\nIf the gap exceeds 2 days, raise an Attendance Issue query.",
      },
      {
        q: "How is 'Overtime Hours' calculated on the Dashboard?",
        a: "Overtime = Total Worked Hours − Standard Shift Hours (usually 8 hrs/day).\n• Only hours beyond your scheduled shift on a given day count.\n• Weekend work is calculated separately at 1.5× if approved by your manager.\n• Overtime accrues weekly, not daily — so a 10-hour day offset by a 6-hour day gives 0 overtime for that pair.\nView the breakdown by clicking the Overtime card → 'Daily Detail'.",
      },
      {
        q: "Can I customise which widgets appear on my Dashboard?",
        a: "Yes. Click the ⚙️ icon at the top-right of the Dashboard. A drawer opens where you can:\n• Toggle widget visibility (e.g. hide Payslips if irrelevant).\n• Drag widgets to reorder them.\n• Reset to default layout anytime.\nLayout preferences are saved per user and persist across devices.",
      },
    ],
  },
  {
    id: "attendance",
    icon: "📅",
    label: "Attendance",
    color: "#10b981",
    bg: "#ecfdf5",
    questions: [
      {
        q: "What happens if I forget to Check Out before midnight?",
        a: "The system auto-closes your session at midnight and marks the day as a Half Day unless your shift explicitly crosses midnight (e.g. night shifts). To fix a missed checkout:\n1. Go to Help → New Query → 'Attendance Issue'.\n2. State the date, your actual check-out time, and any supporting evidence (office access log, email timestamp).\nHR can update the record retroactively within 3 business days.",
      },
      {
        q: "How does the system handle overlapping shift timings?",
        a: "If you are assigned to two shifts in the same day (e.g. a project swap), the system uses the earliest Check In and latest Check Out as your working hours. Duplicate check-ins within the same shift window (within 5 minutes) are de-duplicated automatically. Consult your manager before requesting a shift overlap — it can affect leave encashment calculations.",
      },
      {
        q: "Why does my attendance show 'Half Day' instead of 'Present'?",
        a: "A Half Day is triggered when:\n• You check in after the late-grace period (typically 30 min past shift start) AND check out early.\n• Your total working hours are less than 50% of the standard shift.\n• A manual half-day leave was applied for that date.\nIf you believe it's incorrect, cross-check your check-in/out timestamps in Attendance → Monthly View before raising a query.",
      },
      {
        q: "Can I regularise attendance for a past month?",
        a: "Regularisation is allowed up to the last day of the current month for the previous month's records. After payroll is processed (usually by the 3rd of the month), changes require Finance approval in addition to HR. To regularise:\n1. Raise an Attendance Issue query with the exact dates.\n2. Attach supporting proof (WiFi access logs, project tracking screenshots, manager email).\n3. Your manager must approve the regularisation request before HR applies it.",
      },
      {
        q: "How does geo-fencing / location-based check-in work?",
        a: "If your organisation uses geo-fenced check-in, the app verifies your GPS coordinates are within an approved radius (usually 200m from the office) before allowing Check In. Tips if it fails:\n• Ensure Location permission is set to 'Always Allow' in your phone settings.\n• Disable VPN — VPNs can spoof your location and cause failures.\n• Check if you are connected to the corporate Wi-Fi, which can override GPS for indoor accuracy.\n• Remote workers are whitelisted separately — ask HR to add your home address.",
      },
    ],
  },
  {
    id: "leave",
    icon: "🌴",
    label: "Leave",
    color: "#f59e0b",
    bg: "#fffbeb",
    questions: [
      {
        q: "What is the difference between Casual, Earned, and Sick leave?",
        a: "• Casual Leave (CL) — for personal or unplanned needs; usually 12 days/year; cannot be carried forward.\n• Earned Leave (EL) — accrues based on days worked (typically 1 day per 20 days worked); can be encashed or carried forward up to a cap (often 30 days).\n• Sick Leave (SL) — for medical reasons; 6–12 days/year depending on policy; may require a doctor's certificate for leaves > 2 consecutive days.\nLeave policies vary by employment contract — check your Offer Letter for exact entitlements.",
      },
      {
        q: "Can I apply leave for a date that has already passed?",
        a: "Back-dated leave applications are allowed within a 3-day window by default. Beyond that, only HR can apply retroactive leave, and it requires manager approval with a valid reason. To apply:\n1. Raise a Leave Problem query.\n2. Mention the dates, leave type, and reason for the delay in applying.\n3. Attach supporting documents if applicable (medical certificate, travel proof).",
      },
      {
        q: "How does Leave Without Pay (LWP) affect my salary?",
        a: "LWP is deducted at a per-day rate = Gross Monthly Salary ÷ Number of Working Days in that Month. It also affects:\n• PF contribution (lower base reduces PF).\n• Performance metrics — LWP days count as non-working days in productivity calculations.\n• Leave encashment — LWP days are excluded from EL accrual for that month.\nYou will see an 'LOP' deduction line in your payslip for the affected month.",
      },
      {
        q: "What happens to my leave balance if my application is rejected?",
        a: "Rejected leave applications do not consume your leave balance — the days are automatically credited back the moment the manager rejects the request. If the rejection seems incorrect, you can:\n1. Resubmit with an updated reason.\n2. Discuss directly with your manager.\n3. Escalate to HR via a Leave Problem query if the situation is urgent.",
      },
    ],
  },
  {
    id: "payroll",
    icon: "💰",
    label: "Payslips",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    questions: [
      {
        q: "How is my net salary calculated? What are the components?",
        a: "Net Salary = Gross Salary − Deductions.\n\nTypical Gross components:\n• Basic Salary — usually 40–50% of CTC.\n• HRA (House Rent Allowance) — typically 50% of Basic (metro) or 40% (non-metro).\n• Special Allowance — variable, fills up the remainder of CTC.\n• Performance Bonus — based on appraisal cycle.\n\nCommon Deductions:\n• EPF Employee Contribution — 12% of Basic (capped at ₹1,800/month).\n• Professional Tax — state-specific slab (usually ₹200/month).\n• TDS — based on your tax declaration submitted at year start.\n• LOP — proportional to unapproved absent days.",
      },
      {
        q: "Why did my TDS amount suddenly increase this month?",
        a: "TDS is recalculated quarterly based on projected annual income. An increase usually means:\n• You declared investments (80C, 80D) at year-start but haven't submitted proofs yet — unverified deductions are removed, raising taxable income.\n• A bonus or arrear was paid, inflating projected annual income.\n• You crossed a tax slab threshold mid-year.\nSubmit your investment proofs via the Payslips → Tax Declaration section before the company's deadline (usually January–February).",
      },
      {
        q: "How do I submit rent receipts for HRA exemption?",
        a: "Go to Payslips → HRA Declaration. Upload:\n• Monthly rent receipts (landlord name, address, amount, signature).\n• Rental agreement copy.\n• If annual rent > ₹1 lakh, the landlord's PAN is mandatory.\nDeadline is usually February 15th. HRA exemption applies from the month of submission — prior months are not revised within the same year.",
      },
      {
        q: "What is the Form 16 and when will I receive it?",
        a: "Form 16 is a TDS certificate issued by your employer summarising:\n• Part A — TDS deducted and deposited with the government (TRACES-generated).\n• Part B — Salary breakup and deductions declared.\nIt is issued by June 15th for the previous financial year (April–March). You need it to file your Income Tax Return. Download it from Payslips → Form 16 when available.",
      },
    ],
  },
  {
    id: "projects",
    icon: "📁",
    label: "Projects",
    color: "#ec4899",
    bg: "#fdf2f8",
    questions: [
      {
        q: "How do project timelines and milestones affect my performance review?",
        a: "Project milestones are tracked and linked to your quarterly KPIs. Missed milestones without documented reasons can lower your performance score. Best practices:\n• Log daily work updates even for partial progress — it shows effort.\n• Flag blockers early via the project's 'Raise Blocker' option so delays are attributed to external factors.\n• Completed milestones ahead of schedule are flagged positively and visible to your reporting manager during appraisals.",
      },
      {
        q: "Can I be assigned to multiple projects simultaneously?",
        a: "Yes, multi-project assignment is supported. When assigned to multiple projects:\n• Work updates must specify which project the hours apply to.\n• Your daily capacity is split across projects — coordinate with PMs to avoid over-allocation.\n• If total assigned hours exceed 8 hrs/day, the system flags an 'Over-allocated' warning visible to all your project managers.",
      },
      {
        q: "How do I raise a blocker or escalate a project issue?",
        a: "Inside the project detail view, click 'Raise Blocker'. Provide:\n• Blocker type (Technical / Resource / Dependency / External).\n• Impact: which milestone is affected and by how many days.\n• Who needs to resolve it.\nThe assigned PM and your reporting manager are notified immediately. Unresolved blockers open for > 48 hours auto-escalate to the department head.",
      },
    ],
  },
  {
    id: "profile",
    icon: "👤",
    label: "Profile",
    color: "#64748b",
    bg: "#f8fafc",
    questions: [
      {
        q: "Which profile fields can I edit myself vs requiring HR approval?",
        a: "Self-editable:\n• Profile photo, phone number, personal email, emergency contact, current address, bank account details (with OTP verification).\n\nHR approval required:\n• Legal name, date of birth, gender, employee ID, designation, department, PAN/Aadhaar number.\n\nTo update HR-controlled fields, raise an HR Request query and attach a government-issued document as proof. Changes are applied within 3 business days.",
      },
      {
        q: "How do I update my bank account details for salary credit?",
        a: "Go to Profile → Bank Details. Click 'Update Bank Account' and enter:\n• Account number (confirm twice).\n• IFSC code — branch details auto-populate.\n• Account holder name (must match your payroll name exactly).\nAn OTP is sent to your registered mobile to authorise the change. The update takes effect from the next payroll cycle. The previous account details are retained for 6 months as audit history.",
      },
    ],
  },
  {
    id: "technical",
    icon: "🔧",
    label: "Technical",
    color: "#ef4444",
    bg: "#fef2f2",
    questions: [
      {
        q: "The app loads but all data shows blank — what's wrong?",
        a: "This is usually a Firestore permissions or token expiry issue. Try:\n1. Log out completely and log back in — this refreshes your auth token.\n2. Check browser console (F12 → Console) for 'permission-denied' errors — note them for the Tech Bug query.\n3. Disable browser extensions (especially ad blockers or privacy extensions that block WebSocket connections).\n4. Try an incognito window — if it works, a cached bad token is the culprit (clear cache: Ctrl+Shift+Delete).\n5. If none work, raise a Technical Bug query with your browser version and console error text.",
      },
      {
        q: "I get a 'Session Expired' message minutes after logging in — how do I fix this?",
        a: "Frequent session expiry is caused by:\n• Clock skew — if your device clock is off by >5 minutes, JWT tokens appear expired immediately. Sync your system clock: Settings → Date & Time → Sync Now.\n• Multiple tabs — logging in from two tabs simultaneously can invalidate the other session.\n• Corporate firewall blocking token refresh requests — try on mobile data to confirm.\nIf the issue persists after clock sync, raise a Technical Bug query with your device OS, browser, and network type (office WiFi / VPN / mobile data).",
      },
      {
        q: "Notifications aren't appearing even though I have alerts enabled — why?",
        a: "Notification delivery depends on three layers:\n1. Browser permission — go to Site Settings → Notifications → Allow for this site.\n2. App-level setting — check Profile → Notification Preferences; ensure all relevant categories are toggled on.\n3. OS-level — on Windows: Settings → Notifications → Your Browser → On. On Mac: System Settings → Notifications → Your Browser → Allow.\nIf all three are enabled and notifications still don't arrive, raise a Technical Bug query. Include whether you are on desktop or mobile, and the OS version.",
      },
    ],
  },
];

const QUERY_CATEGORIES = [
  "Attendance Issue",
  "Payroll Query",
  "Leave Problem",
  "Technical Bug",
  "HR Request",
  "Other",
];

/* ─────────────────────────────────────────────
   ExpandableText
───────────────────────────────────────────── */
function ExpandableText({
  text,
  previewLength = PREVIEW_LENGTH,
}: {
  text: string;
  previewLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > previewLength;
  return (
    <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
      {isLong && !expanded ? text.slice(0, previewLength) + "…" : text}
      {isLong && (
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#1a2e4a", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          {expanded ? "See Less" : "See More"}
        </button>
      )}
    </p>
  );
}

/* ─────────────────────────────────────────────
   FAQ TAB
───────────────────────────────────────────── */
function FaqTab({ onRaiseQuery }: { onRaiseQuery: (subject: string) => void }) {
  const [activeTopic, setActiveTopic] = useState<string>(FAQ_TOPICS[0].id);
  const [openQ, setOpenQ] = useState<number | null>(null);

  const topic = FAQ_TOPICS.find((t) => t.id === activeTopic)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Topic chips */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "14px 18px",
        border: "1px solid #e8ecf2",
        display: "flex", flexWrap: "wrap", gap: 7,
      }}>
        {FAQ_TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTopic(t.id); setOpenQ(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 22,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1.5px solid",
              borderColor: activeTopic === t.id ? t.color : "#e2e8f0",
              background: activeTopic === t.id ? t.bg : "#f8fafc",
              color: activeTopic === t.id ? t.color : "#64748b",
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Q&A accordion */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf2", overflow: "hidden" }}>

        {/* Topic header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", gap: 10,
          background: topic.bg,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: topic.color + "22",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
          }}>
            {topic.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{topic.label}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{topic.questions.length} questions</div>
          </div>
        </div>

        {/* Questions */}
        {topic.questions.map((item, i) => {
          const isOpen = openQ === i;
          return (
            <div key={i} style={{ borderBottom: i < topic.questions.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <button
                onClick={() => setOpenQ(isOpen ? null : i)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "13px 18px",
                  background: isOpen ? "#f8fafc" : "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: isOpen ? topic.color : "#f1f5f9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    color: isOpen ? "#fff" : "#94a3b8",
                    transition: "all 0.15s",
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? "#0f172a" : "#334155" }}>
                    {item.q}
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: isOpen ? topic.color : "#cbd5e1",
                  fontWeight: 700, flexShrink: 0,
                  display: "inline-block",
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}>▼</span>
              </button>

              {isOpen && (
                <div style={{
                  padding: "0 18px 14px 50px",
                  background: "#f8fafc",
                  borderTop: `2px solid ${topic.color}22`,
                }}>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, whiteSpace: "pre-wrap", margin: 0 }}>
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── COMPACT "Still need help?" banner ── */}
      <div style={{
        background: "#1a2e4a",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>💬</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
              Still need help?
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginLeft: 8 }}>
              Our team responds within 1 business day.
            </span>
          </div>
        </div>
        <button
          onClick={() => onRaiseQuery(topic.label + " Issue")}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: "none",
            background: "#fff",
            color: "#1a2e4a",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap" as const,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
        >
          🚀 Raise a Query
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function HelpView() {
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [queries, setQueries] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"faq" | "new" | "history">("faq");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "employeeQueries"),
      where("employeeId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setQueries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!subject.trim() || !message.trim()) { setMsg("Please fill all fields."); return; }
    try {
      setSubmitting(true);
      setMsg("");
      await addDoc(collection(db, "employeeQueries"), {
        subject,
        message,
        employeeId: user.uid,
        employeeName: user.email?.split("@")[0] || "Employee",
        status: "pending",
        adminReply: "",
        repliedAt: null,
        employeeUnread: false,
        adminUnread: true,
        createdAt: serverTimestamp(),
      });
      setSubject("");
      setMessage("");
      setMsg("✅ Query submitted successfully!");
      setTimeout(() => { setMsg(""); setTab("history"); }, 1600);
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div style={{ padding: 24, color: "#94a3b8" }}>Loading user...</div>;

  const pending = queries.filter((q) => q.status === "pending").length;
  const resolved = queries.filter((q) => q.status === "resolved").length;
  const canSubmit = subject.trim() && message.trim();

  const TABS: { key: "faq" | "new" | "history"; label: string }[] = [
    { key: "faq",     label: "💡 Help Topics" },
    { key: "new",     label: "✏️ New Query" },
    { key: "history", label: "📋 My Queries" },
  ];

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, fontFamily: "'Segoe UI', sans-serif", background: "#f0f4f9", minHeight: "100vh" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "#1a2e4a", borderRadius: 16, padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 68, flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>❓</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>Help &amp; Support</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>Browse topics or raise a query</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Pending",  val: pending,  dot: "#f59e0b" },
            { label: "Resolved", val: resolved, dot: "#22c55e" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{s.val}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{s.label}</span>
            </div>
          ))}

          <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 3 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#1a2e4a" : "rgba(255,255,255,0.4)",
                transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════ FAQ ════ */}
      {tab === "faq" && (
        <FaqTab
          onRaiseQuery={(prefillSubject) => {
            setSubject(prefillSubject);
            setTab("new");
          }}
        />
      )}

      {/* ════ NEW QUERY ════ */}
      {tab === "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 14, alignItems: "start" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>Subject</div>
              <div style={{ position: "relative" }}>
                <input
                  value={subject}
                  onChange={(e) => { if (e.target.value.length <= SUBJECT_LIMIT) setSubject(e.target.value); }}
                  placeholder="Brief title of your issue…"
                  style={{ ...inputStyle, paddingRight: 56, borderColor: subject.length >= SUBJECT_LIMIT ? "#fca5a5" : "#e2e8f0" }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: subject.length >= SUBJECT_LIMIT ? "#ef4444" : "#cbd5e1", pointerEvents: "none" }}>
                  {subject.length}/{SUBJECT_LIMIT}
                </span>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Quick Category</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {QUERY_CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setSubject(cat)} style={{
                    padding: "7px 15px", borderRadius: 22, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: "1.5px solid",
                    borderColor: subject === cat ? "#1a2e4a" : "#e2e8f0",
                    background: subject === cat ? "#1a2e4a" : "#f8fafc",
                    color: subject === cat ? "#fff" : "#64748b",
                    transition: "all 0.15s",
                  }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={cardStyle}>
              <div style={labelStyle}>Describe Your Issue</div>
              <div style={{ position: "relative" }}>
                <textarea
                  value={message}
                  onChange={(e) => { if (e.target.value.length <= MESSAGE_LIMIT) setMessage(e.target.value); }}
                  placeholder="What happened, when it happened, and what you expected…"
                  style={{ ...inputStyle, minHeight: 180, resize: "none", lineHeight: 1.65, paddingBottom: 28, borderColor: message.length >= MESSAGE_LIMIT ? "#fca5a5" : "#e2e8f0" } as React.CSSProperties}
                />
                <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, color: message.length >= MESSAGE_LIMIT ? "#ef4444" : "#cbd5e1" }}>
                  {message.length}/{MESSAGE_LIMIT}
                </span>
              </div>
            </div>

            <div style={cardStyle}>
              {msg && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, textAlign: "center", background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", border: `1px solid ${msg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`, color: msg.startsWith("✅") ? "#166634" : "#dc2626" }}>
                  {msg}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                Typically responded within 1 business day
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                style={{
                  width: "100%", padding: 13, borderRadius: 11, border: "none",
                  fontSize: 14, fontWeight: 700, letterSpacing: "0.2px",
                  cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
                  transition: "all 0.18s",
                  background: !canSubmit ? "#e2e8f0" : "linear-gradient(135deg,#1a2e4a,#2a5298)",
                  color: !canSubmit ? "#94a3b8" : "#fff",
                  boxShadow: !canSubmit ? "none" : "0 4px 16px rgba(26,46,74,0.25)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "⏳ Submitting…" : "🚀 Submit Query"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ HISTORY ════ */}
      {tab === "history" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 13 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
              Loading your queries…
            </div>
          ) : queries.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf2", padding: "64px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>No queries yet</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>Submit your first query using the New Query tab.</div>
              <button onClick={() => setTab("new")} style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1a2e4a,#2a5298)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(26,46,74,0.25)" }}>
                ✏️ Raise a Query
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {queries.map((q) => {
                const isResolved = q.status === "resolved";
                const hasReply = !!q.adminReply;
                const exp = expandedId === q.id;
                const ts = q.createdAt?.toDate?.()?.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <div key={q.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8ecf2", borderLeft: `4px solid ${isResolved ? "#22c55e" : "#f59e0b"}`, overflow: "hidden", transition: "box-shadow 0.15s", boxShadow: exp ? "0 4px 16px rgba(0,0,0,0.07)" : "none" }}>
                    <div onClick={() => setExpandedId(exp ? null : q.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isResolved ? "#dcfce7" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                          {isResolved ? "✅" : "⏳"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.subject}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, display: "flex", gap: 8 }}>
                            {ts && <span>📅 {ts}</span>}
                            {hasReply && <span style={{ color: "#16a34a", fontWeight: 600 }}>💬 Admin replied</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: isResolved ? "#dcfce7" : "#fef9c3", color: isResolved ? "#166534" : "#92400e", border: `1px solid ${isResolved ? "#bbf7d0" : "#fcd34d"}`, letterSpacing: "0.3px", textTransform: "capitalize" as const }}>
                          {isResolved ? "Resolved" : "Pending"}
                        </span>
                        <span style={{ fontSize: 10, color: "#cbd5e1" }}>{exp ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {exp && (
                      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
                        <div style={{ height: 1, background: "#f1f5f9" }} />
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={secLabelStyle}>📝 Your Message</div>
                          <ExpandableText text={q.message} />
                        </div>
                        {hasReply ? (
                          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>A</div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>Admin Reply</div>
                                {q.repliedAt && <div style={{ fontSize: 9, color: "#86efac" }}>{q.repliedAt?.toDate?.()?.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>}
                              </div>
                            </div>
                            <ExpandableText text={q.adminReply} />
                          </div>
                        ) : (
                          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 15 }}>⏳</span>
                            <span style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}>Awaiting admin response…</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Style tokens ─────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid #e8ecf2",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10,
};
const secLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: "1.5px solid #e2e8f0", borderRadius: 10,
  padding: "11px 14px", fontSize: 13, color: "#1e293b",
  background: "#f8fafc", fontFamily: "inherit",
  outline: "none", transition: "border-color 0.15s",
};