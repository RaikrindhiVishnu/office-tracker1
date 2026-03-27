"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

type Payslip = {
  id: string;
  uid: string;
  name: string;
  month: string;
  generatedAt?: any;
};

export default function PayslipHistory() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    try {
      const snap = await getDocs(collection(db, "payslips"));

      const data: Payslip[] = snap.docs.map((d) => ({
        id: d.id,
        uid: d.data().uid || d.id.split("_")[0],
        name: d.data().name || "Unknown",
        month: d.data().month || "-",
        generatedAt: d.data().generatedAt || null,
      }));

      data.sort((a, b) => {
        const aTime = a.generatedAt?.seconds || 0;
        const bTime = b.generatedAt?.seconds || 0;
        return bTime - aTime;
      });

      setPayslips(data);
    } catch (err) {
      console.error("Error loading payslips:", err);
      alert("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  /* ================= SAME PDF BUILDER AS PayrollGenerator ================= */
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

    lbl("Employee Name:",   28,  TOP_Y);            val(user?.name || "-", 145, TOP_Y);
    lbl("Emp ID:",          28,  TOP_Y + LINE_H);   val(empId,             145, TOP_Y + LINE_H);
    lbl("Designation:",     28,  TOP_Y + LINE_H*2); val(designation,       145, TOP_Y + LINE_H*2);
    lbl("Date of Joining:", 28,  TOP_Y + LINE_H*3); val(doj,               145, TOP_Y + LINE_H*3);

    lbl("Total Days In Month:", 318, TOP_Y);            val(String(totalDays), 470, TOP_Y);
    lbl("LOP",                  318, TOP_Y + LINE_H);   val(String(lop),       470, TOP_Y + LINE_H);
    lbl("Actual Paid Days",     318, TOP_Y + LINE_H*2); val(String(paidDays),  470, TOP_Y + LINE_H*2);
    lbl("Bank Account No.",     318, TOP_Y + LINE_H*3); val(bankAccount,       470, TOP_Y + LINE_H*3);

    const TABLE_TOP = TOP_Y + LINE_H * 3 + 28;
    const ROW_H = 21, TX = 28;
    const CW = [145, 115, 165, 114];
    const CX = [TX, TX+CW[0], TX+CW[0]+CW[1], TX+CW[0]+CW[1]+CW[2]];

    const tableRows: [string,string,string,string,boolean,boolean][] = [
      ["Earnings",           "Amount",              "Deduction",        "Amount",                 true,  false],
      ["Basic Salary",       String(basic),         "TDS",              String(tds),              false, false],
      ["HRA",                String(hra),            "PT",               String(pt),               false, false],
      ["Special Allowances", String(special),       "Other",            other ? String(other):"", false, false],
      ["Total Earnings",     String(totalEarnings), "Total Deductions", String(totalDeductions),  false, true ],
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

    pdf.save(`Payslip_${user?.name || uid}_${monthKey}.pdf`);
    return true;
  };

  const handleDownload = async (p: Payslip) => {
    setDownloadingId(p.id);
    await buildAndDownloadPdf(p.uid, p.month);
    setDownloadingId(null);
  };

  /* ================= UI ================= */
  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow">
        Loading payslips...
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Payslip History</h2>

      {payslips.length === 0 ? (
        <p className="text-gray-500">No payroll generated yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border rounded-xl overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Month</th>
                <th className="p-3 text-left">PDF</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50 transition">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">{p.month}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDownload(p)}
                      disabled={downloadingId === p.id}
                      className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      {downloadingId === p.id ? (
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}