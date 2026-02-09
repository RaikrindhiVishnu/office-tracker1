"use client";

import { useEffect, useState } from "react";
import { db, storage } from "@/lib/firebase";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

type Employee = {
  uid: string;
  name: string;
  email: string;
  generated?: boolean;
  pdfUrl?: string;
};

export default function PayrollGenerator() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // ⭐ Progress tracker (BIG UX upgrade)
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  useEffect(() => {
    loadEmployees();
  }, []);

  /* ================= LOAD ================= */

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, "users"));

    const list: Employee[] = [];

    for (const docSnap of snap.docs) {
      const uid = docSnap.id;
      const data = docSnap.data();

      const payslipRef = doc(db, "payslips", `${uid}_${monthKey}`);
      const exists = await getDoc(payslipRef);

      list.push({
        uid,
        name: data.name,
        email: data.email,
        generated: exists.exists(),
        pdfUrl: exists.exists() ? exists.data()?.pdfUrl : null,
      });
    }

    setEmployees(list);
  };

  /* ================= SELECT ================= */

  const toggleSelect = (uid: string) => {
    setSelected(prev =>
      prev.includes(uid)
        ? prev.filter(id => id !== uid)
        : [...prev, uid]
    );
  };

  const selectAll = () => {
    if (selected.length === employees.length) {
      setSelected([]);
    } else {
      setSelected(employees.map(e => e.uid));
    }
  };

  /* ================= PAYROLL ENGINE ================= */

  const generateForEmployees = async (uids: string[]) => {
    if (!uids.length) {
      alert("Select employees first");
      return;
    }

    if (!confirm("Generate payroll?")) return;

    setLoading(true);
    setProgress(0);
    setTotal(uids.length);

    const { default: jsPDF } = await import("jspdf");

    try {
      for (const uid of uids) {
        const userDoc = await getDoc(doc(db, "users", uid));
        const user = userDoc.data();

        const payslipRef = doc(db, "payslips", `${uid}_${monthKey}`);
        const exists = await getDoc(payslipRef);

        if (exists.exists()) {
          setProgress(p => p + 1);
          continue;
        }

        const salarySnap = await getDoc(
          doc(db, "salaryStructures", uid)
        );

        if (!salarySnap.exists()) {
          setProgress(p => p + 1);
          continue;
        }

        const salary = salarySnap.data();

        const gross =
          Number(salary.basic || 0) +
          Number(salary.hra || 0) +
          Number(salary.specialAllowance || 0);

        const deductions =
          Number(salary.pf || 0) +
          Number(salary.pt || 0) +
          Number(salary.tds || 0);

        const netSalary = Math.round(gross - deductions);

        /* ===== PDF ===== */

        const pdf = new jsPDF();

        pdf.setFontSize(18);
        pdf.text("PAYSLIP", 80, 20);

        pdf.setFontSize(12);
        pdf.text(`Employee: ${user?.name}`, 20, 40);
        pdf.text(`Month: ${monthKey}`, 20, 50);

        pdf.text(`Basic: ₹${salary.basic}`, 20, 70);
        pdf.text(`HRA: ₹${salary.hra}`, 20, 80);
        pdf.text(`Allowance: ₹${salary.specialAllowance}`, 20, 90);

        pdf.text(`Gross: ₹${gross}`, 20, 110);
        pdf.text(`Deductions: ₹${deductions}`, 20, 120);

        pdf.setFontSize(14);
        pdf.text(`Net Salary: ₹${netSalary}`, 20, 140);

        const blob = pdf.output("blob");

        const storageRef = ref(
          storage,
          `payslips/${uid}_${monthKey}.pdf`
        );

        /* ===== RESUMABLE UPLOAD (CRITICAL FIX) ===== */

        const uploadTask = uploadBytesResumable(storageRef, blob);

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            null,
            reject,
            () => resolve(true)
          );
        });

        const url = await getDownloadURL(storageRef);

        await setDoc(payslipRef, {
          uid,
          name: user?.name,
          month: monthKey,
          gross,
          deductions,
          netSalary,
          pdfUrl: url,
          generatedAt: serverTimestamp(),
        });

        // ⭐ Prevent Firebase overload
        await new Promise(res => setTimeout(res, 350));

        setProgress(p => p + 1);
      }

      alert("✅ Payroll generated successfully!");

      setSelected([]);
      loadEmployees();

    } catch (err) {
      console.error(err);
      alert("Payroll failed");
    }

    setLoading(false);
  };

  /* ================= PAGINATION ================= */

  const lastIndex = currentPage * perPage;
  const firstIndex = lastIndex - perPage;
  const currentEmployees = employees.slice(firstIndex, lastIndex);
  const totalPages = Math.ceil(employees.length / perPage);

  /* ================= UI ================= */

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6">
        Payroll Generator — {monthKey}
      </h2>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => generateForEmployees(employees.map(e => e.uid))}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl"
        >
          Generate All
        </button>

        <button
          onClick={() => generateForEmployees(selected)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl"
        >
          Generate Selected
        </button>
      </div>

      {/* PROGRESS */}
      {loading && (
        <p className="mb-4 text-indigo-600 font-semibold">
          Generating {progress} / {total} payslips...
        </p>
      )}

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full border rounded-xl">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  onChange={selectAll}
                  checked={selected.length === employees.length}
                />
              </th>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Month</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">PDF</th>
            </tr>
          </thead>

          <tbody>
            {currentEmployees.map(emp => (
              <tr key={emp.uid} className="border-t">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(emp.uid)}
                    onChange={() => toggleSelect(emp.uid)}
                  />
                </td>

                <td className="p-3 font-medium">
                  {emp.name}
                  <div className="text-xs text-gray-500">
                    {emp.email}
                  </div>
                </td>

                <td className="p-3">{monthKey}</td>

                <td className="p-3">
                  {emp.generated ? (
                    <span className="text-green-600 font-semibold">
                      Generated
                    </span>
                  ) : (
                    <span className="text-orange-500 font-semibold">
                      Pending
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {emp.generated && emp.pdfUrl ? (
                    <a
                      href={emp.pdfUrl}
                      target="_blank"
                      className="text-indigo-600 font-semibold"
                    >
                      Download
                    </a>
                  ) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center mt-6 gap-2">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-4 py-2 rounded-lg ${
              currentPage === i + 1
                ? "bg-indigo-600 text-white"
                : "bg-gray-200"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
