"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

type Employee = {
  uid: string;
  name: string;
  email: string;
  generated?: boolean;
};

export default function PayrollGenerator() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [generatingUid, setGeneratingUid] = useState<string | null>(null);
  const [downloadingUid, setDownloadingUid] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  const yearOptions = [today.getFullYear(), today.getFullYear() - 1, today.getFullYear() - 2];

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  useEffect(() => { loadEmployees(); }, [monthKey]);

  /* ================= LOAD ================= */
  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, "users"));
    const list: Employee[] = [];
    for (const docSnap of snap.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();
      const payslipSnap = await getDoc(doc(db, "payslips", `${uid}_${monthKey}`));
      list.push({ uid, name: data.name, email: data.email, generated: payslipSnap.exists() });
    }
    setEmployees(list);
  };

  /* ================= SHARED PDF BUILDER (same logic as employee page) ================= */
  const buildAndDownloadPdf = async (uid: string, monthKey: string) => {
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

    const userDoc    = await getDoc(doc(db, "users", uid));
    const salarySnap = await getDoc(doc(db, "salaryStructures", uid));

    if (!salarySnap.exists()) { alert("Salary structure not found for this employee."); return false; }

    const user   = userDoc.data();
    const salary = salarySnap.data();

    const basic   = Number(salary.basic || 0);
    const hra     = Number(salary.hra || 0);
    const special = Number(salary.specialAllowance || 0);
    const tds     = Number(salary.tds || 0);
    const pt      = Number(salary.pt || 0);
    const other   = Number(salary.other || 0);

    const totalEarnings   = basic + hra + special;
    const totalDeductions = tds + pt + other;
    const netSalary       = totalEarnings - totalDeductions;

    const totalDays   = salary.totalDays || 30;
    const lop         = salary.lop || 0;
    const paidDays    = totalDays - lop;
    const bankAccount = salary.bankAccount || "N/A";
    const designation = user?.designation || user?.role || "Employee";
    const empId       = salary.empId || uid.substring(0, 6).toUpperCase();
    const doj         = user?.dateOfJoining || "N/A";

    const [year, month] = monthKey.split("-");
    const monthName    = new Date(Number(year), Number(month) - 1).toLocaleString("default", { month: "long" });
    const monthDisplay = `${monthName}, ${year}`;

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const W   = 595;

    if (logoDataUrl) pdf.addImage(logoDataUrl, "PNG", 18, 10, 145, 100);

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(19); pdf.setTextColor(0, 0, 0);
    pdf.text("TECHGY INNOVATIONS", 222, 38);
    pdf.text("PRIVATE LIMITED", 222, 60);

    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
    pdf.text("Shop No. 09, Sri Venkateswara Swamy Residency, Land Mark -", 222, 77);
    pdf.text("Rajahmundry Ruchulu, 13th Phase Rd, Kukatpally Housing Board", 222, 88);
    pdf.text("Colony, Hyderabad, Telangana 500085", 222, 99);
    pdf.text("CIN: U93090TG2019PTC13277", 222, 110);

    pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.8);
    pdf.line(28, 122, W - 28, 122);

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(0, 0, 0);
    pdf.text(`Payslip For: ${monthDisplay}`, W / 2, 148, { align: "center" });

    const TOP_Y = 178, LINE_H = 19;

    const lbl = (t: string, x: number, y: number) => {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(0, 0, 0); pdf.text(t, x, y);
    };
    const val = (t: string, x: number, y: number) => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(0, 0, 0); pdf.text(String(t), x, y);
    };

    lbl("Employee Name:",   28,  TOP_Y);           val(user?.name || "-", 145, TOP_Y);
    lbl("Emp ID:",          28,  TOP_Y + LINE_H);  val(empId,             145, TOP_Y + LINE_H);
    lbl("Designation:",     28,  TOP_Y + LINE_H*2);val(designation,       145, TOP_Y + LINE_H*2);
    lbl("Date of Joining:", 28,  TOP_Y + LINE_H*3);val(doj,               145, TOP_Y + LINE_H*3);

    lbl("Total Days In Month:", 318, TOP_Y);            val(String(totalDays), 470, TOP_Y);
    lbl("LOP",                  318, TOP_Y + LINE_H);   val(String(lop),       470, TOP_Y + LINE_H);
    lbl("Actual Paid Days",     318, TOP_Y + LINE_H*2); val(String(paidDays),  470, TOP_Y + LINE_H*2);
    lbl("Bank Account No.",     318, TOP_Y + LINE_H*3); val(bankAccount,       470, TOP_Y + LINE_H*3);

    const TABLE_TOP = TOP_Y + LINE_H * 3 + 28;
    const ROW_H = 21, TX = 28;
    const CW = [145, 115, 165, 114];
    const CX = [TX, TX+CW[0], TX+CW[0]+CW[1], TX+CW[0]+CW[1]+CW[2]];

    const tableRows: [string,string,string,string,boolean,boolean][] = [
      ["Earnings",           "Amount",             "Deduction",        "Amount",                 true,  false],
      ["Basic Salary",       String(basic),        "TDS",              String(tds),              false, false],
      ["HRA",                String(hra),           "PT",               String(pt),               false, false],
      ["Special Allowances", String(special),      "Other",            other ? String(other):"", false, false],
      ["Total Earnings",     String(totalEarnings),"Total Deductions", String(totalDeductions),  false, true ],
    ];

    tableRows.forEach(([el,ev,dl,dv,isH,isT], i) => {
      const ry = TABLE_TOP + i * ROW_H;
      [el, ev, dl, dv].forEach((text, ci) => {
        const x = CX[ci], w = CW[ci];
        if (isH || isT) { pdf.setFillColor(224,224,224); pdf.rect(x, ry, w, ROW_H, "F"); }
        pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.5); pdf.rect(x, ry, w, ROW_H, "S");
        const ty = ry + ROW_H - 6;
        pdf.setFont("helvetica", isH||isT ? "bold" : "normal");
        pdf.setFontSize(10); pdf.setTextColor(0,0,0);
        if (isH) pdf.text(text, x + w/2, ty, { align: "center" });
        else if ((ci===1||ci===3) && text) pdf.text(text, x + w - 6, ty, { align: "right" });
        else pdf.text(text, x + 6, ty);
      });
    });

    const NET_Y = TABLE_TOP + tableRows.length * ROW_H + 26;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(0,0,0);
    pdf.text("Net Salary",      165, NET_Y);
    pdf.text(String(netSalary), 315, NET_Y);

    pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(80,80,80);
    pdf.text("This is system Generated document. doesn't need a signature", W/2, NET_Y+55, { align:"center" });
    pdf.text("For Verification reach hr@techgyinnovations.com",             W/2, NET_Y+69, { align:"center" });

    // ✅ Direct download — identical to employee page, no Storage needed
    pdf.save(`Payslip_${user?.name || uid}_${monthKey}.pdf`);
    return true;
  };

  /* ================= GENERATE: saves only metadata to Firestore ================= */
  const generatePayslip = async (uid: string, silent = false) => {
    const userDoc    = await getDoc(doc(db, "users", uid));
    const salarySnap = await getDoc(doc(db, "salaryStructures", uid));

    if (!salarySnap.exists()) {
      if (!silent) alert("❌ Salary structure not found for this employee.");
      return false;
    }

    const user   = userDoc.data();
    const salary = salarySnap.data();

    const gross      = Number(salary.basic||0) + Number(salary.hra||0) + Number(salary.specialAllowance||0);
    const deductions = Number(salary.tds||0)   + Number(salary.pt||0)  + Number(salary.other||0);
    const netSalary  = gross - deductions;

    // Save only metadata — PDF is regenerated on demand (same as employee page)
    await setDoc(doc(db, "payslips", `${uid}_${monthKey}`), {
      uid,
      employeeId: uid,
      name:      user?.name,
      email:     user?.email,
      month:     monthKey,
      gross,
      deductions,
      netSalary,
      generatedAt: serverTimestamp(),
    });

    return true;
  };

  const handleGenerateSingle = async (uid: string) => {
    setGeneratingUid(uid);
    const ok = await generatePayslip(uid, false);
    if (ok) alert("✅ Payslip Generated");
    await loadEmployees();
    setGeneratingUid(null);
  };

  /* ================= DOWNLOAD: regenerate from salary data (same as employee page) ================= */
  const handleDownload = async (uid: string) => {
    setDownloadingUid(uid);
    await buildAndDownloadPdf(uid, monthKey);
    setDownloadingUid(null);
  };

  /* ================= GENERATE ALL ================= */
  const handleGenerateAll = async () => {
    const pending = employees.filter((e) => !e.generated);
    if (pending.length === 0) { alert("✅ All payslips already generated for this month."); return; }

    const confirmed = confirm(
      `Generate payslips for ${pending.length} pending employee(s) for ${monthNames[selectedMonth-1]} ${selectedYear}?`
    );
    if (!confirmed) return;

    setLoadingAll(true);
    setBulkProgress({ done: 0, total: pending.length });

    let successCount = 0;
    const failNames: string[] = [];

    for (let i = 0; i < pending.length; i++) {
      const emp = pending[i];
      const ok  = await generatePayslip(emp.uid, true);
      if (ok) successCount++; else failNames.push(emp.name || emp.uid);
      setBulkProgress({ done: i + 1, total: pending.length });
    }

    await loadEmployees();
    setLoadingAll(false);
    setBulkProgress(null);

    if (failNames.length === 0) {
      alert(`✅ All ${successCount} payslips generated successfully!`);
    } else {
      alert(`✅ ${successCount} payslips generated.\n❌ Failed (no salary structure):\n${failNames.join(", ")}`);
    }
  };

  const totalCount     = employees.length;
  const generatedCount = employees.filter((e) => e.generated).length;
  const pendingCount   = totalCount - generatedCount;

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payroll Generator</h2>
          <p className="text-sm text-gray-500 mt-1">
            {generatedCount} of {totalCount} generated &nbsp;·&nbsp;
            <span className="text-amber-600 font-medium">{pendingCount} pending</span>
          </p>
        </div>

        {/* MONTH PICKER */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer">
            {monthNames.map((name, idx) => (
              <option key={idx+1} value={idx+1}>{name}</option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer">
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* BULK GENERATE */}
      <div className="flex items-center gap-4">
        <button onClick={handleGenerateAll} disabled={loadingAll || pendingCount === 0}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm ${
            pendingCount === 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}>
          {loadingAll ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              {bulkProgress ? `Generating ${bulkProgress.done}/${bulkProgress.total}…` : "Generating…"}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Generate All ({pendingCount} pending)
            </>
          )}
        </button>

        {bulkProgress && (
          <div className="flex-1 max-w-xs">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round((bulkProgress.done / bulkProgress.total) * 100)}% complete
            </p>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Employee</th>
              <th className="p-3 text-center text-sm font-semibold text-gray-600">Status</th>
              <th className="p-3 text-center text-sm font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-gray-400">Loading employees…</td></tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.uid} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </td>
                  <td className="p-3 text-center">
                    {emp.generated ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        ✅ Generated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        ⏳ Pending
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {emp.generated ? (
                      <button
                        onClick={() => handleDownload(emp.uid)}
                        disabled={downloadingUid === emp.uid}
                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        {downloadingUid === emp.uid ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Preparing…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateSingle(emp.uid)}
                        disabled={generatingUid === emp.uid}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {generatingUid === emp.uid ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Generating…
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Generate
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}