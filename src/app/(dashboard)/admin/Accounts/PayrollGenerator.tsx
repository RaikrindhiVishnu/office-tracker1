"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import SalaryStructure from "./SalaryStructure";
import PayslipHistory  from "./PayslipHistory";

type Employee = {
  uid: string; name: string; email: string; generated?: boolean;
};

type View = "payroll" | "salary" | "history";

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export default function PayrollGenerator() {
  const today = new Date();

  const [currentView, setCurrentView]       = useState<View>("payroll");
  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [selectedYear, setSelectedYear]     = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth]   = useState(today.getMonth() + 1);
  const [selectedEmp, setSelectedEmp]       = useState<string>("all");
  const [search, setSearch]                 = useState("");
  const [generatingUid, setGeneratingUid]   = useState<string | null>(null);
  const [downloadingUid, setDownloadingUid] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress]     = useState<{ done: number; total: number } | null>(null);
  const [loadingAll, setLoadingAll]         = useState(false);

  const monthKey    = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const yearOptions = [today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2];

  useEffect(() => { loadEmployees(); }, [monthKey]);

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list: Employee[] = [];
    for (const docSnap of snap.docs) {
      const uid  = docSnap.id;
      const data = docSnap.data();
      if (data.accountType !== "EMPLOYEE") continue;
      const payslipSnap = await getDoc(doc(db, "payslips", `${uid}_${monthKey}`));
      list.push({ uid, name: data.name, email: data.email, generated: payslipSnap.exists() });
    }
    setEmployees(list);
  };

  const filteredEmployees = employees.filter((e) => {
    const matchEmp    = selectedEmp === "all" || e.uid === selectedEmp;
    const q           = search.toLowerCase();
    const matchSearch = !q || e.name?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
    return matchEmp && matchSearch;
  });

  const pendingCount = filteredEmployees.filter((e) => !e.generated).length;

  /* ── generatePayslip ─────────────────────────────────────────────────────*/
  const generatePayslip = async (uid: string, silent = false): Promise<boolean> => {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) { if (!silent) alert("Employee not found."); return false; }
      const u = userSnap.data();

      const salarySnap = await getDoc(doc(db, "salaryStructures", uid));
      if (!salarySnap.exists()) {
        if (!silent) alert(`No salary structure found for ${u.name}. Please set it up first.`);
        return false;
      }
      const s = salarySnap.data();

      const basic            = Number(s.basic            ?? s.Basic            ?? 0);
      const hra              = Number(s.hra              ?? s.HRA              ?? 0);
      const specialAllowance = Number(s.specialAllowance ?? s.SpecialAllowance ?? 0);
      const pf               = Number(s.pf               ?? s.PF               ?? 0);
      const pt               = Number(s.pt               ?? s.PT               ?? 0);
      const tds              = Number(s.tds              ?? s.TDS              ?? 0);
      const totalEarnings    = basic + hra + specialAllowance;
      const totalDeductions  = pf + pt + tds;
      const netSalary        = totalEarnings - totalDeductions;
      const totalDays        = daysInMonth(selectedMonth, selectedYear);

      await setDoc(doc(db, "payslips", `${uid}_${monthKey}`), {
        uid,
        name:           u.name          || "",
        email:          u.email         || "",
        designation:    u.designation   || "N/A",
        empId:          u.empId         || u.employeeId || "N/A",
        dateOfJoining:  u.dateOfJoining || u.joiningDate || "N/A",
        bankAccount:    s.bankAccount   ?? s.BankAccount ?? "N/A",
        pan:            s.pan           ?? s.Pan         ?? "N/A",
        month:          selectedMonth,
        year:           selectedYear,
        monthKey,
        totalDays,
        lop:            0,
        paidDays:       totalDays,
        basic, hra, specialAllowance,
        totalEarnings,
        pf, pt, tds,
        totalDeductions,
        netSalary,
        generatedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error("generatePayslip error:", err);
      if (!silent) alert("Failed to generate payslip. Check console for details.");
      return false;
    }
  };

  /* ── buildAndDownloadPdf — exact TechGy payslip design ──────────────────*/
  const buildAndDownloadPdf = async (uid: string, key: string) => {
    try {
      const snap = await getDoc(doc(db, "payslips", `${uid}_${key}`));
      if (!snap.exists()) { alert("Payslip not found. Please generate it first."); return; }
      const p = snap.data();

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW  = 210;
      const margin = 14;

      // ── Load logo from /public/logo (2).png ──────────────────────────────
      let logoDataUrl: string | null = null;
      try {
        const res  = await fetch("/logo (2).png");
        const blob = await res.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch { /* continue without logo */ }

      const fmt = (n: number | undefined) =>
        Number(n || 0).toLocaleString("en-IN");

      let y = margin;

      // ── Logo + Company header ─────────────────────────────────────────────
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", margin, y, 26, 20);
      }

      const cx = margin + 30; // text starts after logo
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(20, 20, 20);
      pdf.text("TECHGY INNOVATIONS", cx, y + 5);
      pdf.text("PRIVATE LIMITED",    cx, y + 11);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(70, 70, 70);
      [
        "Shop No. 09, Sri Venkateswara Swamy Residency, Land Mark -",
        "Rajahmundry Ruchulu, 13th Phase Rd, Kukatpally Housing Board",
        "Colony, Hyderabad, Telangana 500085",
        "CIN: U93090TG2019PTC13277",
      ].forEach((line, i) => pdf.text(line, cx, y + 17 + i * 3.8));

      y += 36;

      // ── Divider ───────────────────────────────────────────────────────────
      pdf.setDrawColor(160, 160, 160);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageW - margin, y);
      y += 7;

      // ── "Payslip For" title ───────────────────────────────────────────────
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text(
        `Payslip For: ${monthNames[p.month - 1]}, ${p.year}`,
        pageW / 2, y, { align: "center" }
      );
      y += 9;

      // ── Employee info (2-column label/value) ──────────────────────────────
      const L  = margin;
      const R  = pageW / 2 + 4;
      const LV = L  + 35; // left  value x
      const RV = R  + 35; // right value x

      const infoLine = (
        lb1: string, v1: string,
        lb2: string, v2: string
      ) => {
        pdf.setFont("helvetica", "bold");   pdf.setFontSize(8.5); pdf.setTextColor(20,20,20);
        pdf.text(lb1, L, y);
        pdf.setFont("helvetica", "normal"); pdf.text(v1, LV, y);
        pdf.setFont("helvetica", "bold");   pdf.text(lb2, R, y);
        pdf.setFont("helvetica", "normal"); pdf.text(v2, RV, y);
        y += 6;
      };

      infoLine("Employee Name:", p.name           || "N/A", "Total Days In Month:", String(p.totalDays || 30));
      infoLine("Emp ID:",        p.empId           || "N/A", "LOP",                  String(p.lop       || 0));
      infoLine("Designation:",   p.designation     || "N/A", "Actual Paid Days",     String(p.paidDays  || 30));
      infoLine("Date of Joining:",p.dateOfJoining  || "N/A", "Bank Account No.",     p.bankAccount      || "N/A");

      y += 2;

      // ── Earnings / Deductions table ───────────────────────────────────────
      const tL   = margin;
      const tR   = pageW - margin;
      const tW   = tR - tL;
      const half = tW / 2;
      const midX = tL + half;
      // Sub-column split (label | amount) within each half
      const splitRatio = 0.62;
      const LS = tL   + half * splitRatio; // left  amount col x
      const RS = midX + half * splitRatio; // right amount col x
      const rH = 7;   // row height

      // Draw a rect border + inner lines for a given row
      const drawRowBorders = (rowY: number, filled: boolean) => {
        if (filled) {
          pdf.setFillColor(242, 242, 242);
          pdf.rect(tL, rowY, tW, rH, "F");
        }
        pdf.setDrawColor(190, 190, 190);
        pdf.setLineWidth(0.25);
        pdf.rect(tL, rowY, tW, rH, "S");
        pdf.line(midX, rowY, midX, rowY + rH);
        pdf.line(LS,   rowY, LS,   rowY + rH);
        pdf.line(RS,   rowY, RS,   rowY + rH);
      };

      // Header row
      drawRowBorders(y, true);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Earnings",  tL   + 3, y + 5);
      pdf.text("Amount",    LS   + 3, y + 5);
      pdf.text("Deduction", midX + 3, y + 5);
      pdf.text("Amount",    RS   + 3, y + 5);
      y += rH;

      // Data rows
      const earningRows  = [
        ["Basic Salary",       fmt(p.basic)],
        ["HRA",                fmt(p.hra)],
        ["Special Allowances", fmt(p.specialAllowance)],
      ];
      const deductionRows = [
        ["TDS",   fmt(p.tds)],
        ["PT",    fmt(p.pt)],
        ["Other", ""],
      ];

      earningRows.forEach((er, i) => {
        const dr = deductionRows[i] || ["", ""];
        drawRowBorders(y, false);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(20, 20, 20);
        pdf.text(er[0],  tL   + 3, y + 5);
        pdf.text(er[1],  LS   + 3, y + 5);
        pdf.text(dr[0],  midX + 3, y + 5);
        if (dr[1]) pdf.text(dr[1], RS + 3, y + 5);
        y += rH;
      });

      // Totals row (bold, shaded)
      pdf.setFillColor(225, 225, 225);
      pdf.rect(tL, y, tW, rH, "F");
      pdf.setDrawColor(170, 170, 170);
      pdf.rect(tL, y, tW, rH, "S");
      pdf.line(midX, y, midX, y + rH);
      pdf.line(LS,   y, LS,   y + rH);
      pdf.line(RS,   y, RS,   y + rH);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Total Earnings",    tL   + 3, y + 5);
      pdf.text(fmt(p.totalEarnings),LS   + 3, y + 5);
      pdf.text("Total Deductions",  midX + 3, y + 5);
      pdf.text(fmt(p.totalDeductions), RS + 3, y + 5);
      y += rH + 8;

      // ── Net Salary ────────────────────────────────────────────────────────
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(20, 20, 20);
      const netLabel = "Net Salary";
      const netValue = fmt(p.netSalary);
      // Centre both together
      const centre = pageW / 2;
      pdf.text(netLabel, centre - 18, y);
      pdf.text(netValue, centre + 18, y);
      y += 18;

      // ── Footer ────────────────────────────────────────────────────────────
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8);
      pdf.setTextColor(110, 110, 110);
      pdf.text("This is system Generated document. doesn't need a signature", pageW / 2, y, { align: "center" });
      pdf.text("For Verification reach hr@techgyinnovations.com",             pageW / 2, y + 5, { align: "center" });

      pdf.save(`Payslip_${(p.name || "Employee").replace(/\s+/g, "_")}_${key}.pdf`);
    } catch (err) {
      console.error("buildAndDownloadPdf error:", err);
      alert("Failed to generate PDF. Make sure jsPDF is installed:\nnpm install jspdf");
    }
  };

  /* ─── Handlers ──────────────────────────────────────────────────────────── */
  const handleGenerateSingle = async (uid: string) => {
    setGeneratingUid(uid);
    const ok = await generatePayslip(uid, false);
    if (ok) await loadEmployees();
    setGeneratingUid(null);
  };

  const handleDownload = async (uid: string) => {
    setDownloadingUid(uid);
    await buildAndDownloadPdf(uid, monthKey);
    setDownloadingUid(null);
  };

  const handleGenerateAll = async () => {
    const pending = filteredEmployees.filter((e) => !e.generated);
    if (!pending.length) { alert("All payslips already generated."); return; }
    setLoadingAll(true);
    setBulkProgress({ done: 0, total: pending.length });
    let success = 0; const fail: string[] = [];
    for (let i = 0; i < pending.length; i++) {
      const ok = await generatePayslip(pending[i].uid, true);
      if (ok) success++; else fail.push(pending[i].name);
      setBulkProgress({ done: i + 1, total: pending.length });
    }
    await loadEmployees();
    setLoadingAll(false); setBulkProgress(null);
    if (!fail.length) alert(`✅ ${success} payslips generated!`);
    else alert(`✅ ${success} generated.\n❌ Failed: ${fail.join(", ")}`);
  };

  /* ─── Sub-views ─────────────────────────────────────────────────────────── */
  if (currentView === "salary") return (
    <div className="space-y-4">
      <BackBar label="Salary Structure" onBack={() => setCurrentView("payroll")} />
      <SalaryStructure />
    </div>
  );
  if (currentView === "history") return (
    <div className="space-y-4">
      <BackBar label="Payslip History" onBack={() => setCurrentView("payroll")} />
      <PayslipHistory />
    </div>
  );

  /* ─── Main view ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Payroll Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage salaries, generate payroll, and download payslips.</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Year</span>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Month</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {monthNames.map((name, idx) => <option key={idx} value={idx + 1}>{name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Employee</span>
          <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="all">All</option>
            {employees.map((e) => <option key={e.uid} value={e.uid}>{e.name}</option>)}
          </select>
        </div>
        <button onClick={handleGenerateAll} disabled={loadingAll || pendingCount === 0}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition">
          {loadingAll ? "Generating…" : "Generate"}
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg bg-white w-fit">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
        </svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees…" className="text-sm focus:outline-none w-48 bg-transparent" />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-medium">Payroll Output Area</span>
          <span className="text-xs text-gray-500">{monthNames[selectedMonth - 1]} {selectedYear}</span>
        </div>

        {bulkProgress && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Generating {bulkProgress.done} / {bulkProgress.total}…</span>
              <span>{Math.round((bulkProgress.done / bulkProgress.total) * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {filteredEmployees.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-700">No employees found</p>
            <p className="text-xs text-gray-400 mt-1">Select filters and click Generate to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Employee</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.uid} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.generated
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">✅ Generated</span>
                      : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">⏳ Pending</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.generated ? (
                      <button onClick={() => handleDownload(emp.uid)} disabled={downloadingUid === emp.uid}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-500 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        {downloadingUid === emp.uid ? "Preparing…" : "⬇ Download"}
                      </button>
                    ) : (
                      <button disabled
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg text-xs font-medium cursor-not-allowed bg-gray-50">
                        ⬇ Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Payroll
      </button>
      <span className="text-gray-300">/</span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
  );
}