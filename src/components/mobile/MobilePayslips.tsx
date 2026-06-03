"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Download, FileText, Send, AlertCircle, CheckCircle2 } from "lucide-react";

interface Payslip {
  id: string;
  month: any;
  gross: number;
  deductions: number;
  netSalary: number;
  generatedAt: any;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const toMonthKey = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?.toDate) {
    const d = value.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  return "";
};

export const MobilePayslips = () => {
  const { user } = useAuth();

  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [joinDate, setJoinDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requestedKeys, setRequestedKeys] = useState<Set<string>>(new Set());

  // Use the current year as default filter
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const [snap, userDoc] = await Promise.all([
          getDocs(query(collection(db, "payslips"), where("uid", "==", user.uid))),
          getDoc(doc(db, "users", user.uid)),
        ]);

        const list: Payslip[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Payslip[];

        list.sort((a, b) => toMonthKey(b.month).localeCompare(toMonthKey(a.month)));
        setAllPayslips(list);

        const userData = userDoc.data();
        setJoinDate(userData?.dateOfJoining || null);
      } catch (err) {
        console.error("Failed to load payslips", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const generatedMap = useMemo(() => {
    const map = new Map<string, Payslip>();
    allPayslips.forEach((p) => {
      const key = toMonthKey(p.month);
      if (key) map.set(key, p);
    });
    return map;
  }, [allPayslips]);

  const availableYears = useMemo(() => {
    const now = new Date();
    const years = new Set<string>();
    allPayslips.forEach((p) => {
      const key = toMonthKey(p.month);
      if (key) years.add(key.split("-")[0]);
    });
    years.add(String(now.getFullYear()));
    if (joinDate) {
      const jy = joinDate.includes("-") ? joinDate.split("-")[0] : joinDate.split("/")[2];
      if (jy) years.add(jy);
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [allPayslips, joinDate]);

  // Generate months based on selected year (up to current month for current year)
  const monthsToDisplay = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const targetYear = Number(filterYear);

    let startMonth = 1;
    let endMonth = 12;

    if (targetYear === currentYear) {
      endMonth = currentMonth;
    }

    if (joinDate) {
      let jy = currentYear, jm = 1;
      if (joinDate.includes("-")) {
        const parts = joinDate.split("-");
        jy = Number(parts[0]);
        jm = Number(parts[1]);
      } else if (joinDate.includes("/")) {
        const parts = joinDate.split("/");
        jy = Number(parts[2]);
        jm = Number(parts[1]);
      }

      if (targetYear < jy) return [];
      if (targetYear === jy) startMonth = jm;
    } else if (allPayslips.length > 0) {
      const oldestKey = toMonthKey(allPayslips[allPayslips.length - 1].month);
      if (oldestKey) {
        const [oy, om] = oldestKey.split("-").map(Number);
        if (targetYear < oy) return [];
        if (targetYear === oy) startMonth = om;
      }
    }

    const rows: string[] = [];
    for (let m = endMonth; m >= startMonth; m--) {
      rows.push(`${targetYear}-${String(m).padStart(2, "0")}`);
    }
    return rows;
  }, [filterYear, joinDate, allPayslips]);

  const requestGenerate = async (key: string) => {
    if (!user?.uid || requestedKeys.has(key)) return;
    setRequesting(key);
    try {
      await addDoc(collection(db, "payslipRequests"), {
        uid: user.uid,
        month: key,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setRequestedKeys((prev) => new Set(prev).add(key));
    } catch (err) {
      console.error(err);
    } finally {
      setRequesting(null);
    }
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
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 150;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } else resolve("");
        };
        img.onerror = () => resolve("");
        img.src = "/logo (2).png";
      });

      const userDoc = await getDoc(doc(db, "users", user!.uid));
      const salarySnap = await getDoc(doc(db, "salaryStructures", user!.uid));
      if (!salarySnap.exists()) {
        alert("Salary structure not found.");
        return;
      }

      const userData = userDoc.data();
      const salary = salarySnap.data();
      const basic = Number(salary.basic || 0);
      const hra = Number(salary.hra || 0);
      const special = Number(salary.specialAllowance || 0);
      const tds = Number(salary.tds || 0);
      const pt = Number(salary.pt || 0);
      const other = Number(salary.other || 0);
      const totalEarnings = basic + hra + special;
      const totalDeductions = tds + pt + other;
      const netSalary = totalEarnings - totalDeductions;
      const totalDays = salary.totalDays || 30;
      const lop = salary.lop || 0;
      const bankAccount = salary.bankAccount || "N/A";
      const designation = userData?.designation || userData?.role || "Employee";
      const empId = salary.empId || user!.uid.substring(0, 6).toUpperCase();
      const doj = userData?.dateOfJoining || "N/A";
      const [year, month] = monthKey.split("-");
      const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("default", { month: "long" });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const W = 595;

      if (logoDataUrl) pdf.addImage(logoDataUrl, "PNG", 18, 10, 145, 100);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(19); pdf.setTextColor(0, 0, 0);
      pdf.text("TECHGY INNOVATIONS", 222, 38);
      pdf.text("PRIVATE LIMITED", 222, 60);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
      pdf.text("Shop No. 09, Sri Venkateswara Swamy Residency, Land Mark -", 222, 77);
      pdf.text("Rajahmundry Ruchulu, 13th Phase Rd, Kukatpally Housing Board", 222, 88);
      pdf.text("Colony, Hyderabad, Telangana 500085", 222, 99);
      pdf.text("CIN: U93090TG2019PTC13277", 222, 110);
      pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.8); pdf.line(28, 122, W - 28, 122);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
      pdf.text(`Payslip For: ${monthName}, ${year}`, W / 2, 148, { align: "center" });

      const TOP_Y = 178, LINE_H = 19;
      const lbl = (t: string, x: number, y: number) => {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(0, 0, 0); pdf.text(t, x, y);
      };
      const val = (t: string, x: number, y: number) => {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(0, 0, 0); pdf.text(String(t), x, y);
      };

      lbl("Employee Name:", 28, TOP_Y); val(userData?.name || "-", 145, TOP_Y);
      lbl("Emp ID:", 28, TOP_Y + LINE_H); val(empId, 145, TOP_Y + LINE_H);
      lbl("Designation:", 28, TOP_Y + LINE_H * 2); val(designation, 145, TOP_Y + LINE_H * 2);
      lbl("Date of Joining:", 28, TOP_Y + LINE_H * 3); val(doj, 145, TOP_Y + LINE_H * 3);
      lbl("Total Days In Month:", 318, TOP_Y); val(String(totalDays), 470, TOP_Y);
      lbl("LOP", 318, TOP_Y + LINE_H); val(String(lop), 470, TOP_Y + LINE_H);
      lbl("Actual Paid Days", 318, TOP_Y + LINE_H * 2); val(String(totalDays - lop), 470, TOP_Y + LINE_H * 2);
      lbl("Bank Account No.", 318, TOP_Y + LINE_H * 3); val(bankAccount, 470, TOP_Y + LINE_H * 3);

      const TABLE_TOP = TOP_Y + LINE_H * 3 + 28, ROW_H = 21, TX = 28;
      const CW = [145, 115, 165, 114];
      const CX = [TX, TX + CW[0], TX + CW[0] + CW[1], TX + CW[0] + CW[1] + CW[2]];
      const rows2: [string, string, string, string, boolean, boolean][] = [
        ["Earnings", "Amount", "Deduction", "Amount", true, false],
        ["Basic Salary", String(basic), "TDS", String(tds), false, false],
        ["HRA", String(hra), "PT", String(pt), false, false],
        ["Special Allowances", String(special), "Other", other ? String(other) : "", false, false],
        ["Total Earnings", String(totalEarnings), "Total Deductions", String(totalDeductions), false, true],
      ];

      rows2.forEach(([el, ev, dl, dv, isH, isT], i) => {
        const ry = TABLE_TOP + i * ROW_H;
        [el, ev, dl, dv].forEach((text, ci) => {
          const x = CX[ci], w = CW[ci];
          if (isH || isT) { pdf.setFillColor(224, 224, 224); pdf.rect(x, ry, w, ROW_H, "F"); }
          pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(0.5); pdf.rect(x, ry, w, ROW_H, "S");
          const ty = ry + ROW_H - 6;
          pdf.setFont("helvetica", isH || isT ? "bold" : "normal");
          pdf.setFontSize(10); pdf.setTextColor(0, 0, 0);
          if (isH) pdf.text(text, x + w / 2, ty, { align: "center" });
          else if ((ci === 1 || ci === 3) && text) pdf.text(text, x + w - 6, ty, { align: "right" });
          else pdf.text(text, x + 6, ty);
        });
      });

      const NET_Y = TABLE_TOP + rows2.length * ROW_H + 26;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(0, 0, 0);
      pdf.text("Net Salary", 165, NET_Y);
      pdf.text(String(netSalary), 315, NET_Y);
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
      pdf.text("This is system Generated document. doesn't need a signature", W / 2, NET_Y + 55, { align: "center" });
      pdf.text("For Verification reach hr@techgyinnovations.com", W / 2, NET_Y + 69, { align: "center" });
      pdf.save(`Payslip_${userData?.name || user!.uid}_${monthKey}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Failed to download PDF");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Loading Payslips</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto w-full flex flex-col gap-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-gray-900">My Payslips</h2>
        <p className="text-xs text-gray-500 mt-1 font-medium">Download your monthly salary slips easily.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-16 z-10">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
          Select Year
        </label>
        <div className="relative">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-10">
        {monthsToDisplay.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-600">No payslips found</p>
            <p className="text-xs text-gray-400 mt-1">There are no records for this year.</p>
          </div>
        ) : (
          monthsToDisplay.map((monthKey) => {
            const isGenerated = generatedMap.has(monthKey);
            const isRequested = requestedKeys.has(monthKey);
            const [y, m] = monthKey.split("-");
            const monthName = MONTH_NAMES[Number(m) - 1];

            return (
              <div key={monthKey} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                {isGenerated && (
                  <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-50 rounded-full blur-2xl" />
                )}
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isGenerated ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{monthName} {y}</h4>
                      <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-wider ${isGenerated ? 'text-emerald-500' : isRequested ? 'text-amber-500' : 'text-gray-400'}`}>
                        {isGenerated ? "Ready to Download" : isRequested ? "Request Pending" : "Not Generated"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-50 relative z-10">
                  {isGenerated ? (
                    <button
                      onClick={() => downloadPayslip(monthKey)}
                      disabled={downloading === monthKey}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {downloading === monthKey ? (
                        <>
                          <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download Payslip
                        </>
                      )}
                    </button>
                  ) : isRequested ? (
                    <div className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-2.5 rounded-xl text-xs font-bold border border-amber-100/50">
                      <CheckCircle2 className="w-4 h-4" />
                      Request Sent to HR
                    </div>
                  ) : (
                    <button
                      onClick={() => requestGenerate(monthKey)}
                      disabled={requesting === monthKey}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {requesting === monthKey ? (
                        <>
                          <div className="w-3 h-3 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Request Payslip
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
