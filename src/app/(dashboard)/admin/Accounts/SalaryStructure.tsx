"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  updateDoc,
} from "firebase/firestore";

/* ================= TYPES ================= */

interface Employee {
  uid: string;
  name?: string;
  email?: string;
  empId?: string;
  designation?: string;
  dateOfJoining?: string;
  paymentMode?: string;
  bankName?: string;
  ifscCode?: string;
  accountNo?: string;
}

interface Salary {
  basic: string;
  hra: string;
  specialAllowance: string;
  pf: string;
  pt: string;
  tds: string;
  bankAccount: string;
  pan: string;
}

/* ================= EMPTY ================= */

const emptySalary: Salary = {
  basic: "",
  hra: "",
  specialAllowance: "",
  pf: "",
  pt: "",
  tds: "",
  bankAccount: "",
  pan: "",
};

/* ================= COMPONENT ================= */

export default function SalaryStructure() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const [salary, setSalary] = useState<Salary>(emptySalary);
  const [empDetails, setEmpDetails] = useState<Partial<Employee>>({});
  const [loading, setLoading] = useState(false);

  /* ================= LOAD EMPLOYEES ================= */

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));

        const list: Employee[] = snap.docs
          .map((doc) => ({
            uid: doc.id,
            ...(doc.data() as Omit<Employee, "uid">),
          }))
          .sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );

        setEmployees(list);
      } catch (err) {
        console.error("Failed to load employees:", err);
      }
    };

    loadEmployees();
  }, []);

  /* ================= LOAD SALARY ================= */

  useEffect(() => {
    if (!selectedEmployee) {
      setEmpDetails({});
      return;
    }

    setEmpDetails(selectedEmployee);

    const loadSalary = async () => {
      try {
        const ref = doc(db, "salaryStructures", selectedEmployee.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setSalary(snap.data() as Salary);
        } else {
          setSalary(emptySalary);
        }
      } catch (err) {
        console.error("Failed to load salary:", err);
      }
    };

    loadSalary();
  }, [selectedEmployee]);

  /* ================= CALCULATIONS ================= */

  const gross =
    Number(salary.basic || 0) +
    Number(salary.hra || 0) +
    Number(salary.specialAllowance || 0);

  const handleChange = (field: keyof Salary, value: string) => {
    setSalary((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEmpChange = (field: keyof Employee, value: string) => {
    setEmpDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* ================= SAVE ================= */

  const saveSalary = async () => {
    if (!selectedEmployee) {
      alert("⚠️ Please select an employee before saving");
      return;
    }

    setLoading(true);

    try {
      await setDoc(
        doc(db, "salaryStructures", selectedEmployee.uid),
        {
          ...salary,
          gross,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateDoc(doc(db, "users", selectedEmployee.uid), {
        empId: empDetails.empId || "",
        designation: empDetails.designation || "",
        dateOfJoining: empDetails.dateOfJoining || "",
        paymentMode: empDetails.paymentMode || "",
        bankName: empDetails.bankName || "",
        ifscCode: empDetails.ifscCode || "",
        accountNo: empDetails.accountNo || "",
      });

      setEmployees((prev) =>
        prev.map((emp) =>
          emp.uid === selectedEmployee.uid ? { ...emp, ...empDetails } : emp
        )
      );

      alert("✅ Salary structure and details saved!");
    } catch (err) {
      console.error(err);
      alert("❌ Error saving salary and details");
    }

    setLoading(false);
  };

  /* ================= UI ================= */

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-3xl">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Salary Structure</h2>
        <p className="text-sm text-gray-500">
          Define salary components for employees
        </p>
      </div>

      {/* Employee Dropdown */}
      <select
        className="border border-gray-200 p-3 rounded-xl mb-6 w-full bg-white focus:outline-none"
        onChange={(e) => {
          const emp = employees.find(
            (u) => u.uid === e.target.value
          );
          setSelectedEmployee(emp || null);
        }}
        value={selectedEmployee?.uid || ""}
      >
        <option value="">Select Employee</option>

        {employees.map((emp) => (
          <option key={emp.uid} value={emp.uid}>
            {emp.name || "Unnamed"} ({emp.email})
          </option>
        ))}
      </select>

      {/* Employee Details Form */}
      {selectedEmployee && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Employee Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Employee ID" value={empDetails.empId || ""} onChange={(e) => handleEmpChange("empId", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <input placeholder="Designation" value={empDetails.designation || ""} onChange={(e) => handleEmpChange("designation", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <input type="date" placeholder="Date of Joining" value={empDetails.dateOfJoining || ""} onChange={(e) => handleEmpChange("dateOfJoining", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-500" />
            <select value={empDetails.paymentMode || ""} onChange={(e) => handleEmpChange("paymentMode", e.target.value)} className="border border-gray-200 p-3 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-gray-500">
              <option value="">Select Payment Mode</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
            <input placeholder="Bank Name" value={empDetails.bankName || ""} onChange={(e) => handleEmpChange("bankName", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <input placeholder="IFSC Code" value={empDetails.ifscCode || ""} onChange={(e) => handleEmpChange("ifscCode", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <input placeholder="Account No" value={empDetails.accountNo || ""} onChange={(e) => handleEmpChange("accountNo", e.target.value)} className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
        </div>
      )}

      {/* Salary Form (ALWAYS VISIBLE) */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Salary Components</h3>
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(emptySalary) as (keyof Salary)[]).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={salary[field]}
              onChange={(e) => handleChange(field, e.target.value)}
              className="border border-gray-200 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          ))}
        </div>
      </div>

      {/* Gross Salary */}
      <div className="mt-6 text-lg font-semibold text-gray-800">
        Gross Salary: ₹{gross.toLocaleString()}
      </div>

      {/* Save Button */}
      <button
        onClick={saveSalary}
        disabled={loading}
        className="mt-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-3 rounded-xl font-medium transition"
      >
        {loading ? "Saving..." : "Save Salary"}
      </button>
    </div>
  );
}