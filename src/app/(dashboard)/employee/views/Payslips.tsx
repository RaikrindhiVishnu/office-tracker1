"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Payslip {
  id: string;
  month: string;
  gross: number;
  deductions: number;
  netSalary: number;
  generatedAt: any;
}

const MONTH_NAMES  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Payslips() {
  const { user } = useAuth();

  const [allPayslips,   setAllPayslips]   = useState<Payslip[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [downloading,   setDownloading]   = useState<string | null>(null);
  const [requesting,    setRequesting]    = useState<string | null>(null);
  const [requestedKeys, setRequestedKeys] = useState<Set<string>>(new Set());
  const [currentYear,   setCurrentYear]   = useState<number>(new Date().getFullYear());
  const [selectedKey,   setSelectedKey]   = useState<string | null>(null);
  const [calOpen,       setCalOpen]       = useState(false);
  const [histOpen,      setHistOpen]      = useState(false);

  /* load payslips */
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
      if (list.length > 0) setSelectedKey(list[0].month);
      setLoading(false);
    })();
  }, [user?.uid]);

  const generatedSet = new Set(allPayslips.map((p) => p.month));

  const mkKey = (year: number, monthIdx: number) =>
    `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  const isAvailable = (year: number, monthIdx: number) => {
    const now = new Date();
    return new Date(year, monthIdx, 1) <= new Date(now.getFullYear(), now.getMonth() + 1, 1);
  };

  const fmtKey = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  };

  const requestGenerate = async (key: string) => {
    if (!user?.uid || requestedKeys.has(key)) return;
    setRequesting(key);
    try {
      await addDoc(collection(db, "payslipRequests"), { uid: user.uid, month: key, status: "pending", createdAt: serverTimestamp() });
      setRequestedKeys((prev) => new Set(prev).add(key));
    } catch (err) { console.error("Request failed", err); }
    finally { setRequesting(null); }
  };

  const downloadPayslip = async (monthKey: string) => {
    setDownloading(monthKey);
    try {
      const { default: jsPDF } = await import("jspdf");
      const logoDataUrl = await new Promise<string>((resolve) => {
        const img = new window.Image(); img.crossOrigin = "anonymous";
        img.onload = () => { const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth||300; canvas.height = img.naturalHeight||150; const ctx = canvas.getContext("2d"); if (ctx) { ctx.drawImage(img,0,0); resolve(canvas.toDataURL("image/png")); } else resolve(""); };
        img.onerror = () => resolve(""); img.src = "/logo (2).png";
      });
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      const salarySnap = await getDoc(doc(db, "salaryStructures", user!.uid));
      if (!salarySnap.exists()) { alert("Salary structure not found."); return; }
      const userData = userDoc.data(); const salary = salarySnap.data();
      const basic=Number(salary.basic||0),hra=Number(salary.hra||0),special=Number(salary.specialAllowance||0);
      const tds=Number(salary.tds||0),pt=Number(salary.pt||0),other=Number(salary.other||0);
      const totalEarnings=basic+hra+special,totalDeductions=tds+pt+other,netSalary=totalEarnings-totalDeductions;
      const totalDays=salary.totalDays||30,lop=salary.lop||0,bankAccount=salary.bankAccount||"N/A";
      const designation=userData?.designation||userData?.role||"Employee";
      const empId=salary.empId||user!.uid.substring(0,6).toUpperCase(),doj=userData?.dateOfJoining||"N/A";
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
      pdf.setFont("helvetica","bold");pdf.setFontSize(13);
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

  /* detail panel rendered below trigger */
  const renderDetail = (key: string) => {
    const hasGen = generatedSet.has(key);
    const isReq  = requestedKeys.has(key);
    const avail  = isAvailable(currentYear, parseInt(key.split("-")[1]) - 1);

    if (hasGen) return (
      <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Payslip ready</p>
            <p className="text-sm font-bold text-slate-800">{fmtKey(key)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Generated
          </span>
          <button
            onClick={() => downloadPayslip(key)}
            disabled={downloading === key}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            style={{ background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe" }}
          >
            {downloading === key
              ? <span className="w-3 h-3 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin inline-block" />
              : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            }
            {downloading === key ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>
    );

    if (isReq) return (
      <div className="px-5 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Request sent — {fmtKey(key)}</p>
            <p className="text-xs text-amber-600 mt-0.5">HR will generate and notify you once ready</p>
          </div>
        </div>
      </div>
    );

    if (avail) return (
      <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-t border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-800">{fmtKey(key)}</p>
          <p className="text-xs text-slate-400 mt-0.5">No payslip generated yet</p>
        </div>
        <button
          onClick={() => requestGenerate(key)}
          disabled={requesting === key}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
          style={{ background:"linear-gradient(135deg,#1e3a8a,#2563eb)" }}
        >
          {requesting === key && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />}
          {requesting === key ? "Sending…" : "Request generate"}
        </button>
      </div>
    );

    return null;
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Payslips</h2>
        <p className="text-xs text-gray-400 mt-0.5">{allPayslips.length} payslip{allPayslips.length !== 1 ? "s" : ""} available</p>
      </div>

      {/* Period card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" style={{ overflow:"visible" }}>

        {/* Trigger row */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Period</p>
            <p className="text-sm font-bold text-slate-800">{selectedKey ? fmtKey(selectedKey) : "Select a month"}</p>
          </div>

          {/* Dropdown anchor */}
          <div className="relative">
            <button
              onClick={() => setCalOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-sm font-semibold text-slate-700"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Change
              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${calOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>

            {calOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setCalOpen(false)} />

                {/* Popover — 268px wide, opens downward-right aligned */}
                <div
                  className="absolute right-0 top-full mt-2 z-20 bg-white rounded-2xl border border-slate-200 shadow-xl"
                  style={{ width:268 }}
                >
                  {/* Year nav */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <button
                      onClick={() => setCurrentYear((y) => y - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-500 text-lg font-bold transition-colors"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-bold text-slate-800">{currentYear}</p>
                    <button
                      onClick={() => setCurrentYear((y) => y + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-500 text-lg font-bold transition-colors"
                    >
                      ›
                    </button>
                  </div>

                  {/* 3-col month grid */}
                  <div className="grid grid-cols-3 gap-1.5 p-3">
                    {SHORT_MONTHS.map((name, idx) => {
                      const key    = mkKey(currentYear, idx);
                      const avail  = isAvailable(currentYear, idx);
                      const hasGen = generatedSet.has(key);
                      const isReq  = requestedKeys.has(key);
                      const isSel  = key === selectedKey;

                      return (
                        <button
                          key={key}
                          disabled={!avail}
                          onClick={() => { setSelectedKey(key); setCalOpen(false); }}
                          className={[
                            "relative flex flex-col items-center justify-center rounded-xl py-2.5 gap-1 border text-xs font-semibold transition-all",
                            !avail
                              ? "border-transparent text-slate-300 cursor-not-allowed"
                              : isSel
                              ? "text-white border-blue-800"
                              : hasGen
                              ? "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                              : "border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50",
                          ].join(" ")}
                          style={isSel ? { background:"linear-gradient(135deg,#1e3a8a,#2563eb)" } : undefined}
                        >
                          {name}
                          <span className={[
                            "w-1 h-1 rounded-full",
                            isSel ? "bg-blue-200" : hasGen ? "bg-emerald-400" : isReq && avail ? "bg-amber-400" : "bg-transparent",
                          ].join(" ")} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Generated
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Requested
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedKey && renderDetail(selectedKey)}
      </div>

      {/* History accordion */}
      {allPayslips.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setHistOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">Payslip history</p>
                <p className="text-xs text-slate-400">{allPayslips.length} record{allPayslips.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${histOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </button>

          {histOpen && (
            <>
              <div className="flex items-center px-5 py-2 bg-slate-50 border-t border-slate-100">
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Period</span>
                <span className="w-24 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
                <span className="w-20 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Action</span>
              </div>
              {allPayslips.map((p) => {
                const [y, m] = p.month.split("-").map(Number);
                const isSel  = p.month === selectedKey;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setCurrentYear(y); setSelectedKey(p.month); }}
                    className={`flex items-center px-5 py-3 border-t border-slate-50 cursor-pointer transition-colors ${isSel ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex-1 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isSel ? "bg-blue-100" : "bg-slate-100"}`}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={isSel ? "#1d4ed8" : "#94a3b8"} strokeWidth={2}>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                        </svg>
                      </div>
                      <p className={`text-sm font-semibold ${isSel ? "text-blue-700" : "text-slate-800"}`}>
                        {MONTH_NAMES[m - 1]} {y}
                      </p>
                    </div>
                    <div className="w-24 flex justify-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />Generated
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
            </>
          )}
        </div>
      )}

      {allPayslips.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-sm font-semibold text-slate-600 mb-1">No Payslips Yet</p>
          <p className="text-xs text-slate-400">Your payslips will appear here once HR generates them.</p>
        </div>
      )}
    </div>
  );
}