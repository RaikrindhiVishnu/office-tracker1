"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc
} from "firebase/firestore";
import SalaryStructure from "./SalaryStructure";
import PayslipHistory  from "./PayslipHistory";
import type { AttendanceType } from "@/types/attendance";

type EmployeeData = {
  uid: string; name: string; email: string; generated?: boolean;
  designation?: string;
  empId?: string;
  dateOfJoining?: string;
  paymentMode?: string;
  bankName?: string;
  ifscCode?: string;
  accountNo?: string;
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
  const [employees, setEmployees]           = useState<EmployeeData[]>([]);
  const [selectedYear, setSelectedYear]     = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth]   = useState(today.getMonth() + 1);
  const [selectedEmp, setSelectedEmp]       = useState<string>("all");
  const [search, setSearch]                 = useState("");
  const [generatingUid, setGeneratingUid]   = useState<string | null>(null);
  const [downloadingUid, setDownloadingUid] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress]     = useState<{ done: number; total: number } | null>(null);
  const [loadingAll, setLoadingAll]         = useState(false);
  const [monthlyAtt, setMonthlyAtt]         = useState<Record<string, Record<string, AttendanceType>>>({});

  // Edit Modal State
  const [editingEmp, setEditingEmp]         = useState<EmployeeData | null>(null);
  const [editForm, setEditForm]             = useState<any>({});
  const [savingEdit, setSavingEdit]         = useState(false);

  // Preview Modal State
  const [previewData, setPreviewData]       = useState<any | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const monthKey    = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const yearOptions = [today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2];

  useEffect(() => { loadEmployees(); loadMonthlyAttendance(); }, [monthKey]);

  const loadMonthlyAttendance = async () => {
    const snap = await getDoc(doc(db, "monthlyAttendance", monthKey));
    if (snap.exists()) setMonthlyAtt(snap.data() as any);
    else setMonthlyAtt({});
  };

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list: EmployeeData[] = [];
    for (const docSnap of snap.docs) {
      const uid  = docSnap.id;
      const data = docSnap.data();
      if (data.accountType === "BUSINESSOWNER") continue;
      const payslipSnap = await getDoc(doc(db, "payslips", `${uid}_${monthKey}`));
      list.push({ 
        uid, 
        name: data.name || "", 
        email: data.email || "", 
        generated: payslipSnap.exists(),
        designation: data.designation || "",
        empId: data.empId || "",
        dateOfJoining: data.dateOfJoining || "",
        paymentMode: data.paymentMode || "",
        bankName: data.bankName || "",
        ifscCode: data.ifscCode || "",
        accountNo: data.accountNo || data.bankAccount || "",
      });
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

  const handleEditClick = async (emp: EmployeeData) => {
    setEditingEmp(emp);
    setEditForm({ ...emp });
    try {
      const snap = await getDoc(doc(db, "salaryStructures", emp.uid));
      if (snap.exists()) {
        setEditForm((prev: any) => ({ ...prev, ...snap.data() }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEmp) return;
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "users", editingEmp.uid), {
        empId: editForm.empId || "",
        designation: editForm.designation || "",
        dateOfJoining: editForm.dateOfJoining || "",
        paymentMode: editForm.paymentMode || "",
        bankName: editForm.bankName || "",
        ifscCode: editForm.ifscCode || "",
        accountNo: editForm.accountNo || "",
      });

      const gross = Number(editForm.basic || 0) + Number(editForm.hra || 0) + Number(editForm.specialAllowance || 0);
      await setDoc(doc(db, "salaryStructures", editingEmp.uid), {
        basic: editForm.basic || "",
        hra: editForm.hra || "",
        specialAllowance: editForm.specialAllowance || "",
        pf: editForm.pf || "",
        pt: editForm.pt || "",
        tds: editForm.tds || "",
        bankAccount: editForm.accountNo || editForm.bankAccount || "",
        pan: editForm.pan || "",
        gross,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert("Details updated successfully!");
      setEditingEmp(null);
      await loadEmployees();
    } catch (err) {
      console.error(err);
      alert("Failed to update details.");
    }
    setSavingEdit(false);
  };

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

      const totalDays        = daysInMonth(selectedMonth, selectedYear);
      let paidDays           = totalDays;
      let lop                = 0;

      if (monthlyAtt[uid]) {
        const attRecord = monthlyAtt[uid];
        let pCount = 0; let aCount = 0; let lCount = 0;
        for (let d = 1; d <= totalDays; d++) {
          const ds = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const st = attRecord[ds];
          if (st === "P" || st === "H" || st === "SL") pCount++;
          else if (st === "A") aCount++;
          else if (st === "LOP") lCount++;
        }
        if (pCount > 0 || aCount > 0 || lCount > 0) {
           lop = aCount + lCount;
           paidDays = Math.max(0, totalDays - lop);
        }
      }

      const basic            = Number(s.basic ?? s.Basic ?? 0);
      const hra              = Number(s.hra ?? s.HRA ?? 0);
      const specialAllowance = Number(s.specialAllowance ?? s.SpecialAllowance ?? 0);
      const grossSalary      = basic + hra + specialAllowance;
      
      const lopDeduction     = Math.round((grossSalary / totalDays) * lop);

      const pf               = Number(s.pf               ?? s.PF               ?? 0);
      const pt               = Number(s.pt               ?? s.PT               ?? 0);
      const tds              = Number(s.tds              ?? s.TDS              ?? 0);
      const totalEarnings    = basic + hra + specialAllowance;
      const totalDeductions  = pf + pt + tds + lopDeduction;
      const netSalary        = Math.max(0, totalEarnings - totalDeductions);

      await setDoc(doc(db, "payslips", `${uid}_${monthKey}`), {
        uid,
        name:           u.name          || "",
        email:          u.email         || "",
        designation:    u.designation   || "N/A",
        empId:          u.empId         || u.employeeId || "N/A",
        dateOfJoining:  u.dateOfJoining || u.joiningDate || "N/A",
        bankAccount:    u.accountNo     || s.bankAccount || s.BankAccount || "N/A",
        bankName:       u.bankName      || "N/A",
        ifscCode:       u.ifscCode      || "N/A",
        paymentMode:    u.paymentMode   || "N/A",
        pan:            s.pan           ?? s.Pan         ?? "N/A",
        month:          selectedMonth,
        year:           selectedYear,
        monthKey,
        totalDays,
        lop,
        paidDays,
        basic, hra, specialAllowance,
        totalEarnings,
        pf, pt, tds,
        totalDeductions,
        lopDeduction,
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
        ["LOP Deduction", fmt(p.lopDeduction || 0)],
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
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) { alert("Employee not found."); setGeneratingUid(null); return; }
      const u = userSnap.data();

      const salarySnap = await getDoc(doc(db, "salaryStructures", uid));
      if (!salarySnap.exists()) {
        alert(`No salary structure found for ${u.name}. Please set it up first.`);
        setGeneratingUid(null); return;
      }
      const s = salarySnap.data();

      const totalDays        = daysInMonth(selectedMonth, selectedYear);
      let paidDays           = totalDays;
      let lop                = 0;

      if (monthlyAtt[uid]) {
        const attRecord = monthlyAtt[uid];
        let pCount = 0; let aCount = 0; let lCount = 0;
        for (let d = 1; d <= totalDays; d++) {
          const ds = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const st = attRecord[ds];
          if (st === "P" || st === "H" || st === "SL") pCount++;
          else if (st === "A") aCount++;
          else if (st === "LOP") lCount++;
        }
        if (pCount > 0 || aCount > 0 || lCount > 0) {
           lop = aCount + lCount;
           paidDays = Math.max(0, totalDays - lop);
        }
      }

      const rawBasic            = Number(s.basic ?? s.Basic ?? 0);
      const rawHra              = Number(s.hra ?? s.HRA ?? 0);
      const rawSpecialAllowance = Number(s.specialAllowance ?? s.SpecialAllowance ?? 0);
      const pf               = Number(s.pf               ?? s.PF               ?? 0);
      const pt               = Number(s.pt               ?? s.PT               ?? 0);
      const tds              = Number(s.tds              ?? s.TDS              ?? 0);

      const basic = rawBasic;
      const hra = rawHra;
      const specialAllowance = rawSpecialAllowance;
      const grossSalary = basic + hra + specialAllowance;
      const lopDeduction = Math.round((grossSalary / totalDays) * lop);
      const totalEarnings    = basic + hra + specialAllowance;
      const totalDeductions  = pf + pt + tds + lopDeduction;
      const netSalary        = Math.max(0, totalEarnings - totalDeductions);

      setPreviewData({
        uid, u, s, rawBasic, rawHra, rawSpecialAllowance, pf, pt, tds, totalDays, paidDays, lop, lopDeduction, basic, hra, specialAllowance, totalEarnings, totalDeductions, netSalary
      });
      setShowPreviewModal(true);
    } catch (err) {
      console.error(err);
      alert("Error preparing preview.");
    }
    setGeneratingUid(null);
  };

  const handlePreviewPaidDaysChange = (newPaidDaysStr: string) => {
    if (!previewData) return;
    const newPaidDays = Number(newPaidDaysStr);
    const lop = previewData.totalDays - newPaidDays;
    const finalLop = lop < 0 ? 0 : lop;
    
    const basic = previewData.rawBasic;
    const hra = previewData.rawHra;
    const specialAllowance = previewData.rawSpecialAllowance;
    const grossSalary = basic + hra + specialAllowance;
    const lopDeduction = Math.round((grossSalary / previewData.totalDays) * finalLop);
    
    const totalEarnings = basic + hra + specialAllowance;
    const totalDeductions = previewData.pf + previewData.pt + previewData.tds + lopDeduction;
    const netSalary = Math.max(0, totalEarnings - totalDeductions);

    setPreviewData({
      ...previewData,
      paidDays: newPaidDays,
      lop: finalLop,
      lopDeduction,
      basic, hra, specialAllowance, totalEarnings, totalDeductions, netSalary
    });
  };

  const confirmAndGeneratePayslip = async () => {
    if (!previewData) return;
    try {
      setGeneratingUid(previewData.uid);
      setShowPreviewModal(false);

      const { uid, u, s, totalDays, paidDays, lop, lopDeduction, basic, hra, specialAllowance, pf, pt, tds, totalEarnings, totalDeductions, netSalary } = previewData;

      await setDoc(doc(db, "payslips", `${uid}_${monthKey}`), {
        uid,
        name:           u.name          || "",
        email:          u.email         || "",
        designation:    u.designation   || "N/A",
        empId:          u.empId         || u.employeeId || "N/A",
        dateOfJoining:  u.dateOfJoining || u.joiningDate || "N/A",
        bankAccount:    u.accountNo     || s.bankAccount || s.BankAccount || "N/A",
        bankName:       u.bankName      || "N/A",
        ifscCode:       u.ifscCode      || "N/A",
        paymentMode:    u.paymentMode   || "N/A",
        pan:            s.pan           ?? s.Pan         ?? "N/A",
        month:          selectedMonth,
        year:           selectedYear,
        monthKey,
        totalDays,
        lop,
        paidDays,
        basic, hra, specialAllowance,
        totalEarnings,
        pf, pt, tds,
        totalDeductions,
        lopDeduction,
        netSalary,
        generatedAt: serverTimestamp(),
      });
      await loadEmployees();
      setGeneratingUid(null);
      await handleDownload(uid);
    } catch(e) {
      console.error(e);
      alert("Failed to confirm and generate.");
      setGeneratingUid(null);
    }
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
    else alert(`✅ ${success} generated.\n❌ Failed: ${fail.join(", ")}\n\n💡 Make sure you have configured the Salary Structure for these employees!`);
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
                  <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                    <button onClick={() => handleEditClick(emp)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">
                      ✏ Edit Details
                    </button>
                    {emp.generated ? (
                      <button onClick={() => handleDownload(emp.uid)} disabled={downloadingUid === emp.uid}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-500 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        {downloadingUid === emp.uid ? "Preparing…" : "⬇ Download"}
                      </button>
                    ) : (
                      <button onClick={() => handleGenerateSingle(emp.uid)} disabled={generatingUid === emp.uid}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        {generatingUid === emp.uid ? "Generating…" : "⚙ Generate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Edit Payroll Details for {editingEmp.name}</h2>
            
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Employee Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Employee ID</label>
                <input type="text" value={editForm.empId || ""} onChange={(e) => setEditForm({ ...editForm, empId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Designation</label>
                <input type="text" value={editForm.designation || ""} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Date of Joining</label>
                <input type="date" value={editForm.dateOfJoining || ""} onChange={(e) => setEditForm({ ...editForm, dateOfJoining: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Payment Mode</label>
                <select value={editForm.paymentMode || ""} onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="">Select Mode</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bank Name</label>
                <input type="text" value={editForm.bankName || ""} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">IFSC Code</label>
                <input type="text" value={editForm.ifscCode || ""} onChange={(e) => setEditForm({ ...editForm, ifscCode: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Account Number</label>
                <input type="text" value={editForm.accountNo || ""} onChange={(e) => setEditForm({ ...editForm, accountNo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">PAN Number</label>
                <input type="text" value={editForm.pan || ""} onChange={(e) => setEditForm({ ...editForm, pan: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm uppercase" />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Salary Components</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Basic</label>
                <input type="number" value={editForm.basic || ""} onChange={(e) => setEditForm({ ...editForm, basic: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">HRA</label>
                <input type="number" value={editForm.hra || ""} onChange={(e) => setEditForm({ ...editForm, hra: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Special Allowance</label>
                <input type="number" value={editForm.specialAllowance || ""} onChange={(e) => setEditForm({ ...editForm, specialAllowance: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">PF</label>
                <input type="number" value={editForm.pf || ""} onChange={(e) => setEditForm({ ...editForm, pf: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">PT</label>
                <input type="number" value={editForm.pt || ""} onChange={(e) => setEditForm({ ...editForm, pt: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">TDS</label>
                <input type="number" value={editForm.tds || ""} onChange={(e) => setEditForm({ ...editForm, tds: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingEmp(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition text-sm">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm">
                {savingEdit ? "Saving..." : "Save Details"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Preview Payslip: {previewData.u.name}</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Total Days</label>
                  <input type="number" value={previewData.totalDays} disabled className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Paid Days</label>
                  <input type="number" value={previewData.paidDays} onChange={(e) => handlePreviewPaidDaysChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-semibold text-indigo-700 focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">LOP Days</label>
                  <input type="number" value={previewData.lop} disabled className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-red-500" />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Calculated Salary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Basic</span><span className="font-medium text-gray-900">₹{previewData.basic.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">HRA</span><span className="font-medium text-gray-900">₹{previewData.hra.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Special Allowance</span><span className="font-medium text-gray-900">₹{previewData.specialAllowance.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">LOP Deduction</span><span className="font-medium text-red-500">− ₹{previewData.lopDeduction.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Total Deductions (PF, PT, TDS, LOP)</span><span className="font-medium text-red-500">− ₹{previewData.totalDeductions.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-gray-100 pt-2"><span className="font-bold text-gray-900">Net Salary</span><span className="font-bold text-indigo-600 text-lg">₹{previewData.netSalary.toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition text-sm">Cancel</button>
              <button onClick={confirmAndGeneratePayslip} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition text-sm">
                OK & Generate
              </button>
            </div>
          </div>
        </div>
      )}
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