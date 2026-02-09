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
} from "firebase/firestore";

/* ================= TYPES ================= */

interface Employee {
  uid: string;
  name?: string;
  email?: string;
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

  const [salary, setSalary] =
    useState<Salary>(emptySalary);

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
    if (!selectedEmployee) return;

    const loadSalary = async () => {
      try {
        const ref = doc(
          db,
          "salaryStructures",
          selectedEmployee.uid
        );

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

  const handleChange = (
    field: keyof Salary,
    value: string
  ) => {
    setSalary((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

/* ================= SAVE ================= */

  const saveSalary = async () => {
    if (!selectedEmployee) {
      alert("Select employee first");
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

      alert("✅ Salary structure saved!");
    } catch (err) {
      console.error(err);
      alert("❌ Error saving salary");
    }

    setLoading(false);
  };

/* ================= UI ================= */

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">
        Salary Structure
      </h2>

      {/* Employee Dropdown */}
      <select
        className="border p-3 rounded-lg mb-6 w-full"
        onChange={(e) => {
          const emp = employees.find(
            (u) => u.uid === e.target.value
          );
          setSelectedEmployee(emp || null);
        }}
        value={selectedEmployee?.uid || ""}
      >
        <option value="" disabled>
          Select Employee
        </option>

        {employees.map((emp) => (
          <option key={emp.uid} value={emp.uid}>
            {emp.name || "Unnamed"} ({emp.email})
          </option>
        ))}
      </select>

      {/* Show form ONLY after selecting */}
      {selectedEmployee && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(emptySalary) as (keyof Salary)[])
              .map((field) => (
                <input
                  key={field}
                  placeholder={field}
                  value={salary[field]}
                  onChange={(e) =>
                    handleChange(field, e.target.value)
                  }
                  className="border p-3 rounded-lg"
                />
              ))}
          </div>

          {/* Gross */}
          <div className="mt-6 text-lg font-semibold">
            Gross Salary: ₹{gross.toLocaleString()}
          </div>

          <button
            onClick={saveSalary}
            disabled={loading}
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl"
          >
            {loading ? "Saving..." : "Save Salary"}
          </button>
        </>
      )}
    </div>
  );
}
