import React from "react";

export const T = {
  bg:        "#f0f2f8",
  surface:   "#ffffff",
  surfaceHi: "#f4f6fb",
  border:    "#e2e8f0",
  borderHi:  "#c9d3e0",
  ink:       "#0f172a",
  inkMid:    "#475569",
  inkDim:    "#94a3b8",
  green:     "#059669",
  greenBg:   "#ecfdf5",
  blue:      "#2563eb",
  blueBg:    "#eff6ff",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  amber:     "#d97706",
  amberBg:   "#fffbeb",
  violet:    "#7c3aed",
  violetBg:  "#f5f3ff",
  teal:      "#0891b2",
  tealBg:    "#ecfeff",
  pink:      "#db2777",
  pinkBg:    "#fdf2f8",
};

export const PALETTE = [T.blue, T.green, T.violet, T.amber, T.red, T.teal, T.pink, "#ffa657"];
export const EXPENSE_QUICK = ["Rent", "WiFi", "Electricity", "Water", "Furniture", "Transport", "Software Subscription", "Other"];

export function fmt(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
}
export function fmtShort(v: number) {
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

export function KPICard({ icon, label, value, sub, accent = T.blue }: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: "18px 20px", position: "relative", overflow: "hidden",
      transition: "border-color 0.2s, transform 0.15s, box-shadow 0.15s", cursor: "default",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = accent;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 24px ${accent}22`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = T.border;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at 100% 0%, ${accent}28 0%, transparent 70%)` }} />
      <div style={{ fontSize: 20, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: "-0.5px", marginBottom: 3, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function TabBtn({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px", borderRadius: 0, border: "none",
      background: "transparent",
      color: active ? T.blue : T.inkMid,
      fontSize: 13, fontWeight: 700, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      borderBottom: active ? `2px solid ${T.blue}` : "2px solid transparent",
      transition: "all 0.15s",
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 900, padding: "2px 7px", borderRadius: 99,
          background: active ? T.blueBg : T.surfaceHi,
          color: active ? T.blue : T.inkMid,
        }}>{count}</span>
      )}
    </button>
  );
}

export function Input({ label, value, onChange, type = "text", placeholder = "", min, max, required }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string; min?: string; max?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min} max={max} required={required}
        style={{
          background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9,
          padding: "9px 13px", color: T.ink, fontSize: 13, width: "100%",
          transition: "border-color 0.15s", outline: "none",
        }}
        onFocus={e => (e.target.style.borderColor = T.blue)}
        onBlur={e => (e.target.style.borderColor = T.border)}
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10, color: T.inkMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: T.surfaceHi, border: `1px solid ${T.border}`, borderRadius: 9,
        padding: "9px 13px", color: T.ink, fontSize: 13, width: "100%", cursor: "pointer", outline: "none",
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function AddBtn({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 22px", background: T.blue, color: "#fff", border: "none",
      borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      transition: "opacity 0.15s", width: "100%",
      opacity: disabled ? 0.5 : 1
    }}
      onMouseEnter={e => { if(!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
      onMouseLeave={e => { if(!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >{label}</button>
  );
}

export function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 9px", background: T.redBg, color: T.red, border: `1px solid ${T.red}44`,
      borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}>✕</button>
  );
}

export function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: T.inkMid, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: T.inkMid, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}44`, transition: "background 0.1s" }}
              onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = T.surfaceHi)}
              onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "10px 12px", color: T.ink, verticalAlign: "middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} style={{ padding: "32px", textAlign: "center", color: T.inkDim, fontSize: 13 }}>No records yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ color: T.inkMid, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 800 }}>{p.name}: {fmtShort(p.value)}</div>
      ))}
    </div>
  );
}

export function DeptBadge({ dept }: { dept: string }) {
  const colors: Record<string, [string, string]> = {
    Engineering: [T.blue, T.blueBg],
    Sales: [T.green, T.greenBg],
    HR: [T.pink, T.pinkBg],
    Operations: [T.amber, T.amberBg],
    Finance: [T.violet, T.violetBg],
    Marketing: [T.teal, T.tealBg],
    IT: [T.ink, T.surfaceHi],
  };
  const [color, bg] = colors[dept] ?? [T.inkMid, T.surfaceHi];
  return (
    <span style={{ padding: "3px 9px", borderRadius: 99, background: bg, color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{dept}</span>
  );
}

export function SalaryTag({ v, color = T.green }: { v: number; color?: string }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color }}>{fmt(v)}</span>
  );
}
