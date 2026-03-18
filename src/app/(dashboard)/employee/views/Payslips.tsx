"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Payslip {
  id: string;
  month: string;
  gross: number;
  deductions: number;
  netSalary: number;
  generatedAt: any;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Payslips() {
  const { user } = useAuth();

  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading]         = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedYear,  setSelectedYear]  = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [panelOpen, setPanelOpen]     = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const snap = await getDocs(query(collection(db, "payslips"), where("uid", "==", user.uid)));
      const list: Payslip[] = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, month: data.month, gross: Number(data.gross||0), deductions: Number(data.deductions||0), netSalary: Number(data.netSalary||0), generatedAt: data.generatedAt };
      });
      list.sort((a, b) => b.month.localeCompare(a.month));
      setAllPayslips(list);
      if (list.length > 0) {
        const [y, m] = list[0].month.split("-").map(Number);
        setSelectedYear(y); setSelectedMonth(m);
      }
      setLoading(false);
    })();
  }, [user?.uid]);

  const availableYears = Array.from(new Set(allPayslips.map((p) => Number(p.month.split("-")[0])))).sort((a, b) => b - a);
  const availableMonths = (year: number): Set<number> =>
    new Set(allPayslips.filter((p) => p.month.startsWith(String(year))).map((p) => Number(p.month.split("-")[1])));

  const currentPayslip = selectedYear && selectedMonth
    ? allPayslips.find((p) => p.month === `${selectedYear}-${String(selectedMonth).padStart(2,"0")}`) ?? null
    : null;

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const months = Array.from(availableMonths(year)).sort((a, b) => b - a);
    setSelectedMonth(months[0] ?? null);
  };

  const monthLabel = (mk: string) => {
    const [y, m] = mk.split("-").map(Number);
    return `${MONTH_NAMES[m-1]} ${y}`;
  };

  const downloadPayslip = async (monthKey: string) => {
    setDownloading(monthKey);
    try {
      const { default: jsPDF } = await import("jspdf");
      const logoDataUrl = await new Promise<string>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth||300; canvas.height = img.naturalHeight||150;
          const ctx = canvas.getContext("2d");
          if (ctx) { ctx.drawImage(img,0,0); resolve(canvas.toDataURL("image/png")); } else resolve("");
        };
        img.onerror = () => resolve(""); img.src = "/logo (2).png";
      });
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      const salarySnap = await getDoc(doc(db, "salaryStructures", user!.uid));
      if (!salarySnap.exists()) { alert("Salary structure not found."); return; }
      const userData = userDoc.data(); const salary = salarySnap.data();
      const basic=Number(salary.basic||0), hra=Number(salary.hra||0), special=Number(salary.specialAllowance||0);
      const tds=Number(salary.tds||0), pt=Number(salary.pt||0), other=Number(salary.other||0);
      const totalEarnings=basic+hra+special, totalDeductions=tds+pt+other, netSalary=totalEarnings-totalDeductions;
      const totalDays=salary.totalDays||30, lop=salary.lop||0, bankAccount=salary.bankAccount||"N/A";
      const designation=userData?.designation||userData?.role||"Employee";
      const empId=salary.empId||user!.uid.substring(0,6).toUpperCase(), doj=userData?.dateOfJoining||"N/A";
      const [year,month]=monthKey.split("-");
      const monthName=new Date(Number(year),Number(month)-1).toLocaleString("default",{month:"long"});
      const monthDisplay=`${monthName}, ${year}`;
      const pdf=new jsPDF({unit:"pt",format:"a4"}); const W=595;
      if(logoDataUrl) pdf.addImage(logoDataUrl,"PNG",18,10,145,100);
      pdf.setFont("helvetica","bold");pdf.setFontSize(19);pdf.setTextColor(0,0,0);
      pdf.text("TECHGY INNOVATIONS",222,38);pdf.text("PRIVATE LIMITED",222,60);
      pdf.setFont("helvetica","normal");pdf.setFontSize(8.5);
      pdf.text("Shop No. 09, Sri Venkateswara Swamy Residency, Land Mark -",222,77);
      pdf.text("Rajahmundry Ruchulu, 13th Phase Rd, Kukatpally Housing Board",222,88);
      pdf.text("Colony, Hyderabad, Telangana 500085",222,99);pdf.text("CIN: U93090TG2019PTC13277",222,110);
      pdf.setDrawColor(0,0,0);pdf.setLineWidth(0.8);pdf.line(28,122,W-28,122);
      pdf.setFont("helvetica","bold");pdf.setFontSize(13);pdf.setTextColor(0,0,0);
      pdf.text(`Payslip For: ${monthDisplay}`,W/2,148,{align:"center"});
      const TOP_Y=178,LINE_H=19;
      const lbl=(t:string,x:number,y:number)=>{pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.setTextColor(0,0,0);pdf.text(t,x,y);};
      const val=(t:string,x:number,y:number)=>{pdf.setFont("helvetica","normal");pdf.setFontSize(10);pdf.setTextColor(0,0,0);pdf.text(String(t),x,y);};
      lbl("Employee Name:",28,TOP_Y);val(userData?.name||"-",145,TOP_Y);
      lbl("Emp ID:",28,TOP_Y+LINE_H);val(empId,145,TOP_Y+LINE_H);
      lbl("Designation:",28,TOP_Y+LINE_H*2);val(designation,145,TOP_Y+LINE_H*2);
      lbl("Date of Joining:",28,TOP_Y+LINE_H*3);val(doj,145,TOP_Y+LINE_H*3);
      lbl("Total Days In Month:",318,TOP_Y);val(String(totalDays),470,TOP_Y);
      lbl("LOP",318,TOP_Y+LINE_H);val(String(lop),470,TOP_Y+LINE_H);
      lbl("Actual Paid Days",318,TOP_Y+LINE_H*2);val(String(totalDays-lop),470,TOP_Y+LINE_H*2);
      lbl("Bank Account No.",318,TOP_Y+LINE_H*3);val(bankAccount,470,TOP_Y+LINE_H*3);
      const TABLE_TOP=TOP_Y+LINE_H*3+28,ROW_H=21,TX=28;
      const CW=[145,115,165,114],CX=[TX,TX+CW[0],TX+CW[0]+CW[1],TX+CW[0]+CW[1]+CW[2]];
      const rows:[string,string,string,string,boolean,boolean][]=[
        ["Earnings","Amount","Deduction","Amount",true,false],
        ["Basic Salary",String(basic),"TDS",String(tds),false,false],
        ["HRA",String(hra),"PT",String(pt),false,false],
        ["Special Allowances",String(special),"Other",other?String(other):"",false,false],
        ["Total Earnings",String(totalEarnings),"Total Deductions",String(totalDeductions),false,true],
      ];
      rows.forEach(([el,ev,dl,dv,isH,isT],i)=>{
        const ry=TABLE_TOP+i*ROW_H;
        [el,ev,dl,dv].forEach((text,ci)=>{
          const x=CX[ci],w=CW[ci];
          if(isH||isT){pdf.setFillColor(224,224,224);pdf.rect(x,ry,w,ROW_H,"F");}
          pdf.setDrawColor(0,0,0);pdf.setLineWidth(0.5);pdf.rect(x,ry,w,ROW_H,"S");
          const ty=ry+ROW_H-6;
          pdf.setFont("helvetica",isH||isT?"bold":"normal");pdf.setFontSize(10);pdf.setTextColor(0,0,0);
          if(isH) pdf.text(text,x+w/2,ty,{align:"center"});
          else if((ci===1||ci===3)&&text) pdf.text(text,x+w-6,ty,{align:"right"});
          else pdf.text(text,x+6,ty);
        });
      });
      const NET_Y=TABLE_TOP+rows.length*ROW_H+26;
      pdf.setFont("helvetica","bold");pdf.setFontSize(13);pdf.setTextColor(0,0,0);
      pdf.text("Net Salary",165,NET_Y);pdf.text(String(netSalary),315,NET_Y);
      pdf.setFont("helvetica","italic");pdf.setFontSize(9);pdf.setTextColor(80,80,80);
      pdf.text("This is system Generated document. doesn't need a signature",W/2,NET_Y+55,{align:"center"});
      pdf.text("For Verification reach hr@techgyinnovations.com",W/2,NET_Y+69,{align:"center"});
      pdf.save(`Payslip_${userData?.name||user!.uid}_${monthKey}.pdf`);
    } finally { setDownloading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-45">
        <div className="w-7 h-7 rounded-full border-[3px] border-blue-100 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (allPayslips.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-600 mb-1">No Payslips Yet</p>
        <p className="text-xs text-slate-400">Your payslips will appear here once HR generates them.</p>
      </div>
    );
  }

  const activeMonths = selectedYear ? availableMonths(selectedYear) : new Set<number>();

  return (
    <div className="flex flex-col gap-4">

      {/* ── Page title row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Payslips</h2>
          <p className="text-xs text-gray-400 mt-0.5">{allPayslips.length} payslip{allPayslips.length !== 1 ? "s" : ""} available</p>
        </div>
      </div>

      {/* ── Collapsible Filter Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">

        {/* Toggle header */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800">Select Period</p>
              {!panelOpen && currentPayslip && (
                <p className="text-xs text-slate-400">{monthLabel(currentPayslip.month)}</p>
              )}
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${panelOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>

        {/* Collapsible body */}
        {panelOpen && (
          <div className="px-5 pb-5 border-t border-slate-100 flex flex-col gap-4 pt-4">

            {/* Year */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Year</p>
              <div className="flex gap-2 flex-wrap">
                {availableYears.map((year) => (
                  <button
                    key={year}
                    onClick={() => handleYearChange(year)}
                    className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                    style={
                      selectedYear === year
                        ? { background:"linear-gradient(135deg,#1e3a8a,#2563eb)", color:"#fff", boxShadow:"0 3px 10px rgba(37,99,235,0.25)" }
                        : { background:"#f8fafc", color:"#64748b", border:"1px solid #e2e8f0" }
                    }
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            {/* Month grid */}
            {selectedYear && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Month</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {SHORT_MONTHS.map((name, idx) => {
                    const monthNum = idx + 1;
                    const hasData  = activeMonths.has(monthNum);
                    const active   = selectedMonth === monthNum;
                    return (
                      <button
                        key={monthNum}
                        disabled={!hasData}
                        onClick={() => setSelectedMonth(monthNum)}
                        className="relative py-2 rounded-lg text-xs font-semibold text-center transition-all"
                        style={
                          !hasData
                            ? { border:"1px dashed #e2e8f0", color:"#cbd5e1", cursor:"not-allowed" }
                            : active
                            ? { background:"linear-gradient(135deg,#1e3a8a,#2563eb)", color:"#fff", boxShadow:"0 2px 8px rgba(37,99,235,0.2)" }
                            : { background:"#f8fafc", color:"#475569", border:"1px solid #e2e8f0" }
                        }
                      >
                        {name}
                        {hasData && !active && (
                          <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-emerald-400 block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Download tile */}
            {currentPayslip && (
              <div
                className="rounded-xl overflow-hidden mt-1"
                style={{ border:"1px solid #e0e7ff" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background:"linear-gradient(135deg,#1e3a8a,#2563eb)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:"rgba(255,255,255,0.12)" }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color:"rgba(147,197,253,0.8)" }}>Official Payslip</p>
                      <p className="text-sm font-bold text-white">{monthLabel(currentPayslip.month)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadPayslip(currentPayslip.month)}
                    disabled={downloading === currentPayslip.month}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all"
                    style={{ background:"rgba(255,255,255,0.13)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff" }}
                  >
                    {downloading === currentPayslip.month
                      ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    }
                    {downloading === currentPayslip.month ? "Preparing…" : "Download PDF"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── History Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Payslip History</p>
          <span className="text-xs text-slate-400">{allPayslips.length} record{allPayslips.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Head */}
        <div className="flex items-center px-5 py-2 bg-slate-50 border-b border-slate-100">
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Period</span>
          <span className="w-24 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
          <span className="w-20 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Action</span>
        </div>

        {/* Rows */}
        {allPayslips.map((p) => {
          const [y, m] = p.month.split("-").map(Number);
          const isActive = selectedYear === y && selectedMonth === m;
          return (
            <div
              key={p.id}
              onClick={() => { setSelectedYear(y); setSelectedMonth(m); setPanelOpen(true); }}
              className={`flex items-center px-5 py-3 border-b border-slate-50 cursor-pointer transition-colors ${isActive ? "bg-blue-50" : "hover:bg-slate-50"}`}
            >
              <div className="flex-1 flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: isActive ? "#dbeafe" : "#f1f5f9" }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={isActive ? "#1d4ed8" : "#94a3b8"} strokeWidth={2}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-slate-800"}`}>
                    {MONTH_NAMES[m-1]} {y}
                  </p>
                </div>
              </div>

              <div className="w-24 flex justify-center">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                  Generated
                </span>
              </div>

              <div className="w-20 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadPayslip(p.month); }}
                  disabled={downloading === p.month}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe" }}
                >
                  {downloading === p.month
                    ? <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin inline-block" />
                    : <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  }
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}