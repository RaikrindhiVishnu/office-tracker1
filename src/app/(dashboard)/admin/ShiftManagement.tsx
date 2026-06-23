"use client";
import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp, getDocs, where, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { triggerEmailNotification, triggerPushNotification } from "@/lib/notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShiftType = "Morning" | "Evening" | "Night" | "General" | "Flexible";

interface Shift {
  id: string;
  name: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  workingDays: string[];
  color: string;
  active: boolean;
  createdAt?: Timestamp | null;
}

interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  effectiveFrom: string;
  effectiveTo?: string;
  assignedAt?: Timestamp | null;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];
const SHIFT_EMOJI: Record<string, string> = { Morning: "🌅", Evening: "🌆", Night: "🌙", General: "🕐", Flexible: "⚡" };

export default function ShiftManagement() {
  const [tab, setTab] = useState<"shifts" | "assignments">("shifts");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  // Shift form
  const [shiftName, setShiftName] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("General");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMins, setBreakMins] = useState(60);
  const [workingDays, setWorkingDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [shiftColor, setShiftColor] = useState(SHIFT_COLORS[0]);
  const [savingShift, setSavingShift] = useState(false);

  // Assignment form
  const [selEmployee, setSelEmployee] = useState("");
  const [selShift, setSelShift] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const unsubShifts = onSnapshot(query(collection(db, "shifts"), orderBy("createdAt", "desc")), snap => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
      setLoading(false);
    });
    const unsubAssign = onSnapshot(query(collection(db, "shiftAssignments"), orderBy("assignedAt", "desc")), snap => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ShiftAssignment)));
    });
    getDocs(query(collection(db, "users"), where("accountType", "==", "EMPLOYEE"))).then(snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubShifts(); unsubAssign(); };
  }, []);

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;
    setSavingShift(true);
    try {
      await addDoc(collection(db, "shifts"), {
        name: shiftName.trim(), type: shiftType,
        startTime, endTime, breakDurationMinutes: breakMins,
        workingDays, color: shiftColor, active: true,
        createdAt: serverTimestamp(),
      });
      setShowAddShift(false);
      setShiftName(""); setShiftType("General"); setStartTime("09:00"); setEndTime("18:00");
      setBreakMins(60); setWorkingDays(["Mon", "Tue", "Wed", "Thu", "Fri"]); setShiftColor(SHIFT_COLORS[0]);
    } finally {
      setSavingShift(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selEmployee || !selShift || !effectiveFrom) return;
    setAssigning(true);
    const emp = users.find(u => u.id === selEmployee);
    const shift = shifts.find(s => s.id === selShift);
    try {
      await addDoc(collection(db, "shiftAssignments"), {
        employeeId: selEmployee,
        employeeName: emp?.name || emp?.email?.split("@")[0] || "Unknown",
        shiftId: selShift,
        shiftName: shift?.name || "",
        effectiveFrom, effectiveTo: effectiveTo || null,
        assignedAt: serverTimestamp(),
      });
      // Update user doc with current shift
      await setDoc(doc(db, "users", selEmployee), { currentShiftId: selShift, currentShiftName: shift?.name }, { merge: true });
      setShowAssign(false);
      setSelEmployee(""); setSelShift(""); setEffectiveFrom(""); setEffectiveTo("");
    } finally {
      setAssigning(false);
    }
  };

  const toggleDay = (day: string) => {
    setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const calcWorkHours = (start: string, end: string, breakM: number) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const totalMins = (eh * 60 + em) - (sh * 60 + sm) - breakM;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m > 0 ? m + "m" : ""}`.trim();
  };

  return (
    <div style={{ padding: 24, fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f8fafc", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Shift Management</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Create shifts and assign employees to work schedules</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowAssign(true)}
            style={{ padding: "10px 18px", background: "#fff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            👤 Assign Employee
          </button>
          <button onClick={() => setShowAddShift(true)}
            style={{ padding: "10px 18px", background: "linear-gradient(135deg,#2563eb,#4f46e5)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + New Shift
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 20, gap: 4 }}>
        {(["shifts", "assignments"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 20px", border: "none", background: "transparent",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent",
            color: tab === t ? "#2563eb" : "#64748b", marginBottom: -2,
          }}>
            {t === "shifts" ? `🕐 Shifts (${shifts.length})` : `👥 Assignments (${assignments.length})`}
          </button>
        ))}
      </div>

      {tab === "shifts" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {shifts.map(shift => (
            <div key={shift.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ background: shift.color, padding: "16px 20px" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{SHIFT_EMOJI[shift.type]}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{shift.name}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{shift.type} Shift</div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Timing</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{shift.startTime} – {shift.endTime}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Work Hours</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#2563eb", marginTop: 2 }}>{calcWorkHours(shift.startTime, shift.endTime, shift.breakDurationMinutes)}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Working Days</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {DAYS.map(d => (
                      <span key={d} style={{
                        padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: shift.workingDays.includes(d) ? shift.color + "20" : "#f1f5f9",
                        color: shift.workingDays.includes(d) ? shift.color : "#94a3b8",
                      }}>{d}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Break: {shift.breakDurationMinutes} min · {assignments.filter(a => a.shiftId === shift.id).length} employee{assignments.filter(a => a.shiftId === shift.id).length !== 1 ? "s" : ""} assigned</div>
              </div>
            </div>
          ))}
          {shifts.length === 0 && !loading && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "#94a3b8" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🕐</div>
              <div style={{ fontWeight: 600 }}>No shifts created yet</div>
              <button onClick={() => setShowAddShift(true)} style={{ marginTop: 12, padding: "8px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Create First Shift</button>
            </div>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
                {["Employee", "Shift", "Effective From", "Effective To"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", fontWeight: 600, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const shift = shifts.find(s => s.id === a.shiftId);
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 500 }}>{a.employeeName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: (shift?.color || "#64748b") + "20", color: shift?.color || "#64748b", padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                        {SHIFT_EMOJI[shift?.type || "General"]} {a.shiftName}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{a.effectiveFrom}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{a.effectiveTo || "Ongoing"}</td>
                  </tr>
                );
              })}
              {assignments.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No shift assignments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddShift && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Create New Shift</h3>
              <button onClick={() => setShowAddShift(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>
            <form onSubmit={handleAddShift} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Shift Name *</label>
                <input value={shiftName} onChange={e => setShiftName(e.target.value)} placeholder="e.g., Morning Shift A" required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Shift Type</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["Morning", "Evening", "Night", "General", "Flexible"] as ShiftType[]).map(t => (
                    <button key={t} type="button" onClick={() => setShiftType(t)} style={{
                      padding: "7px 14px", borderRadius: 8, border: "2px solid",
                      borderColor: shiftType === t ? "#2563eb" : "#e2e8f0",
                      background: shiftType === t ? "#eff6ff" : "#fff",
                      color: shiftType === t ? "#2563eb" : "#374151",
                      fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>{SHIFT_EMOJI[t]} {t}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Start Time</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>End Time</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Break (min)</label>
                  <input type="number" value={breakMins} onChange={e => setBreakMins(Number(e.target.value))} min={0} max={180}
                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
              </div>
              {startTime && endTime && (
                <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1d4ed8", fontWeight: 500 }}>
                  ⏱ Net Work Hours: <strong>{calcWorkHours(startTime, endTime, breakMins)}</strong>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Working Days</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {DAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)} style={{
                      padding: "6px 10px", borderRadius: 8, border: "2px solid",
                      borderColor: workingDays.includes(d) ? "#2563eb" : "#e2e8f0",
                      background: workingDays.includes(d) ? "#eff6ff" : "#fff",
                      color: workingDays.includes(d) ? "#2563eb" : "#94a3b8",
                      fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>Color</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {SHIFT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setShiftColor(c)} style={{
                      width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${shiftColor === c ? "#1e293b" : "transparent"}`, cursor: "pointer",
                    }} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAddShift(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={savingShift} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#2563eb,#4f46e5)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: savingShift ? 0.7 : 1 }}>
                  {savingShift ? "Creating..." : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Assign Employee to Shift</h3>
              <button onClick={() => setShowAssign(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>
            <form onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Employee *</label>
                <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)} required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                  <option value="">Select employee...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Shift *</label>
                <select value={selShift} onChange={e => setSelShift(e.target.value)} required
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
                  <option value="">Select shift...</option>
                  {shifts.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{SHIFT_EMOJI[s.type]} {s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Effective From *</label>
                  <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} required
                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Effective To</label>
                  <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} min={effectiveFrom}
                    style={{ width: "100%", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowAssign(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={assigning} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: assigning ? 0.7 : 1 }}>
                  {assigning ? "Assigning..." : "Assign Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
