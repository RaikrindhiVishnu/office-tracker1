"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function PayslipHistory() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    try {
      const snap = await getDocs(collection(db, "payslips"));

      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort latest first
      data.sort(
        (a: any, b: any) =>
          b.generatedAt?.seconds - a.generatedAt?.seconds
      );

      setPayslips(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load payslips");
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow">
        Loading payslips...
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6">
        Payslip History
      </h2>

      {payslips.length === 0 ? (
        <p className="text-gray-500">
          No payroll generated yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Month</th>
                <th className="p-3 text-left">Gross</th>
                <th className="p-3 text-left">Deductions</th>
                <th className="p-3 text-left">Net Salary</th>
                <th className="p-3 text-left">PDF</th>
              </tr>
            </thead>

            <tbody>
              {payslips.map((p) => (
                <tr
                  key={p.id}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="p-3">{p.name}</td>

                  <td className="p-3">{p.month}</td>

                  <td className="p-3">
                    ₹{p.gross?.toLocaleString()}
                  </td>

                  <td className="p-3">
                    ₹{p.deductions?.toLocaleString()}
                  </td>

                  <td className="p-3 font-semibold text-green-600">
                    ₹{p.netSalary?.toLocaleString()}
                  </td>

                  <td className="p-3">
                    <a
                      href={p.pdfUrl}
                      target="_blank"
                      className="text-indigo-600 hover:underline"
                    >
                      Download
                    </a>
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
