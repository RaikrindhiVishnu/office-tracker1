"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, getDoc,
  doc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Payslip {
  id: string;
  month: string;
  gross: number;
  deductions: number;
  netSalary: number;
  generatedAt: any;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const ITEMS_PER_PAGE = 10;

export default function Payslips() {
  const { user } = useAuth();

  const [allPayslips,   setAllPayslips]   = useState<Payslip[]>([]);
  const [joinDate,      setJoinDate]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [selectedKey,   setSelectedKey]   = useState<string | null>(null);
  const [downloading,   setDownloading]   = useState<string | null>(null);
  const [requesting,    setRequesting]    = useState<string | null>(null);
  const [requestedKeys, setRequestedKeys] = useState<Set<string>>(new Set());

  const [filterYear,  setFilterYear]  = useState(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState("");
  const [page, setPage] = useState(1);

  /* ── Load payslips + user join date ── */
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const [snap, userDoc] = await Promise.all([
        getDocs(query(collection(db, "payslips"), where("uid", "==", user.uid))),
        getDoc(doc(db, "users", user.uid)),
      ]);

      const list: Payslip[] = snap.docs.map((d) => ({
        id: d.id, ...d.data(),
      })) as Payslip[];
      list.sort((a, b) => b.month.localeCompare(a.month));
      setAllPayslips(list);

      // Get join date from user doc
      const userData = userDoc.data();
      setJoinDate(userData?.dateOfJoining || null);

      // Default selected = latest month up to today
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setSelectedKey(list.length > 0 ? list[0].month : currentKey);

      setLoading(false);
    })();
  }, [user?.uid]);

  /* ── Helpers ── */
  const generatedMap = useMemo(() => {
    const map = new Map<string, Payslip>();
    allPayslips.forEach((p) => map.set(p.month, p));
    return map;
  }, [allPayslips]);

  const fmtKey = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  };

  const availableYears = useMemo(() => {
    const now = new Date();
    const years = new Set<string>();
    // Add all years from payslips
    allPayslips.forEach((p) => years.add(p.month.split("-")[0]));
    // Always include current year
    years.add(String(now.getFullYear()));
    // Add join year if available
    if (joinDate) {
      const jy = joinDate.split("-")[0] || joinDate.split("/")[2];
      if (jy) years.add(jy);
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allPayslips, joinDate]);

  /* ── Generate ALL months from join date → current month ── */
  const allMonthRows = useMemo(() => {
    const now = new Date();
    const endYear  = now.getFullYear();
    const endMonth = now.getMonth() + 1; // 1-based

    // Parse join date (support YYYY-MM-DD or DD/MM/YYYY)
    let startYear  = endYear;
    let startMonth = 1;

    if (joinDate) {
      if (joinDate.includes("-")) {
        const parts = joinDate.split("-");
        startYear  = Number(parts[0]);
        startMonth = Number(parts[1]);
      } else if (joinDate.includes("/")) {
        const parts = joinDate.split("/");
        startYear  = Number(parts[2]);
        startMonth = Number(parts[1]);
      }
    } else if (allPayslips.length > 0) {
      // Fallback: oldest payslip month
      const oldest = allPayslips[allPayslips.length - 1].month;
      const [oy, om] = oldest.split("-").map(Number);
      startYear  = oy;
      startMonth = om;
    }

    const rows: string[] = [];
    let y = endYear, m = endMonth;

    while (y > startYear || (y === startYear && m >= startMonth)) {
      rows.push(`${y}-${String(m).padStart(2, "0")}`);
      m--;
      if (m === 0) { m = 12; y--; }
    }

    return rows; // already latest-first
  }, [joinDate, allPayslips]);

  /* ── Filter ── */
  const filteredRows = useMemo(() =>
    allMonthRows.filter((key) => {
      const [y, m] = key.split("-").map(Number);
      return (
        (!filterYear  || String(y) === filterYear) &&
        (!filterMonth || m === Number(filterMonth))
      );
    }),
    [allMonthRows, filterYear, filterMonth]
  );

  /* ── Pagination ── */
  const totalPages    = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const paginatedRows = filteredRows.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  /* ── Submit filter ── */
  const handleSubmit = () => {
    setPage(1);
    if (filterYear && filterMonth) {
      const key = `${filterYear}-${String(filterMonth).padStart(2, "0")}`;
      setSelectedKey(key);
    } else if (filterYear) {
      const forYear = filteredRows[0];
      if (forYear) setSelectedKey(forYear);
    }
  };

  /* ── Request ── */
  const requestGenerate = async (key: string) => {
    if (!user?.uid || requestedKeys.has(key)) return;
    setRequesting(key);
    try {
      await addDoc(collection(db, "payslipRequests"), {
        uid: user.uid, month: key, status: "pending", createdAt: serverTimestamp(),
      });
      setRequestedKeys((prev) => new Set(prev).add(key));
    } catch (err) {
      console.error(err);
    } finally {
      setRequesting(null);
    }
  };

  /* ── Download ── */
  const downloadPayslip = async (monthKey: string) => {
    setDownloading(monthKey);
    try {
      const { default: jsPDF } = await import("jspdf");
      const logoDataUrl = await new Promise<string>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 150;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png")); }
          else resolve("");
        };
        img.onerror = () => resolve("");
        img.src = "/logo (2).png";
      });

      const userDoc    = await getDoc(doc(db, "users", user!.uid));
      const salarySnap = await getDoc(doc(db, "salaryStructures", user!.uid));
      if (!salarySnap.exists()) { alert("Salary structure not found."); return; }

      const userData = userDoc.data();
      const salary   = salarySnap.data();
      const basic    = Number(salary.basic || 0);
      const hra      = Number(salary.hra   || 0);
      const special  = Number(salary.specialAllowance || 0);
      const tds      = Number(salary.tds   || 0);
      const pt       = Number(salary.pt    || 0);
      const other    = Number(salary.other || 0);
      const totalEarnings   = basic + hra + special;
      const totalDeductions = tds + pt + other;
      const netSalary       = totalEarnings - totalDeductions;
      const totalDays   = salary.totalDays   || 30;
      const lop         = salary.lop         || 0;
      const bankAccount = salary.bankAccount || "N/A";
      const designation = userData?.designation || userData?.role || "Employee";
      const empId       = salary.empId || user!.uid.substring(0, 6).toUpperCase();
      const doj         = userData?.dateOfJoining || "N/A";
      const [year, month] = monthKey.split("-");
      const monthName = new Date(Number(year), Number(month) - 1)
        .toLocaleString("default", { month: "long" });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const W   = 595;

      if (logoDataUrl) pdf.addImage(logoDataUrl, "PNG", 18, 10, 145, 100);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(19); pdf.setTextColor(0,0,0);
      pdf.text("TECHGY INNOVATIONS", 222, 38);
      pdf.text("PRIVATE LIMITED",    222, 60);
      pdf.setFont("helvetica","normal"); pdf.setFontSize(8.5);
      pdf.text("Shop No. 09, Sri Venkateswara Swamy Residency, Land Mark -",   222, 77);
      pdf.text("Rajahmundry Ruchulu, 13th Phase Rd, Kukatpally Housing Board", 222, 88);
      pdf.text("Colony, Hyderabad, Telangana 500085",                          222, 99);
      pdf.text("CIN: U93090TG2019PTC13277",                                    222, 110);
      pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.8); pdf.line(28, 122, W-28, 122);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(13);
      pdf.text(`Payslip For: ${monthName}, ${year}`, W/2, 148, { align:"center" });

      const TOP_Y = 178, LINE_H = 19;
      const lbl = (t: string, x: number, y: number) => {
        pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.setTextColor(0,0,0); pdf.text(t,x,y);
      };
      const val = (t: string, x: number, y: number) => {
        pdf.setFont("helvetica","normal"); pdf.setFontSize(10); pdf.setTextColor(0,0,0); pdf.text(String(t),x,y);
      };

      lbl("Employee Name:",      28,  TOP_Y);              val(userData?.name||"-",    145, TOP_Y);
      lbl("Emp ID:",             28,  TOP_Y+LINE_H);        val(empId,                  145, TOP_Y+LINE_H);
      lbl("Designation:",        28,  TOP_Y+LINE_H*2);      val(designation,            145, TOP_Y+LINE_H*2);
      lbl("Date of Joining:",    28,  TOP_Y+LINE_H*3);      val(doj,                    145, TOP_Y+LINE_H*3);
      lbl("Total Days In Month:",318, TOP_Y);                val(String(totalDays),      470, TOP_Y);
      lbl("LOP",                 318, TOP_Y+LINE_H);         val(String(lop),            470, TOP_Y+LINE_H);
      lbl("Actual Paid Days",    318, TOP_Y+LINE_H*2);       val(String(totalDays-lop),  470, TOP_Y+LINE_H*2);
      lbl("Bank Account No.",    318, TOP_Y+LINE_H*3);       val(bankAccount,            470, TOP_Y+LINE_H*3);

      const TABLE_TOP = TOP_Y+LINE_H*3+28, ROW_H = 21, TX = 28;
      const CW = [145,115,165,114];
      const CX = [TX, TX+CW[0], TX+CW[0]+CW[1], TX+CW[0]+CW[1]+CW[2]];
      const rows2: [string,string,string,string,boolean,boolean][] = [
        ["Earnings","Amount","Deduction","Amount",true,false],
        ["Basic Salary",String(basic),"TDS",String(tds),false,false],
        ["HRA",String(hra),"PT",String(pt),false,false],
        ["Special Allowances",String(special),"Other",other?String(other):"",false,false],
        ["Total Earnings",String(totalEarnings),"Total Deductions",String(totalDeductions),false,true],
      ];

      rows2.forEach(([el,ev,dl,dv,isH,isT], i) => {
        const ry = TABLE_TOP + i * ROW_H;
        [el,ev,dl,dv].forEach((text, ci) => {
          const x = CX[ci], w = CW[ci];
          if (isH||isT) { pdf.setFillColor(224,224,224); pdf.rect(x,ry,w,ROW_H,"F"); }
          pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.5); pdf.rect(x,ry,w,ROW_H,"S");
          const ty = ry+ROW_H-6;
          pdf.setFont("helvetica", isH||isT?"bold":"normal");
          pdf.setFontSize(10); pdf.setTextColor(0,0,0);
          if (isH) pdf.text(text, x+w/2, ty, { align:"center" });
          else if ((ci===1||ci===3)&&text) pdf.text(text, x+w-6, ty, { align:"right" });
          else pdf.text(text, x+6, ty);
        });
      });

      const NET_Y = TABLE_TOP+rows2.length*ROW_H+26;
      pdf.setFont("helvetica","bold"); pdf.setFontSize(13); pdf.setTextColor(0,0,0);
      pdf.text("Net Salary",      165, NET_Y);
      pdf.text(String(netSalary), 315, NET_Y);
      pdf.setFont("helvetica","italic"); pdf.setFontSize(9); pdf.setTextColor(80,80,80);
      pdf.text("This is system Generated document. doesn't need a signature", W/2, NET_Y+55, { align:"center" });
      pdf.text("For Verification reach hr@techgyinnovations.com",             W/2, NET_Y+69, { align:"center" });
      pdf.save(`Payslip_${userData?.name||user!.uid}_${monthKey}.pdf`);
    } finally {
      setDownloading(null);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isGenerated = selectedKey ? generatedMap.has(selectedKey) : false;
  const isRequested = selectedKey ? requestedKeys.has(selectedKey) : false;

  /* ── Render ── */
  return (
    <div className="flex flex-col gap-5">

      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-800">My Payslips</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {allPayslips.length} payslip{allPayslips.length !== 1 ? "s" : ""} generated
        </p>
      </div>

      {/* ── FILTER — tight pill ── */}
      <div className="inline-flex items-center w-fit rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

        <div className="relative">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="appearance-none pl-3 pr-7 py-2 text-sm font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <div className="relative">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="appearance-none pl-3 pr-7 py-2 text-sm font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="">All months</option>
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={String(idx + 1)}>{name}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </div>

        <div className="w-px h-6 bg-slate-200" />

        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Submit
        </button>
      </div>

      {/* ── PERIOD CARD ── */}
      {selectedKey && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Period</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{fmtKey(selectedKey)}</p>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isGenerated ? "bg-emerald-50" : "bg-slate-100"}`}>
                <svg className={`w-4 h-4 ${isGenerated ? "text-emerald-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{fmtKey(selectedKey)}</p>
                <p className="text-xs text-slate-400">
                  {isGenerated ? "Payslip ready" : isRequested ? "Request sent to HR" : "No payslip generated yet"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isGenerated ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Generated
                  </span>
                  <button
                    onClick={() => downloadPayslip(selectedKey)}
                    disabled={downloading === selectedKey}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                    style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe" }}
                  >
                    {downloading === selectedKey
                      ? <span className="w-3 h-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                      : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    }
                    {downloading === selectedKey ? "Preparing…" : "Download PDF"}
                  </button>
                </>
              ) : isRequested ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Request Sent
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Not Generated
                  </span>
                  <button
                    onClick={() => requestGenerate(selectedKey)}
                    disabled={requesting === selectedKey}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                    style={{ background:"linear-gradient(135deg,#1e3a8a,#2563eb)" }}
                  >
                    {requesting === selectedKey
                      ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : "⚡"
                    }
                    {requesting === selectedKey ? "Sending…" : "Request Generate"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Payslip History</p>
          <p className="text-xs text-slate-400">
            {filteredRows.length} month{filteredRows.length !== 1 ? "s" : ""}
            {filteredRows.length !== allMonthRows.length && ` (filtered from ${allMonthRows.length})`}
          </p>
        </div>

        {/* Table head */}
        <div className="grid grid-cols-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Employee</span>
          <span>Month</span>
          <span className="text-center">Status</span>
          <span className="text-right">Action</span>
        </div>

        {/* Rows — every month from join → now */}
        {paginatedRows.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-slate-500">No records found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different year or month</p>
          </div>
        ) : paginatedRows.map((monthKey) => {
          const rowGenerated = generatedMap.has(monthKey);
          const rowRequested = requestedKeys.has(monthKey);
          const isSel = monthKey === selectedKey;

          return (
            <div
              key={monthKey}
              onClick={() => setSelectedKey(monthKey)}
              className={`grid grid-cols-4 items-center px-5 py-3 border-t border-slate-50 cursor-pointer transition-colors ${isSel ? "bg-blue-50" : "hover:bg-slate-50"}`}
            >
              {/* Employee */}
              <span className={`text-sm font-medium truncate ${isSel ? "text-blue-700" : "text-slate-800"}`}>
                {user?.displayName || "Employee"}
              </span>

              {/* Month */}
              <span className="text-sm text-slate-600">{fmtKey(monthKey)}</span>

              {/* Status */}
              <div className="flex justify-center">
                {rowGenerated ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />✔ Generated
                  </span>
                ) : rowRequested ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-md px-2 py-0.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400 inline-block" />Requested
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 rounded-md px-2 py-0.5">
                    ❌ Not Generated
                  </span>
                )}
              </div>

              {/* Action */}
              <div className="flex justify-end">
                {rowGenerated ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPayslip(monthKey); }}
                    disabled={downloading === monthKey}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe" }}
                  >
                    {downloading === monthKey
                      ? <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                      : <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    }
                    ⬇ PDF
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); requestGenerate(monthKey); }}
                    disabled={requesting === monthKey || rowRequested}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50 transition-colors"
                    style={{
                      background: rowRequested ? "#fefce8" : "#fff7ed",
                      color:      rowRequested ? "#92400e" : "#c2410c",
                      border:     `1px solid ${rowRequested ? "#fde68a" : "#fed7aa"}`,
                    }}
                  >
                    {requesting === monthKey
                      ? <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />
                      : "⚡"
                    }
                    {rowRequested ? "Sent" : "Request"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1.5 py-3 border-t border-slate-100">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              ← Prev
            </button>

            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  page === i + 1 ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>

    </div>
  );
}